/**
 * Events tests — ingest (single + batch), validation, auth.
 */
import { describe, it, expect } from 'vitest';
import { testDb, schema } from './setup';
import { eq, count } from 'drizzle-orm';
import { buildApp } from '../src/server';
import type { FastifyInstance } from 'fastify';

async function makeApp(): Promise<FastifyInstance> {
  const app = await buildApp();
  await app.ready();
  return app;
}

async function signupAndToken(app: FastifyInstance, username = 'alice'): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/v1/auth/signup',
    payload: { username, email: `${username}@example.com`, password: 'correct-horse-battery' },
  });
  return res.json().token.raw as string;
}

describe('POST /v1/events (single)', () => {
  it('accepts a valid event and persists it', async () => {
    const app = await makeApp();
    const token = await signupAndToken(app);

    const res = await app.inject({
      method: 'POST',
      url: '/v1/events',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        event_type: 'cli.install',
        project: 'default',
        payload: { os: 'darwin', nodeVersion: 'v20.0.0' },
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.id).toBeTruthy();

    const rows = await testDb.select().from(schema.events);
    expect(rows.length).toBe(1);
    expect(rows[0]?.eventType).toBe('cli.install');
    expect(rows[0]?.project).toBe('default');
    expect((rows[0]?.payload as any).os).toBe('darwin');
  });

  it('rejects missing Authorization header', async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/events',
      payload: { event_type: 'cli.install', project: 'default', payload: {} },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects invalid bearer token', async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/events',
      headers: { authorization: 'Bearer not-a-real-token' },
      payload: { event_type: 'cli.install', project: 'default', payload: {} },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects malformed Authorization header', async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/events',
      headers: { authorization: 'NotBearer foo' },
      payload: { event_type: 'cli.install', project: 'default', payload: {} },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects unknown event_type', async () => {
    const app = await makeApp();
    const token = await signupAndToken(app);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/events',
      headers: { authorization: `Bearer ${token}` },
      payload: { event_type: 'cli.bogus', project: 'default', payload: {} },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects missing event_type', async () => {
    const app = await makeApp();
    const token = await signupAndToken(app);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/events',
      headers: { authorization: `Bearer ${token}` },
      payload: { project: 'default', payload: {} },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects empty project', async () => {
    const app = await makeApp();
    const token = await signupAndToken(app);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/events',
      headers: { authorization: `Bearer ${token}` },
      payload: { event_type: 'cli.install', project: '', payload: {} },
    });
    expect(res.statusCode).toBe(400);
  });

  it('defaults project to "default" when omitted', async () => {
    const app = await makeApp();
    const token = await signupAndToken(app);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/events',
      headers: { authorization: `Bearer ${token}` },
      payload: { event_type: 'cli.install', payload: {} },
    });
    expect(res.statusCode).toBe(201);
    const rows = await testDb.select().from(schema.events);
    expect(rows[0]?.project).toBe('default');
  });

  it('accepts a change.open event with estimate (the ROI pipeline)', async () => {
    const app = await makeApp();
    const token = await signupAndToken(app);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/events',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        event_type: 'change.open',
        project: 'default',
        payload: {
          changeName: 'add-railway-deploy',
          workType: 'feature',
          estimateMin: 480,
          estimateBucket: 'large',
          estimateSource: 'bucket',
        },
      },
    });
    expect(res.statusCode).toBe(201);

    const rows = await testDb.select().from(schema.events);
    const payload = rows[0]?.payload as any;
    expect(payload.changeName).toBe('add-railway-deploy');
    expect(payload.estimateMin).toBe(480);
    expect(payload.estimateBucket).toBe('large');
  });
});

describe('POST /v1/events/batch', () => {
  it('ingests multiple events in a single request', async () => {
    const app = await makeApp();
    const token = await signupAndToken(app);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/events/batch',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        events: [
          { event_type: 'cli.install', project: 'default', payload: { os: 'darwin' } },
          { event_type: 'cli.doctor', project: 'default', payload: { checksPassed: 5, checksFailed: 0 } },
          { event_type: 'cli.update', project: 'default', payload: { fromVersion: '0.1.0', toVersion: '0.1.1' } },
        ],
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.ids).toHaveLength(3);

    const [{ value }] = await testDb.select({ value: count() }).from(schema.events);
    expect(value).toBe(3);
  });

  it('rejects empty batch', async () => {
    const app = await makeApp();
    const token = await signupAndToken(app);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/events/batch',
      headers: { authorization: `Bearer ${token}` },
      payload: { events: [] },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects batch with > 100 events', async () => {
    const app = await makeApp();
    const token = await signupAndToken(app);
    const events = Array.from({ length: 101 }, (_, i) => ({
      event_type: 'cli.install' as const,
      project: 'default',
      payload: { i },
    }));
    const res = await app.inject({
      method: 'POST',
      url: '/v1/events/batch',
      headers: { authorization: `Bearer ${token}` },
      payload: { events },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /v1/auth/logout', () => {
  it('revokes the bearer token so it can no longer ingest', async () => {
    const app = await makeApp();
    const token = await signupAndToken(app);

    // Sanity: the token works
    const before = await app.inject({
      method: 'POST',
      url: '/v1/events',
      headers: { authorization: `Bearer ${token}` },
      payload: { event_type: 'cli.install', project: 'default', payload: {} },
    });
    expect(before.statusCode).toBe(201);

    // Logout
    const logout = await app.inject({
      method: 'POST',
      url: '/v1/auth/logout',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(logout.statusCode).toBe(200);

    // Now the token should not work
    const after = await app.inject({
      method: 'POST',
      url: '/v1/events',
      headers: { authorization: `Bearer ${token}` },
      payload: { event_type: 'cli.install', project: 'default', payload: {} },
    });
    expect(after.statusCode).toBe(401);
  });
});
