import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { resolveBearerToken, resolveSession, type ResolvedToken, type DashboardSession } from './index.js';

declare module 'fastify' {
  interface FastifyRequest {
    authToken?: ResolvedToken;
    dashboardSession?: DashboardSession;
  }
}

const BEARER_RE = /^Bearer (.+)$/;

export async function requireBearerToken(req: FastifyRequest, reply: FastifyReply) {
  const header = req.headers.authorization;
  if (!header) {
    reply.code(401).send({ error_class: 'auth', error_code: 'missing_token', error: 'Authorization header required' });
    return reply;
  }
  const match = BEARER_RE.exec(header);
  if (!match || !match[1]) {
    reply.code(401).send({ error_class: 'auth', error_code: 'malformed_token', error: 'Authorization header must be "Bearer <token>"' });
    return reply;
  }
  const resolved = await resolveBearerToken(match[1]);
  if (!resolved) {
    reply.code(401).send({ error_class: 'auth', error_code: 'invalid_token', error: 'Token is invalid, revoked, or user is disabled' });
    return reply;
  }
  req.authToken = resolved;
}

export async function requireDashboardSession(req: FastifyRequest, reply: FastifyReply) {
  const cookies = req.cookies as Record<string, string> | undefined;
  const cookie = cookies?.['baseline_dashboard_session'];
  const session = await resolveSession(cookie);
  if (!session) {
    if (req.url.startsWith('/v1/')) {
      reply.code(401).send({ error_class: 'auth', error_code: 'session_required', error: 'Dashboard session required' });
    } else {
      reply.redirect(`/dashboard/login?next=${encodeURIComponent(req.url)}`);
    }
    return reply;
  }
  req.dashboardSession = session;
}

export async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  if (req.dashboardSession?.role !== 'admin') {
    reply.code(403).send({ error_class: 'auth', error_code: 'admin_required', error: 'Admin role required' });
    return reply;
  }
}

export function registerAuthMiddleware(app: FastifyInstance) {
  // Bearer-token auth for /v1/* (API consumed by the CLI)
  app.addHook('preHandler', async (req, reply) => {
    if (!req.url.startsWith('/v1/events')) return;
    await requireBearerToken(req, reply);
  });

  // Dashboard session auth for /dashboard/* (except /dashboard/login) and /v1/dashboard/*
  app.addHook('preHandler', async (req, reply) => {
    const url = req.url;
    if (url === '/dashboard/login' || url === '/dashboard/health' || url.startsWith('/dashboard/static/')) return;
    if (url.startsWith('/dashboard/') || url.startsWith('/v1/dashboard/')) {
      await requireDashboardSession(req, reply);
      if (req.dashboardSession?.role !== 'admin' && url.startsWith('/v1/dashboard/admin/')) {
        reply.code(403).send({ error_class: 'auth', error_code: 'admin_required', error: 'Admin role required' });
      }
    }
  });
}
