import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { db } from '../db/client.js';
import { events, users } from '../db/schema.js';
import { eq, sql, and, gte, desc, count, isNotNull } from 'drizzle-orm';
import { writeAudit } from '../auth/index.js';

const EVENT_TYPES = [
  'cli.install',
  'cli.update',
  'cli.doctor',
  'cli.status',
  'cli.mcp',
  'cli.onboard',
  'cli.login',
  'cli.logout',
  'openspec.open',
  'openspec.update',
  'change.open',
  'change.close',
  'change.commit',
  'skill.installed',
  'skill.used',
  'engram.setup',
  'engram.update',
] as const;

const EventSchema = z.object({
  event_type: z.enum(EVENT_TYPES),
  project: z.string().min(1).max(128).default('default'),
  payload: z.record(z.unknown()).default({}),
  occurred_at: z.string().datetime().optional(),
});

const BatchEventSchema = z.object({
  events: z.array(EventSchema).min(1).max(100),
});

export async function registerEventsRoutes(app: FastifyInstance) {
  // POST /v1/events — single event ingest
  app.post('/v1/events', { preHandler: [app.authenticate] }, async (req, reply) => {
    if (!req.authToken) {
      return reply.code(401).send({ error_class: 'auth', error_code: 'token_required' });
    }
    const parsed = EventSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error_class: 'validation',
        error_code: 'invalid_input',
        error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      });
    }
    const { event_type, project, payload, occurred_at } = parsed.data;
    const id = nanoid(21);
    const occurredAt = occurred_at ? new Date(occurred_at) : new Date();

    await db.insert(events).values({
      id,
      userId: req.authToken.userId,
      username: req.authToken.username,
      project,
      eventType: event_type,
      payload,
      occurredAt,
      clientIp: req.ip,
      userAgent: req.headers['user-agent'] ?? null,
    });

    return reply.code(201).send({ ok: true, id });
  });

  // POST /v1/events/batch — batch ingest (up to 100)
  app.post('/v1/events/batch', { preHandler: [app.authenticate] }, async (req, reply) => {
    if (!req.authToken) {
      return reply.code(401).send({ error_class: 'auth', error_code: 'token_required' });
    }
    const parsed = BatchEventSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error_class: 'validation',
        error_code: 'invalid_input',
        error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      });
    }
    const ids: string[] = [];
    await db.transaction(async (tx) => {
      for (const e of parsed.data.events) {
        const id = nanoid(21);
        ids.push(id);
        await tx.insert(events).values({
          id,
          userId: req.authToken!.userId,
          username: req.authToken!.username,
          project: e.project,
          eventType: e.event_type,
          payload: e.payload,
          occurredAt: e.occurred_at ? new Date(e.occurred_at) : new Date(),
          clientIp: req.ip,
          userAgent: req.headers['user-agent'] ?? null,
        });
      }
    });

    return reply.code(201).send({ ok: true, ids });
  });
}
