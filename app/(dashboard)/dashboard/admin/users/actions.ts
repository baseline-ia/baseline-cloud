'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { resolveSession, hashPassword } from '@/lib/auth'
import { db } from '@/lib/db/client'
import { users } from '@/lib/db/schema'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { redirect } from 'next/navigation'

const CreateUserSchema = z.object({
  username: z.string().min(1, 'Username is required').regex(/^[a-zA-Z0-9_-]+$/, 'Username may only contain letters, numbers, underscores, and hyphens'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['admin', 'member']),
})

export async function createUserAction(
  _prevState: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const cookieStore = await cookies()
  const session = await resolveSession(cookieStore.get('baseline_dashboard_session')?.value)
  if (!session || session.role !== 'admin') redirect('/dashboard')

  const raw = {
    username: (formData.get('username') as string | null) ?? '',
    email: (formData.get('email') as string | null) ?? '',
    password: (formData.get('password') as string | null) ?? '',
    role: (formData.get('role') as string | null) ?? 'member',
  }

  const parsed = CreateUserSchema.safeParse(raw)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { error: firstError?.message ?? 'Invalid input.' }
  }

  const { username, email, password, role } = parsed.data
  const passwordHash = await hashPassword(password)
  const id = nanoid(21)

  try {
    await db.insert(users).values({
      id,
      username,
      email,
      passwordHash,
      role,
      enabled: true,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('unique') || message.includes('duplicate')) {
      return { error: 'Username or email already exists.' }
    }
    return { error: 'Failed to create user. Please try again.' }
  }

  revalidatePath('/dashboard/admin/users')
  return {}
}
