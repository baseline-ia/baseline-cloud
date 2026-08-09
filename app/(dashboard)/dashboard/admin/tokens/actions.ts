'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { resolveSession, issueToken, revokeToken } from '@/lib/auth'

export async function createTokenAction(
  _prevState: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const cookieStore = await cookies()
  const session = await resolveSession(cookieStore.get('baseline_dashboard_session')?.value)
  if (!session || session.role !== 'admin') redirect('/dashboard')

  const name = (formData.get('name') as string | null)?.trim()
  if (!name) return { error: 'Token name is required.' }

  const issued = await issueToken({ userId: session.userId, username: session.username, name })

  revalidatePath('/dashboard/admin/tokens')
  redirect(`/dashboard/admin/tokens?token=${encodeURIComponent(issued.raw)}`)
}

export async function revokeTokenAction(formData: FormData): Promise<void> {
  const cookieStore = await cookies()
  const session = await resolveSession(cookieStore.get('baseline_dashboard_session')?.value)
  if (!session || session.role !== 'admin') redirect('/dashboard')

  const tokenId = formData.get('tokenId') as string | null
  if (!tokenId) return

  await revokeToken({ tokenId, byUserId: session.userId, reason: 'Admin revocation' })

  revalidatePath('/dashboard/admin/tokens')
}
