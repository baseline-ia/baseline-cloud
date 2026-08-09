import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq, isNull, and } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { users, tokens } from '@/lib/db/schema'
import { verifyPassword, writeAudit } from '@/lib/auth'

const LoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = LoginSchema.safeParse(body)
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

  const { username, password } = parsed.data
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? undefined

  const userRows = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1)

  const user = userRows[0]

  if (!user || !user.enabled) {
    await writeAudit({
      actorUsername: username,
      action: 'login.failed',
      metadata: { reason: user ? 'disabled' : 'not_found' },
      ip,
    })
    return NextResponse.json(
      { error_class: 'auth', error_code: 'invalid_credentials' },
      { status: 401 },
    )
  }

  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) {
    await writeAudit({
      actorUserId: user.id,
      actorUsername: user.username,
      action: 'login.failed',
      metadata: { reason: 'bad_password' },
      ip,
    })
    return NextResponse.json(
      { error_class: 'auth', error_code: 'invalid_credentials' },
      { status: 401 },
    )
  }

  // Update lastLoginAt
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id))

  await writeAudit({
    actorUserId: user.id,
    actorUsername: user.username,
    action: 'login.success',
    ip,
  })

  const filteredTokens = await db
    .select({
      id: tokens.id,
      prefix: tokens.tokenPrefix,
      name: tokens.name,
      createdAt: tokens.createdAt,
      lastUsedAt: tokens.lastUsedAt,
      revokedAt: tokens.revokedAt,
    })
    .from(tokens)
    .where(and(eq(tokens.userId, user.id), isNull(tokens.revokedAt)))

  return NextResponse.json({
    user: { id: user.id, username: user.username, email: user.email, role: user.role },
    tokens: filteredTokens,
    token_issue: 'POST /api/v1/auth/token with { name, password } to issue a new bearer token',
  })
}
