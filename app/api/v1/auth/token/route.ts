import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { users } from '@/lib/db/schema'
import { resolveBearerToken, verifyPassword, issueToken } from '@/lib/auth'
import { extractIp } from '@/lib/ip'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

function extractBearer(req: Request): string | null {
  const auth = req.headers.get('authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return null
  return auth.slice(7).trim() || null
}

const TokenSchema = z.object({
  name: z.string().min(1).max(64).default('CLI'),
  password: z.string().min(1),
})

export async function POST(req: NextRequest) {
  const ip = extractIp(req)
  const rl = checkRateLimit(`auth:token:${ip}`, { limit: 10, windowMs: 15 * 60_000 })
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs)

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
  const parsed = TokenSchema.safeParse(body)
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

  const { name, password } = parsed.data

  // Re-validate password against the token owner's user record
  const userRows = await db
    .select()
    .from(users)
    .where(eq(users.id, resolved.userId))
    .limit(1)

  const user = userRows[0]
  if (!user) {
    return NextResponse.json(
      { error_class: 'auth', error_code: 'invalid_credentials' },
      { status: 401 },
    )
  }

  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) {
    return NextResponse.json(
      { error_class: 'auth', error_code: 'invalid_credentials' },
      { status: 401 },
    )
  }

  const issued = await issueToken({
    userId: resolved.userId,
    username: resolved.username,
    name,
    ip,
  })

  return NextResponse.json({ id: issued.id, raw: issued.raw, prefix: issued.prefix, name: issued.name })
}
