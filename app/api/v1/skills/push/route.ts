import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { resolveBearerToken } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { upsertCorporateSkill } from '@/lib/services/corporate-skills'

function extractBearer(req: Request): string | null {
  const auth = req.headers.get('authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return null
  return auth.slice(7).trim() || null
}

const PushBody = z.object({
  skills: z.array(
    z.object({
      slug: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
      name: z.string().min(1).max(200),
      description: z.string().max(1000).optional(),
      tool: z.string().max(64).optional(),
      content: z.string().min(1),
    }),
  ).min(1).max(100),
})

export async function POST(req: NextRequest) {
  const raw = extractBearer(req)
  if (!raw) {
    return NextResponse.json({ error_class: 'auth', error_code: 'token_required' }, { status: 401 })
  }

  const resolved = await resolveBearerToken(raw)
  if (!resolved) {
    return NextResponse.json({ error_class: 'auth', error_code: 'token_required' }, { status: 401 })
  }

  if (resolved.role !== 'admin') {
    return NextResponse.json({ error_class: 'forbidden', error_code: 'admin_required' }, { status: 403 })
  }

  const rl = checkRateLimit(`skills-push:${resolved.tokenId}`, { limit: 10, windowMs: 60_000 })
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error_class: 'validation', error_code: 'invalid_json' }, { status: 400 })
  }

  const parsed = PushBody.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error_class: 'validation', error_code: 'invalid_body', detail: parsed.error.errors[0]?.message },
      { status: 400 },
    )
  }

  const results = []
  for (const skill of parsed.data.skills) {
    try {
      const result = await upsertCorporateSkill(
        { slug: skill.slug, name: skill.name, description: skill.description ?? null, tool: skill.tool ?? null, content: skill.content },
        resolved.userId,
      )
      results.push(result)
    } catch (err) {
      results.push({ slug: skill.slug, action: 'error', error: err instanceof Error ? err.message : String(err) })
    }
  }

  const created = results.filter((r) => r.action === 'created').length
  const updated = results.filter((r) => r.action === 'updated').length
  const skipped = results.filter((r) => r.action === 'skipped').length

  return NextResponse.json({ ok: true, results, summary: { created, updated, skipped } }, { status: 200 })
}
