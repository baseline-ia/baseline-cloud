import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { db } from '@/lib/db/client'
import { events } from '@/lib/db/schema'
import { resolveBearerToken } from '@/lib/auth'

function extractBearer(req: Request): string | null {
  const auth = req.headers.get('authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return null
  return auth.slice(7).trim() || null
}

const EventSchema = z.object({
  event_type: z.enum([
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
  ]),
  project: z.string().min(1).max(128).default('default'),
  payload: z.record(z.unknown()).default({}),
  occurred_at: z.string().datetime().optional(),
})

const BatchSchema = z.object({
  events: z.array(EventSchema).min(1).max(100),
})

export async function POST(req: NextRequest) {
  const raw = extractBearer(req)
  if (!raw) {
    return NextResponse.json(
      { error_class: 'auth', error_code: 'token_required' },
      { status: 401 },
    )
  }

  const resolved = await resolveBearerToken(raw)
  if (!resolved) {
    return NextResponse.json(
      { error_class: 'auth', error_code: 'token_required' },
      { status: 401 },
    )
  }

  const body = await req.json()
  const parsed = BatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        error_class: 'validation',
        error_code: 'invalid_input',
        error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      },
      { status: 400 },
    )
  }

  const clientIp = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? null
  const userAgent = req.headers.get('user-agent') ?? null
  const ids: string[] = []

  await db.transaction(async (tx) => {
    for (const e of parsed.data.events) {
      const id = nanoid(21)
      ids.push(id)
      await tx.insert(events).values({
        id,
        userId: resolved.userId,
        username: resolved.username,
        project: e.project,
        eventType: e.event_type,
        payload: e.payload,
        occurredAt: e.occurred_at ? new Date(e.occurred_at) : new Date(),
        clientIp,
        userAgent,
      })
    }
  })

  return NextResponse.json({ ok: true, ids }, { status: 201 })
}
