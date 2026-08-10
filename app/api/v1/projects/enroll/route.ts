import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { resolveBearerToken } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import {
  enrollProject,
  getProject,
  normalizeSlug,
  ProjectAlreadyEnrolledError,
} from '@/lib/services/projects'

function extractBearer(req: Request): string | null {
  const auth = req.headers.get('authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return null
  return auth.slice(7).trim() || null
}

const EnrollSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[a-z0-9._-]+$/i, 'Slug may only contain letters, digits, dots, underscores, and hyphens.'),
  name: z.string().trim().min(1).max(200),
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

  const rl = checkRateLimit(`projects:enroll:${resolved.userId}`, {
    limit: 10,
    windowMs: 15 * 60_000,
  })
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error_class: 'validation', error_code: 'invalid_input' },
      { status: 400 },
    )
  }

  const parsed = EnrollSchema.safeParse(body)
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

  let slug: string
  try {
    slug = normalizeSlug(parsed.data.slug)
  } catch (error) {
    return NextResponse.json(
      {
        error_class: 'validation',
        error_code: 'invalid_input',
        error: error instanceof Error ? error.message : 'Invalid project slug.',
      },
      { status: 400 },
    )
  }
  try {
    const project = await enrollProject(slug, parsed.data.name, resolved.userId)
    return NextResponse.json({ ok: true, created: true, project }, { status: 201 })
  } catch (error) {
    if (!(error instanceof ProjectAlreadyEnrolledError)) throw error

    const existing = await getProject(slug)
    if (existing?.createdByUserId === resolved.userId && existing.name === parsed.data.name) {
      return NextResponse.json({ ok: true, created: false, project: existing }, { status: 200 })
    }

    return NextResponse.json(
      { error_class: 'conflict', error_code: 'project_already_enrolled' },
      { status: 409 },
    )
  }
}
