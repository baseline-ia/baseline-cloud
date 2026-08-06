import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users, tokens } from '../db/schema.js';
import { hashPassword, verifyPassword, issueToken, revokeToken, writeAudit } from '../auth/index.js';
import { config } from '../config.js';

const SignupSchema = z.object({
  username: z.string().min(3).max(64).regex(/^[a-z0-9_-]+$/i, 'Username: letters, numbers, underscore, dash only'),
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  tokenName: z.string().min(1).max(64).optional(),
});

const LoginSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(128),
});

const IssueTokenSchema = z.object({
  name: z.string().min(1).max(64).default('CLI'),
  password: z.string().min(1).max(128), // require password to re-issue
});

export async function registerAuthRoutes(app: FastifyInstance) {
  // ----- POST /v1/auth/signup -----
  app.post('/v1/auth/signup', async (req, reply) => {
    const parsed = SignupSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error_class: 'validation',
        error_code: 'invalid_input',
        error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      });
    }
    const { username, email, password, tokenName } = parsed.data;

    // First user becomes admin automatically (if BOOTSTRAP_ADMIN=true).
    const userCountRow = await db.select({ id: users.id }).from(users).limit(1);
    const isFirstUser = userCountRow.length === 0;
    if (isFirstUser && !config.BOOTSTRAP_ADMIN) {
      return reply.code(403).send({
        error_class: 'policy',
        error_code: 'bootstrap_disabled',
        error: 'BOOTSTRAP_ADMIN must be enabled for the first signup',
      });
    }

    // Uniqueness check (defense in depth — DB unique constraints will also catch this).
    const byUsername = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
    const byEmail = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (byUsername.length > 0 || byEmail.length > 0) {
      return reply.code(409).send({
        error_class: 'conflict',
        error_code: 'user_exists',
        error: 'Username or email already taken',
      });
    }

    const userId = nanoid(21);
    const passwordHash = await hashPassword(password);

    await db.insert(users).values({
      id: userId,
      username,
      email,
      passwordHash,
      role: isFirstUser ? 'admin' : 'member',
    });

    await writeAudit({
      actorUserId: userId,
      actorUsername: username,
      action: 'user.signup',
      targetUserId: userId,
      targetUsername: username,
      metadata: { isFirstUser, role: isFirstUser ? 'admin' : 'member' },
      ip: req.ip,
    });

    const token = await issueToken({
      userId,
      username,
      name: tokenName ?? (isFirstUser ? 'bootstrap' : 'signup'),
      ip: req.ip,
    });

    return reply.code(201).send({
      user: { id: userId, username, email, role: isFirstUser ? 'admin' : 'member' },
      token: { id: token.id, raw: token.raw, prefix: token.prefix, name: token.name },
      warning: isFirstUser
        ? 'You are the first user — your account is admin. Set BOOTSTRAP_ADMIN=false after other admins exist.'
        : undefined,
    });
  });

  // ----- POST /v1/auth/login -----
  app.post('/v1/auth/login', async (req, reply) => {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error_class: 'validation', error_code: 'invalid_input', error: 'username + password required' });
    }
    const { username, password } = parsed.data;

    const rows = await db.select().from(users).where(eq(users.username, username)).limit(1);
    const user = rows[0];
    if (!user || !user.enabled) {
      return reply.code(401).send({ error_class: 'auth', error_code: 'invalid_credentials', error: 'Invalid username or password' });
    }
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      await writeAudit({
        actorUserId: user.id,
        actorUsername: user.username,
        action: 'login.failed',
        ip: req.ip,
      });
      return reply.code(401).send({ error_class: 'auth', error_code: 'invalid_credentials', error: 'Invalid username or password' });
    }

    await db.update(users).set({ lastLoginAt: new Date(), updatedAt: new Date() }).where(eq(users.id, user.id));

    await writeAudit({
      actorUserId: user.id,
      actorUsername: user.username,
      action: 'login.success',
      ip: req.ip,
    });

    // Return user's active tokens (without raw — the CLI logs in once and gets its own token).
    const userTokens = await db
      .select()
      .from(tokens)
      .where(eq(tokens.userId, user.id));

    return reply.send({
      user: { id: user.id, username: user.username, email: user.email, role: user.role },
      tokens: userTokens.map((t) => ({
        id: t.id,
        prefix: t.tokenPrefix,
        name: t.name,
        createdAt: t.createdAt,
        lastUsedAt: t.lastUsedAt,
        revokedAt: t.revokedAt,
      })),
      // Hint: the CLI should call /v1/auth/token to get a fresh bearer token.
      token_issue: 'POST /v1/auth/token with { name, password } to issue a new bearer token',
    });
  });

  // ----- POST /v1/auth/token (issue new bearer token; requires password) -----
  app.post('/v1/auth/token', async (req, reply) => {
    const parsed = IssueTokenSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error_class: 'validation', error_code: 'invalid_input', error: 'name + password required' });
    }
    const { name, password } = parsed.data;
    const user = req.dashboardSession
      ? (await db.select().from(users).where(eq(users.id, req.dashboardSession.userId)).limit(1))[0]
      : null;
    if (!user) {
      return reply.code(401).send({ error_class: 'auth', error_code: 'session_required', error: 'Dashboard session or basic auth required' });
    }
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      return reply.code(401).send({ error_class: 'auth', error_code: 'invalid_credentials', error: 'Invalid password' });
    }
    const token = await issueToken({ userId: user.id, username: user.username, name, ip: req.ip });
    return reply.send({ id: token.id, raw: token.raw, prefix: token.prefix, name: token.name });
  });

  // ----- POST /v1/auth/logout (revoke current bearer) -----
  app.post('/v1/auth/logout', { preHandler: [app.authenticate] }, async (req, reply) => {
    if (!req.authToken) {
      return reply.code(401).send({ error_class: 'auth', error_code: 'token_required' });
    }
    await revokeToken({ tokenId: req.authToken.tokenId, byUserId: req.authToken.userId, reason: 'logout' });
    return reply.send({ ok: true });
  });
}

// Fastify decorator to register auth
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: any, reply: any) => Promise<void>;
  }
}
