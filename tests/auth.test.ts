/**
 * Auth tests — pure helpers + HTTP flow.
 */
import { describe, it, expect } from 'vitest';
import { testDb, testSql, schema } from './setup';
import { eq } from 'drizzle-orm';
import { buildApp } from '../src/server';
import {
  hashPassword,
  verifyPassword,
  hashToken,
  issueToken,
  resolveBearerToken,
  revokeToken,
  createSession,
  resolveSession,
  destroySession,
} from '../src/auth';
import type { FastifyInstance } from 'fastify';

async function makeApp(): Promise<FastifyInstance> {
  const app = await buildApp();
  await app.ready();
  return app;
}

// ============================================================================
// Pure helpers
// ============================================================================

describe('hashPassword / verifyPassword', () => {
  it('hashes and verifies a password', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    expect(hash).not.toBe('correct-horse-battery-staple');
    expect(hash.length).toBeGreaterThan(50);
    expect(await verifyPassword('correct-horse-battery-staple', hash)).toBe(true);
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });

  it('produces a different hash for the same input each time (bcrypt salt)', async () => {
    const h1 = await hashPassword('same-password');
    const h2 = await hashPassword('same-password');
    expect(h1).not.toBe(h2);
  });
});

describe('hashToken', () => {
  it('is deterministic for the same raw token (HMAC with pepper)', () => {
    const raw = 'prefix.secret';
    expect(hashToken(raw)).toBe(hashToken(raw));
  });

  it('produces a different hash for different raw tokens', () => {
    expect(hashToken('a.b')).not.toBe(hashToken('a.c'));
  });
});

// ============================================================================
// HTTP flow
// ============================================================================

describe('POST /v1/auth/signup', () => {
  it('creates a user, issues a token, marks first user as admin', async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/signup',
      payload: { username: 'alice', email: 'alice@example.com', password: 'correct-horse-battery' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.user.role).toBe('admin');
    expect(body.user.username).toBe('alice');
    expect(body.token.raw).toBeTruthy();
    expect(body.token.prefix).toBeTruthy();
    expect(body.warning).toMatch(/first user/);

    // Verify the user is in the DB
    const users = await testDb.select().from(schema.users).where(eq(schema.users.username, 'alice'));
    expect(users.length).toBe(1);
    expect(users[0]?.role).toBe('admin');
    expect(users[0]?.passwordHash).not.toBe('correct-horse-battery');
    expect(await verifyPassword('correct-horse-battery', users[0]!.passwordHash)).toBe(true);

    // Verify the token is in the DB
    const tokens = await testDb.select().from(schema.tokens);
    expect(tokens.length).toBe(1);
    expect(tokens[0]?.tokenPrefix).toBe(body.token.prefix);
    expect(tokens[0]?.revokedAt).toBeNull();
  });

  it('creates a non-admin user when others exist', async () => {
    const app = await makeApp();
    // First user
    await app.inject({
      method: 'POST',
      url: '/v1/auth/signup',
      payload: { username: 'first', email: 'first@example.com', password: 'correct-horse-battery' },
    });
    // Second user
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/signup',
      payload: { username: 'second', email: 'second@example.com', password: 'correct-horse-battery' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().user.role).toBe('member');
    expect(res.json().warning).toBeUndefined();
  });

  it('rejects duplicate username', async () => {
    const app = await makeApp();
    await app.inject({
      method: 'POST',
      url: '/v1/auth/signup',
      payload: { username: 'alice', email: 'alice@example.com', password: 'correct-horse-battery' },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/signup',
      payload: { username: 'alice', email: 'different@example.com', password: 'correct-horse-battery' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('rejects duplicate email', async () => {
    const app = await makeApp();
    await app.inject({
      method: 'POST',
      url: '/v1/auth/signup',
      payload: { username: 'alice', email: 'alice@example.com', password: 'correct-horse-battery' },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/signup',
      payload: { username: 'different', email: 'alice@example.com', password: 'correct-horse-battery' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('rejects short password', async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/signup',
      payload: { username: 'alice', email: 'alice@example.com', password: 'short' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects invalid username (special chars)', async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/signup',
      payload: { username: 'ali ce!', email: 'alice@example.com', password: 'correct-horse-battery' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /v1/auth/login', () => {
  it('returns user info and existing tokens for a valid login', async () => {
    const app = await makeApp();
    await app.inject({
      method: 'POST',
      url: '/v1/auth/signup',
      payload: { username: 'alice', email: 'alice@example.com', password: 'correct-horse-battery' },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { username: 'alice', password: 'correct-horse-battery' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user.username).toBe('alice');
    expect(body.tokens).toHaveLength(1);
    expect(body.tokens[0].prefix).toBeTruthy();
  });

  it('rejects wrong password', async () => {
    const app = await makeApp();
    await app.inject({
      method: 'POST',
      url: '/v1/auth/signup',
      payload: { username: 'alice', email: 'alice@example.com', password: 'correct-horse-battery' },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { username: 'alice', password: 'wrong-password' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects unknown user', async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { username: 'nobody', password: 'whatever' },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('Bearer token resolution (issue + resolve + revoke)', () => {
  it('issueToken returns a token that resolveBearerToken accepts', async () => {
    const app = await makeApp();
    const signup = await app.inject({
      method: 'POST',
      url: '/v1/auth/signup',
      payload: { username: 'alice', email: 'alice@example.com', password: 'correct-horse-battery' },
    });
    const token = signup.json().token.raw;

    const resolved = await resolveBearerToken(token);
    expect(resolved).not.toBeNull();
    expect(resolved!.username).toBe('alice');
    expect(resolved!.role).toBe('admin');
  });

  it('resolveBearerToken returns null for invalid token', async () => {
    expect(await resolveBearerToken('invalid.token')).toBeNull();
    expect(await resolveBearerToken('not-a-token')).toBeNull();
    expect(await resolveBearerToken('')).toBeNull();
  });

  it('revokeToken makes the token invalid', async () => {
    const app = await makeApp();
    const signup = await app.inject({
      method: 'POST',
      url: '/v1/auth/signup',
      payload: { username: 'alice', email: 'alice@example.com', password: 'correct-horse-battery' },
    });
    const body = signup.json();
    const token = body.token.raw;

    expect(await resolveBearerToken(token)).not.toBeNull();

    // Log in to create a dashboard session, then revoke via the token route
    // Actually simpler: revoke directly via the function
    await revokeToken({ tokenId: body.token.id, byUserId: body.user.id, reason: 'test' });
    expect(await resolveBearerToken(token)).toBeNull();
  });

  it('disabled user cannot resolve their token', async () => {
    const app = await makeApp();
    const signup = await app.inject({
      method: 'POST',
      url: '/v1/auth/signup',
      payload: { username: 'alice', email: 'alice@example.com', password: 'correct-horse-battery' },
    });
    const body = signup.json();
    const token = body.token.raw;

    // Disable the user
    await testDb.update(schema.users).set({ enabled: false }).where(eq(schema.users.id, body.user.id));

    expect(await resolveBearerToken(token)).toBeNull();
  });
});

describe('Dashboard session (create + resolve + destroy)', () => {
  it('createSession returns a cookie that resolveSession accepts', async () => {
    const app = await makeApp();
    const signup = await app.inject({
      method: 'POST',
      url: '/v1/auth/signup',
      payload: { username: 'alice', email: 'alice@example.com', password: 'correct-horse-battery' },
    });
    const userId = signup.json().user.id;

    const { cookieValue, session } = await createSession(userId);
    expect(cookieValue).toContain('.');
    expect(session.userId).toBe(userId);

    const resolved = await resolveSession(cookieValue);
    expect(resolved).not.toBeNull();
    expect(resolved!.userId).toBe(userId);
  });

  it('resolveSession returns null for tampered cookie', async () => {
    const app = await makeApp();
    const signup = await app.inject({
      method: 'POST',
      url: '/v1/auth/signup',
      payload: { username: 'alice', email: 'alice@example.com', password: 'correct-horse-battery' },
    });
    const userId = signup.json().user.id;
    const { cookieValue } = await createSession(userId);

    // Tamper with the signature
    const [body, sig] = cookieValue.split('.');
    const tampered = `${body}.${'a'.repeat(sig!.length)}`;
    expect(await resolveSession(tampered)).toBeNull();
  });

  it('destroySession makes the cookie invalid', async () => {
    const app = await makeApp();
    const signup = await app.inject({
      method: 'POST',
      url: '/v1/auth/signup',
      payload: { username: 'alice', email: 'alice@example.com', password: 'correct-horse-battery' },
    });
    const userId = signup.json().user.id;
    const { cookieValue, session } = await createSession(userId);

    expect(await resolveSession(cookieValue)).not.toBeNull();
    await destroySession(session.id);
    expect(await resolveSession(cookieValue)).toBeNull();
  });
});

describe('POST /dashboard/login (HTTP form)', () => {
  it('sets the session cookie and redirects to /dashboard/', async () => {
    const app = await makeApp();
    await app.inject({
      method: 'POST',
      url: '/v1/auth/signup',
      payload: { username: 'alice', email: 'alice@example.com', password: 'correct-horse-battery' },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/dashboard/login',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'username=alice&password=correct-horse-battery',
    });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/dashboard/');
    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeTruthy();
    const cookieStr = Array.isArray(setCookie) ? setCookie.join(';') : setCookie!;
    expect(cookieStr).toMatch(/baseline_dashboard_session=/);
  });

  it('rejects invalid credentials with 401', async () => {
    const app = await makeApp();
    await app.inject({
      method: 'POST',
      url: '/v1/auth/signup',
      payload: { username: 'alice', email: 'alice@example.com', password: 'correct-horse-battery' },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/dashboard/login',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'username=alice&password=wrong',
    });
    expect(res.statusCode).toBe(401);
  });
});
