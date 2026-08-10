import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { nanoid } from 'nanoid'
import { db } from '@/lib/db/client'
import { events } from '@/lib/db/schema'
import { resolveBearerToken } from '@/lib/auth'
import { extractIp } from '@/lib/ip'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { normalizeSlug, isProjectEnrolled } from '@/lib/services/projects'
import { EventSchema } from '@/lib/events/schema'

function extractBearer(req: Request): string | null {
  const auth = req.headers.get('authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return null
  return auth.slice(7).trim() || null
}

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

  const rl = checkRateLimit(`events:single:${resolved.userId}`, { limit: 300, windowMs: 60_000 })
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs)

  const body = await req.json()
  const parsed = EventSchema.safeParse(body)
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

  const { event_type, project, payload, occurred_at } = parsed.data
  const slug = normalizeSlug(project)
  const enrolled = await isProjectEnrolled(slug)
  if (!enrolled) {
    return NextResponse.json(
      { error_class: 'forbidden', error_code: 'project_not_enrolled', project: slug },
      { status: 403 },
    )
  }

  const id = nanoid(21)
  const occurredAt = occurred_at ? new Date(occurred_at) : new Date()

  await db.insert(events).values({
    id,
    userId: resolved.userId,
    username: resolved.username,
    project: slug,
    eventType: event_type,
    payload,
    occurredAt,
    clientIp: extractIp(req),
    userAgent: req.headers.get('user-agent') ?? null,
  })

  return NextResponse.json({ ok: true, id }, { status: 201 })
}
