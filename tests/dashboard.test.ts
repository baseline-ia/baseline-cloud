/**
 * Dashboard route tests — auth-gated HTML/HTMX routes + admin endpoints.
 *
 * Covers: overview, events, developers, developer detail, changes,
 * change detail, skills, activity, admin (tokens, users, settings).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { testDb, schema } from './setup';
import { eq } from 'drizzle-orm';
import { buildApp } from '../src/server';
import type { FastifyInstance } from 'fastify';

async function makeApp(): Promise<FastifyInstance> {
  const app = await buildApp();
  await app.ready();
  return app;
}

async function signupAndGetToken(app: FastifyInstance, username = 'alice'): Promise<{ token: string; cookie: string }> {
  const res = await app.inject({
    method: 'POST',
    url: '/v1/auth/signup',
    payload: { username, email: `${username}@example.com`, password: 'correct-horse-battery' },
  });
  const token = res.json().token.raw as string;

  // Get a dashboard session cookie
  const login = await app.inject({
    method: 'POST',
    url: '/dashboard/login',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    payload: `username=${username}&password=correct-horse-battery`,
  });
  const setCookie = login.headers['set-cookie'];
  const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie!;
  const cookie = cookieStr?.split(';')[0] ?? '';

  return { token, cookie };
}

async function postEvent(app: FastifyInstance, token: string, eventType: string, payload: Record<string, unknown>) {
  return app.inject({
    method: 'POST',
    url: '/v1/events',
    headers: { authorization: `Bearer ${token}` },
    payload: { event_type: eventType, project: 'default', payload },
  });
}

function withCookie(cookie: string) {
  return { headers: { cookie } };
}

// ============================================================================
// Unauthenticated routes
// ============================================================================

describe('Dashboard route — unauthenticated', () => {
  it('GET /dashboard/login returns the login form', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'GET', url: '/dashboard/login' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.body).toContain('Sign in');
  });

  it('GET /dashboard/login redirects to itself if already authenticated', async () => {
    const app = await makeApp();
    const { cookie } = await signupAndGetToken(app, 'alice');
    // Already have a session cookie from signupAndGetToken
    const get2 = await app.inject({ method: 'GET', url: '/dashboard/login', ...withCookie(cookie) });
    expect(get2.statusCode).toBe(302);
    expect(get2.headers.location).toBe('/dashboard/');
  });

  it('GET /dashboard/ redirects to /dashboard/login when no session', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'GET', url: '/dashboard/' });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toMatch(/dashboard\/login/);
  });

  it('GET /dashboard/events redirects to /dashboard/login when no session', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'GET', url: '/dashboard/events' });
    expect(res.statusCode).toBe(302);
  });

  it('GET /dashboard/changes redirects to /dashboard/login when no session', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'GET', url: '/dashboard/changes' });
    expect(res.statusCode).toBe(302);
  });

  it('GET /dashboard/developers redirects to /dashboard/login when no session', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'GET', url: '/dashboard/developers' });
    expect(res.statusCode).toBe(302);
  });

  it('GET /dashboard/skills redirects to /dashboard/login when no session', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'GET', url: '/dashboard/skills' });
    expect(res.statusCode).toBe(302);
  });

  it('GET /dashboard/admin/tokens redirects non-admin to login', async () => {
    const app = await makeApp();
    // No cookie → redirect to login
    const res = await app.inject({ method: 'GET', url: '/dashboard/admin/tokens' });
    expect(res.statusCode).toBe(302);
  });

  it('GET /dashboard/admin/settings returns 403 for non-admin', async () => {
    const app = await makeApp();
    // Create a non-admin user
    await app.inject({
      method: 'POST',
      url: '/v1/auth/signup',
      payload: { username: 'first', email: 'first@example.com', password: 'correct-horse-battery' },
    });
    await app.inject({
      method: 'POST',
      url: '/v1/auth/signup',
      payload: { username: 'second', email: 'second@example.com', password: 'correct-horse-battery' },
    });
    const login = await app.inject({
      method: 'POST',
      url: '/dashboard/login',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'username=second&password=correct-horse-battery',
    });
    const cookie = (login.headers['set-cookie'] as string)?.split(';')[0] ?? '';
    const res = await app.inject({ method: 'GET', url: '/dashboard/admin/settings', ...withCookie(cookie) });
    expect(res.statusCode).toBe(403);
  });

  it('GET /dashboard/health returns ok', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'GET', url: '/dashboard/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', subsystem: 'dashboard' });
  });
});

// ============================================================================
// Authenticated routes — overview, events, developers, changes
// ============================================================================

describe('GET /dashboard/ (overview)', () => {
  it('renders overview with stats', async () => {
    const app = await makeApp();
    const { token, cookie } = await signupAndGetToken(app, 'alice');
    await postEvent(app, token, 'cli.install', { os: 'darwin' });
    await postEvent(app, token, 'cli.doctor', { success: true });

    const res = await app.inject({ method: 'GET', url: '/dashboard/', ...withCookie(cookie) });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('Overview');
    expect(res.body).toContain('2'); // 2 total events
    expect(res.body).toContain('alice'); // username in nav
  });
});

describe('GET /dashboard/events (browser)', () => {
  it('renders the events browser with events', async () => {
    const app = await makeApp();
    const { token, cookie } = await signupAndGetToken(app, 'alice');
    await postEvent(app, token, 'cli.install', { os: 'darwin' });
    await postEvent(app, token, 'change.open', { changeName: 'x', workType: 'feature' });

    const res = await app.inject({ method: 'GET', url: '/dashboard/events', ...withCookie(cookie) });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('Events');
    expect(res.body).toContain('cli.install');
    expect(res.body).toContain('change.open');
  });
});

describe('GET /dashboard/developers', () => {
  // alice = first signup = admin role
  it('lists developers with their activity (admin)', async () => {
    const app = await makeApp();
    const { token, cookie } = await signupAndGetToken(app, 'alice');
    await postEvent(app, token, 'cli.install', { os: 'darwin' });
    await postEvent(app, token, 'cli.doctor', { success: true });

    const res = await app.inject({ method: 'GET', url: '/dashboard/developers', ...withCookie(cookie) });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('Developers');
    expect(res.body).toContain('alice');
  });

  it('redirects non-admin to /dashboard', async () => {
    const app = await makeApp();
    // alice signs up first → becomes admin
    await app.inject({
      method: 'POST',
      url: '/v1/auth/signup',
      payload: { username: 'alice', email: 'alice@example.com', password: 'correct-horse-battery' },
    });
    // bob signs up second → non-admin (member)
    await app.inject({
      method: 'POST',
      url: '/v1/auth/signup',
      payload: { username: 'bob', email: 'bob@example.com', password: 'correct-horse-battery' },
    });
    const login = await app.inject({
      method: 'POST',
      url: '/dashboard/login',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'username=bob&password=correct-horse-battery',
    });
    const setCookie = login.headers['set-cookie'];
    const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie!;
    const bobCookie = cookieStr?.split(';')[0] ?? '';

    const res = await app.inject({
      method: 'GET',
      url: '/dashboard/developers',
      headers: { cookie: bobCookie },
    });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/dashboard');
  });
});

describe('GET /dashboard/developers/:username', () => {
  it('renders a developer detail page', async () => {
    const app = await makeApp();
    const { token, cookie } = await signupAndGetToken(app, 'alice');
    await postEvent(app, token, 'cli.install', { os: 'darwin' });
    await postEvent(app, token, 'cli.doctor', { success: true, checksPassed: 5, checksFailed: 0 });

    const res = await app.inject({ method: 'GET', url: '/dashboard/developers/alice', ...withCookie(cookie) });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('alice');
    expect(res.body).toContain('Stats');
  });
});

describe('GET /dashboard/changes (ROI summary)', () => {
  it('renders ROI summary + change list', async () => {
    const app = await makeApp();
    const { token, cookie } = await signupAndGetToken(app, 'alice');

    // Open + close a change with per-change estimate
    await postEvent(app, token, 'change.open', {
      changeName: 'add-feat', workType: 'feature', estimateMin: 480, estimateSource: 'per-change',
    });
    await postEvent(app, token, 'change.close', {
      changeName: 'add-feat', workType: 'feature', totalCommits: 5, durationMs: 240 * 60 * 1000, verdict: 'pass',
    });

    const res = await app.inject({ method: 'GET', url: '/dashboard/changes', ...withCookie(cookie) });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('Changes & ROI');
    expect(res.body).toContain('add-feat');
    expect(res.body).toContain('plan'); // label for per-change estimate
  });
});

describe('GET /dashboard/changes/:name (timeline)', () => {
  it('renders the change timeline', async () => {
    const app = await makeApp();
    const { token, cookie } = await signupAndGetToken(app, 'alice');
    await postEvent(app, token, 'change.open', {
      changeName: 'my-feat', workType: 'feature', estimateMin: 240, estimateSource: 'per-change',
    });
    await postEvent(app, token, 'change.commit', {
      changeName: 'my-feat', sha: 'aaaaaaa', shortSha: 'aaa', message: 'init',
      filesChanged: 1, linesAdded: 10, linesRemoved: 0,
    });
    await postEvent(app, token, 'change.close', {
      changeName: 'my-feat', workType: 'feature', totalCommits: 1, durationMs: 60 * 60 * 1000, verdict: 'pass',
    });

    const res = await app.inject({ method: 'GET', url: '/dashboard/changes/my-feat', ...withCookie(cookie) });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('my-feat');
    expect(res.body).toContain('Opened');
    expect(res.body).toContain('Closed');
  });

  it('returns 404 for unknown change', async () => {
    const app = await makeApp();
    const { cookie } = await signupAndGetToken(app, 'alice');
    const res = await app.inject({ method: 'GET', url: '/dashboard/changes/does-not-exist', ...withCookie(cookie) });
    expect(res.statusCode).toBe(404);
  });
});

describe('GET /dashboard/skills (adoption matrix)', () => {
  it('renders skills with adopters count', async () => {
    const app = await makeApp();
    const { token, cookie } = await signupAndGetToken(app, 'alice');
    await postEvent(app, token, 'skill.installed', { skillName: 'commit', tool: 'claude' });
    await postEvent(app, token, 'skill.installed', { skillName: 'review', tool: 'claude' });

    const res = await app.inject({ method: 'GET', url: '/dashboard/skills', ...withCookie(cookie) });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('Skills adoption');
    expect(res.body).toContain('commit');
    expect(res.body).toContain('review');
  });
});

describe('GET /dashboard/activity (live feed)', () => {
  it('renders the activity page with htmx auto-refresh', async () => {
    const app = await makeApp();
    const { token, cookie } = await signupAndGetToken(app, 'alice');
    await postEvent(app, token, 'cli.install', { os: 'darwin' });

    const res = await app.inject({ method: 'GET', url: '/dashboard/activity', ...withCookie(cookie) });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('Activity');
    expect(res.body).toContain('hx-get');
    expect(res.body).toContain('every 5s');
  });
});

describe('GET /v1/dashboard/activity (HTMX partial)', () => {
  it('returns the activity feed fragment', async () => {
    const app = await makeApp();
    const { token, cookie } = await signupAndGetToken(app, 'alice');
    await postEvent(app, token, 'cli.install', { os: 'darwin' });

    const res = await app.inject({ method: 'GET', url: '/v1/dashboard/activity', ...withCookie(cookie) });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('cli.install');
  });
});

// ============================================================================
// Admin routes
// ============================================================================

describe('GET /dashboard/admin/tokens', () => {
  it('lists tokens for admin', async () => {
    const app = await makeApp();
    const { cookie } = await signupAndGetToken(app, 'alice'); // first user = admin
    const res = await app.inject({ method: 'GET', url: '/dashboard/admin/tokens', ...withCookie(cookie) });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('Admin · Tokens');
    expect(res.body).toContain('bootstrap'); // the token issued at signup
  });
});

describe('POST /dashboard/admin/tokens (issue new)', () => {
  it('issues a new token when admin provides a valid password', async () => {
    const app = await makeApp();
    const { cookie } = await signupAndGetToken(app, 'alice');
    const res = await app.inject({
      method: 'POST',
      url: '/dashboard/admin/tokens',
      ...withCookie(cookie),
      headers: { ...withCookie(cookie).headers, 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'name=CLI-2&password=correct-horse-battery',
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('Token issued');
    expect(res.body).toMatch(/[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/); // token raw format
    // The new token should now be in the DB
    const tokens = await testDb.select().from(schema.tokens);
    expect(tokens.length).toBe(2); // bootstrap + CLI-2
  });

  it('rejects with 401 when password is wrong', async () => {
    const app = await makeApp();
    const { cookie } = await signupAndGetToken(app, 'alice');
    const res = await app.inject({
      method: 'POST',
      url: '/dashboard/admin/tokens',
      ...withCookie(cookie),
      headers: { ...withCookie(cookie).headers, 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'name=CLI&password=wrong',
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('POST /dashboard/admin/tokens/:id/revoke', () => {
  it('revokes a token', async () => {
    const app = await makeApp();
    const { cookie, token } = await signupAndGetToken(app, 'alice');
    const [t] = await testDb.select().from(schema.tokens);
    expect(t?.tokenPrefix).toBeTruthy();

    const res = await app.inject({
      method: 'POST',
      url: `/dashboard/admin/tokens/${t!.id}/revoke`,
      ...withCookie(cookie),
    });
    expect(res.statusCode).toBe(302);

    // The token should now be revoked
    const [revoked] = await testDb.select().from(schema.tokens).where(eq(schema.tokens.id, t!.id));
    expect(revoked?.revokedAt).toBeTruthy();

    // And the bearer should no longer work
    const after = await app.inject({
      method: 'POST',
      url: '/v1/events',
      headers: { authorization: `Bearer ${token}` },
      payload: { event_type: 'cli.install', project: 'default', payload: {} },
    });
    expect(after.statusCode).toBe(401);
  });
});

describe('GET /dashboard/admin/users', () => {
  it('lists users for admin', async () => {
    const app = await makeApp();
    const { cookie } = await signupAndGetToken(app, 'alice');
    await app.inject({
      method: 'POST',
      url: '/v1/auth/signup',
      payload: { username: 'bob', email: 'bob@example.com', password: 'correct-horse-battery' },
    });

    const res = await app.inject({ method: 'GET', url: '/dashboard/admin/users', ...withCookie(cookie) });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('Admin · Users');
    expect(res.body).toContain('alice');
    expect(res.body).toContain('bob');
  });
});

describe('POST /dashboard/admin/users (create)', () => {
  it('creates a new user as admin', async () => {
    const app = await makeApp();
    const { cookie } = await signupAndGetToken(app, 'alice');
    const res = await app.inject({
      method: 'POST',
      url: '/dashboard/admin/users',
      ...withCookie(cookie),
      headers: { ...withCookie(cookie).headers, 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'username=carol&email=carol@example.com&password=correct-horse-battery&role=member',
    });
    expect(res.statusCode).toBe(302);

    const [carol] = await testDb.select().from(schema.users).where(eq(schema.users.username, 'carol'));
    expect(carol?.role).toBe('member');
  });

  it('rejects duplicate user', async () => {
    const app = await makeApp();
    const { cookie } = await signupAndGetToken(app, 'alice');
    await app.inject({
      method: 'POST',
      url: '/dashboard/admin/users',
      ...withCookie(cookie),
      headers: { ...withCookie(cookie).headers, 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'username=alice&email=other@example.com&password=correct-horse-battery&role=member',
    });
    const res = await app.inject({
      method: 'POST',
      url: '/dashboard/admin/users',
      ...withCookie(cookie),
      headers: { ...withCookie(cookie).headers, 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'username=alice&email=other@example.com&password=correct-horse-battery&role=member',
    });
    expect(res.statusCode).toBe(409);
  });
});

describe('GET /dashboard/admin/settings', () => {
  it('renders the time baselines form for admin', async () => {
    const app = await makeApp();
    const { cookie } = await signupAndGetToken(app, 'alice');
    const res = await app.inject({ method: 'GET', url: '/dashboard/admin/settings', ...withCookie(cookie) });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('Time baselines');
    expect(res.body).toContain('baselines[feature]');
    expect(res.body).toContain('480'); // default value rendered
  });
});

describe('POST /dashboard/admin/settings/time-baselines', () => {
  it('persists admin overrides', async () => {
    const app = await makeApp();
    const { cookie } = await signupAndGetToken(app, 'alice');
    const res = await app.inject({
      method: 'POST',
      url: '/dashboard/admin/settings/time-baselines',
      ...withCookie(cookie),
      headers: { ...withCookie(cookie).headers, 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'baselines[feature]=1000&baselines[fix]=50',
    });
    expect(res.statusCode).toBe(302);

    const [setting] = await testDb.select().from(schema.settings);
    expect(setting?.key).toBe('time_baselines_min');
    const stored = setting?.value as Record<string, number>;
    expect(stored.feature).toBe(1000);
    expect(stored.fix).toBe(50);
  });

  it('rejects 400 if no valid baselines submitted', async () => {
    const app = await makeApp();
    const { cookie } = await signupAndGetToken(app, 'alice');
    const res = await app.inject({
      method: 'POST',
      url: '/dashboard/admin/settings/time-baselines',
      ...withCookie(cookie),
      headers: { ...withCookie(cookie).headers, 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'unrelated=foo',
    });
    expect(res.statusCode).toBe(400);
  });
});

// ============================================================================
// Health
// ============================================================================

describe('GET /health', () => {
  it('returns ok', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok', service: 'baseline-cloud' });
  });
});
