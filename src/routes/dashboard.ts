import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db } from '../db/client.js';
import { tokens, users, events, auditLog } from '../db/schema.js';
import { eq, and, isNull, desc, count, gte, sql } from 'drizzle-orm';
import { createSession, destroySession, hashPassword, verifyPassword, writeAudit, issueToken, revokeToken, resolveSession } from '../auth/index.js';
import { t as translate, type Locale } from '../i18n/index.js';
import { render, renderPartial } from '../views/render.js';
import {
  getOverviewStats,
  getRecentEvents,
  getDeveloperStats,
  getDeveloperDetail,
  listChanges,
  getRoiSummary,
  getChangeTimeline,
  getSkillAdoption,
  getTimeBaselines,
  setTimeBaselines,
  getEventsPerDay,
  getEventsByType,
  getTopDevelopers,
  getRoiByWorkType,
  getTimeSavedByChange,
  getTimeAggregates,
  getActiveProjectCount,
} from '../services/metrics.js';

const LoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  next: z.string().optional(),
});

const CreateUserSchema = z.object({
  username: z.string().min(3).max(64).regex(/^[a-z0-9_-]+$/i),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  role: z.enum(['admin', 'member']).default('member'),
});

const IssueTokenSchema = z.object({
  name: z.string().min(1).max(64),
  password: z.string().min(1),
});

export async function registerDashboardRoutes(app: FastifyInstance) {
  // ----- GET /dashboard/login -----
  app.get('/dashboard/login', async (req, reply) => {
    // Check for an existing session inline (the preHandler middleware skips
    // /dashboard/login so the route must do it itself). If valid, redirect
    // to /dashboard/ so a logged-in user doesn't see the form again.
    const cookies = req.cookies as Record<string, string> | undefined;
    const existing = cookies?.['baseline_dashboard_session'];
    if (existing) {
      const session = await resolveSession(existing);
      if (session) {
        return reply.redirect('/dashboard/');
      }
    }
    const next = (req.query as Record<string, string>).next ?? '/dashboard/';
    const locale = (req as { locale?: Locale }).locale ?? 'en';
    const t = (key: string) => translate(locale, key);
    reply.type('text/html');
    return render('login', { next, error: null, user: null, locale, t }, { layout: 'auth' });
  });

  // ----- POST /dashboard/login -----
  app.post('/dashboard/login', async (req, reply) => {
    const parsed = LoginSchema.safeParse(req.body);
    const next = (req.body as Record<string, string>)?.next ?? '/dashboard/';
    const locale = (req as { locale?: Locale }).locale ?? 'en';
    const t = (key: string) => translate(locale, key);
    if (!parsed.success) {
      reply.type('text/html');
      return reply.code(400).send(await render('login', { next, error: t('login.required_fields'), user: null, locale, t }, { layout: 'auth' }));
    }
    const { username, password } = parsed.data;
    const rows = await db.select().from(users).where(eq(users.username, username)).limit(1);
    const user = rows[0];
    if (!user || !user.enabled || !(await verifyPassword(password, user.passwordHash))) {
      reply.type('text/html');
      return reply.code(401).send(await render('login', { next, error: t('login.invalid_credentials'), user: null, locale, t }, { layout: 'auth' }));
    }

    const { cookieValue } = await createSession(user.id, req.ip);
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
    reply.setCookie('baseline_dashboard_session', cookieValue, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: req.protocol === 'https',
      maxAge: 8 * 60 * 60, // 8h
    });
    return reply.redirect(next.startsWith('/') ? next : '/dashboard/');
  });

  // ----- POST /dashboard/logout -----
  app.post('/dashboard/logout', async (req, reply) => {
    if (req.dashboardSession) {
      await destroySession(req.dashboardSession.id, req.dashboardSession.userId);
    }
    reply.clearCookie('baseline_dashboard_session', { path: '/' });
    return reply.redirect('/dashboard/login');
  });

  // ----- GET /dashboard/ (overview) -----
  app.get('/dashboard/', async (req, reply) => {
    if (!req.dashboardSession) return reply.redirect('/dashboard/login');
    const [stats, recent, timeAgg, activeProjects, timeThisWeek, roi, timeSaved, roiByWorkType] = await Promise.all([
      getOverviewStats(),
      getRecentEvents(8),
      getTimeAggregates(30),
      getActiveProjectCount(7),
      getTimeAggregates(7),
      getRoiSummary(),
      getTimeSavedByChange(),
      getRoiByWorkType(),
    ]);
    reply.type('text/html');
    return render(
      'overview',
      {
        user: req.dashboardSession,
        stats,
        recent,
        timeAgg,
        activeProjects,
        timeThisWeek,
        roi,
        timeSaved,
        roiByWorkType,
        active: 'overview',
        locale: (req as { locale?: string }).locale,
        t: (req as { t?: (k: string) => string }).t,
        currentPath: '/dashboard/',
      },
      { layout: 'base' },
    );
  });

  // ----- GET /dashboard/events -----
  app.get('/dashboard/events', async (req, reply) => {
    if (!req.dashboardSession) return reply.redirect('/dashboard/login');
    const q = req.query as Record<string, string>;
    const limit = Math.min(Number(q.limit ?? 100), 500);
    const events = await getRecentEvents(limit);
    reply.type('text/html');
    return render('events', { user: req.dashboardSession, events, filters: q, active: 'events' }, { layout: 'base' });
  });

  // ----- GET /dashboard/developers -----
  app.get('/dashboard/developers', async (req, reply) => {
    if (!req.dashboardSession) return reply.redirect('/dashboard/login');
    const [devs, topDevs] = await Promise.all([getDeveloperStats(), getTopDevelopers(30, 10)]);
    reply.type('text/html');
    return render('developers', { user: req.dashboardSession, devs, topDevs, active: 'developers' }, { layout: 'base' });
  });

  // ----- GET /dashboard/developers/:username -----
  app.get('/dashboard/developers/:username', async (req, reply) => {
    if (!req.dashboardSession) return reply.redirect('/dashboard/login');
    const { username } = req.params as { username: string };
    const detail = await getDeveloperDetail(username);
    reply.type('text/html');
    return render('developer', { user: req.dashboardSession, username, detail, active: 'developers' }, { layout: 'base' });
  });

  // ----- GET /dashboard/activity (live feed) -----
  app.get('/dashboard/activity', async (req, reply) => {
    if (!req.dashboardSession) return reply.redirect('/dashboard/login');
    const recent = await getRecentEvents(50);
    reply.type('text/html');
    return render('activity', { user: req.dashboardSession, recent, active: 'activity' }, { layout: 'base' });
  });

  // ----- GET /v1/dashboard/activity (HTMX partial) -----
  app.get('/v1/dashboard/activity', async (req, reply) => {
    if (!req.dashboardSession) return reply.code(401).send('');
    const recent = await getRecentEvents(20);
    reply.type('text/html');
    return renderPartial('activity-feed', { recent });
  });

  // ----- GET /dashboard/admin/tokens (admin only) -----
  app.get('/dashboard/admin/tokens', async (req, reply) => {
    if (!req.dashboardSession) return reply.redirect('/dashboard/login');
    if (req.dashboardSession.role !== 'admin') return reply.code(403).send('Admin only');
    const allTokens = await db
      .select({ token: tokens, user: users })
      .from(tokens)
      .innerJoin(users, eq(tokens.userId, users.id))
      .orderBy(desc(tokens.createdAt))
      .limit(200);
    reply.type('text/html');
    return render('admin-tokens', { user: req.dashboardSession, tokens: allTokens, active: 'admin-tokens' }, { layout: 'base' });
  });

  // ----- POST /dashboard/admin/tokens (issue) -----
  app.post('/dashboard/admin/tokens', async (req, reply) => {
    if (req.dashboardSession?.role !== 'admin') return reply.code(403).send('Admin only');
    const parsed = IssueTokenSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send('name + password required');
    const { name, password } = parsed.data;
    const user = (await db.select().from(users).where(eq(users.id, req.dashboardSession.userId)).limit(1))[0];
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return reply.code(401).send('Invalid password');
    }
    const token = await issueToken({ userId: user.id, username: user.username, name, ip: req.ip });
    // Render a small page showing the new token once.
    reply.type('text/html');
    return render('admin-token-issued', { user: req.dashboardSession, token }, { layout: 'base' });
  });

  // ----- POST /dashboard/admin/tokens/:id/revoke -----
  app.post<{ Params: { id: string } }>('/dashboard/admin/tokens/:id/revoke', async (req, reply) => {
    if (req.dashboardSession?.role !== 'admin') return reply.code(403).send('Admin only');
    await revokeToken({ tokenId: req.params.id, byUserId: req.dashboardSession.userId, reason: 'admin_revoke' });
    return reply.redirect('/dashboard/admin/tokens');
  });

  // ----- GET /dashboard/admin/users -----
  app.get('/dashboard/admin/users', async (req, reply) => {
    if (req.dashboardSession?.role !== 'admin') return reply.code(403).send('Admin only');
    const allUsers = await db.select().from(users).orderBy(desc(users.createdAt)).limit(500);
    reply.type('text/html');
    return render('admin-users', { user: req.dashboardSession, users: allUsers, active: 'admin-users' }, { layout: 'base' });
  });

  // ----- POST /dashboard/admin/users (create) -----
  app.post('/dashboard/admin/users', async (req, reply) => {
    if (req.dashboardSession?.role !== 'admin') return reply.code(403).send('Admin only');
    const parsed = CreateUserSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.issues.map((i) => i.message).join('; '));
    const { username, email, password, role } = parsed.data;
    const byUsername = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
    const byEmail = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (byUsername.length > 0 || byEmail.length > 0) return reply.code(409).send('User exists');
    const { nanoid } = await import('nanoid');
    await db.insert(users).values({
      id: nanoid(21),
      username,
      email,
      passwordHash: await hashPassword(password),
      role,
    });
    await writeAudit({
      actorUserId: req.dashboardSession.userId,
      actorUsername: req.dashboardSession.username,
      action: 'user.admin_create',
      targetUsername: username,
      metadata: { role },
      ip: req.ip,
    });
    return reply.redirect('/dashboard/admin/users');
  });

  // ----- GET /dashboard/health -----
  app.get('/dashboard/health', async (req, reply) => {
    return { status: 'ok', subsystem: 'dashboard' };
  });

  // ----- GET /dashboard/changes (ROI + change list) -----
  app.get('/dashboard/changes', async (req, reply) => {
    if (!req.dashboardSession) return reply.redirect('/dashboard/login');
    const [roi, changes, byWorkType, timeSaved] = await Promise.all([
      getRoiSummary(),
      listChanges(),
      getRoiByWorkType(),
      getTimeSavedByChange(),
    ]);
    const baselines = await getTimeBaselines();
    reply.type('text/html');
    return render('changes', { user: req.dashboardSession, roi, changes, baselines, byWorkType, timeSaved, active: 'changes' }, { layout: 'base' });
  });

  // ----- GET /dashboard/changes/:name (timeline) -----
  app.get<{ Params: { name: string } }>('/dashboard/changes/:name', async (req, reply) => {
    if (!req.dashboardSession) return reply.redirect('/dashboard/login');
    const name = decodeURIComponent(req.params.name);
    const timeline = await getChangeTimeline(name);
    const changes = await listChanges();
    const change = changes.find((c) => c.changeName === name);
    if (!change) {
      reply.type('text/html');
      return reply.code(404).send('<h1>Change not found</h1>');
    }
    reply.type('text/html');
    return render('change-detail', { user: req.dashboardSession, change, timeline, active: 'changes' }, { layout: 'base' });
  });

  // ----- GET /dashboard/skills -----
  app.get('/dashboard/skills', async (req, reply) => {
    if (!req.dashboardSession) return reply.redirect('/dashboard/login');
    const [adoption, byTool] = await Promise.all([
      getSkillAdoption(),
      db
        .select({ tool: sql<string>`${events.payload}->>'tool'`, c: count() })
        .from(events)
        .where(eq(events.eventType, 'skill.installed'))
        .groupBy(sql`${events.payload}->>'tool'`)
        .orderBy(sql`count(*) desc`),
    ]);
    reply.type('text/html');
      return render('skills', { user: req.dashboardSession, adoption, byTool: byTool.map((r) => ({ tool: r.tool, c: Number(r.c) })), active: 'skills' }, { layout: 'base' });
  });

  // ----- GET /dashboard/admin/settings -----
  app.get('/dashboard/admin/settings', async (req, reply) => {
    if (req.dashboardSession?.role !== 'admin') return reply.code(403).send('Admin only');
    const baselines = await getTimeBaselines();
    reply.type('text/html');
    return render('admin-settings', { user: req.dashboardSession, baselines, active: 'admin-settings' }, { layout: 'base' });
  });

  // ----- POST /dashboard/admin/settings/time-baselines -----
  app.post('/dashboard/admin/settings/time-baselines', async (req, reply) => {
    if (req.dashboardSession?.role !== 'admin') return reply.code(403).send('Admin only');
    const body = req.body as Record<string, string>;
    const updated: Record<string, number> = {};
    for (const [key, value] of Object.entries(body)) {
      if (key.startsWith('baselines[') && key.endsWith(']')) {
        const workType = key.slice('baselines['.length, -1);
        const n = Number(value);
        if (!isNaN(n) && n > 0) updated[workType] = n;
      }
    }
    if (Object.keys(updated).length === 0) {
      return reply.code(400).send('No valid baselines submitted');
    }
    await setTimeBaselines(updated, req.dashboardSession.userId);
    await writeAudit({
      actorUserId: req.dashboardSession.userId,
      actorUsername: req.dashboardSession.username,
      action: 'settings.time_baselines.update',
      metadata: { updated },
      ip: req.ip,
    });
    return reply.redirect('/dashboard/admin/settings');
  });
}
