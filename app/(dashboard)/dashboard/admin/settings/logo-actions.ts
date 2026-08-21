'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { resolveSession } from '@/lib/auth'
import { setBrandingLogo, removeBrandingLogo } from '@/lib/services/branding'
import { redirect } from 'next/navigation'

export async function uploadLogoAction(
  dataUrl: string,
  filename: string,
): Promise<{ error?: string; success?: boolean }> {
  const cookieStore = await cookies()
  const session = await resolveSession(cookieStore.get('baseline_dashboard_session')?.value)
  if (!session || session.role !== 'admin') redirect('/dashboard')

  try {
    await setBrandingLogo(dataUrl, filename, session.userId)
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Upload failed' }
  }

  revalidatePath('/dashboard', 'layout')
  return { success: true }
}

export async function removeLogoAction(): Promise<{ error?: string; success?: boolean }> {
  const cookieStore = await cookies()
  const session = await resolveSession(cookieStore.get('baseline_dashboard_session')?.value)
  if (!session || session.role !== 'admin') redirect('/dashboard')

  try {
    await removeBrandingLogo(session.userId)
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Remove failed' }
  }

  revalidatePath('/dashboard', 'layout')
  return { success: true }
}
