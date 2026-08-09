import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { eq, or } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { users } from '@/lib/db/schema'
import { hashPassword, issueToken, writeAudit } from '@/lib/auth'
import { config } from '@/lib/config'

const SignupSchema = z.object({
  username: z.string().min(3).max(64).regex(/^[a-z0-9_-]+$/i),
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  tokenName: z.string().min(1).max(64).optional(),
})

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = SignupSchema.safeParse(body)
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

  const { username, email, password, tokenName } = parsed.data

  // Check if this is the first user
  const countRows = await db.select({ id: users.id }).from(users).limit(1)
  const isFirstUser = countRows.length === 0

  if (isFirstUser && !config.BOOTSTRAP_ADMIN) {
    return NextResponse.json(
      { error_class: 'auth', error_code: 'bootstrap_disabled' },
      { status: 403 },
    )
  }

  // Duplicate check
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(or(eq(users.username, username), eq(users.email, email)))
    .limit(1)

  if (existing.length > 0) {
    return NextResponse.json(
      { error_class: 'conflict', error_code: 'user_exists' },
      { status: 409 },
    )
  }

  const role = isFirstUser ? 'admin' : 'member'
  const passwordHash = await hashPassword(password)
  const userId = nanoid(21)
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? undefined

  await db.insert(users).values({
    id: userId,
    username,
    email,
    passwordHash,
    role,
  })

  await writeAudit({
    actorUserId: userId,
    actorUsername: username,
    action: 'user.signup',
    targetUserId: userId,
    targetUsername: username,
    metadata: { role },
    ip,
  })

  const issued = await issueToken({
    userId,
    username,
    name: tokenName ?? 'CLI',
    ip,
  })

  const warning = isFirstUser
    ? 'First user created with admin role. Set BOOTSTRAP_ADMIN=false to disable further bootstrapping.'
    : undefined

  return NextResponse.json(
    {
      user: { id: userId, username, email, role },
      token: { id: issued.id, raw: issued.raw, prefix: issued.prefix, name: issued.name },
      ...(warning ? { warning } : {}),
    },
    { status: 201 },
  )
}
