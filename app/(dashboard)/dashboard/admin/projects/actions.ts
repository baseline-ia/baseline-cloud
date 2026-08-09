'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { resolveSession } from '@/lib/auth'
import {
  enrollProject,
  disableProject,
  enableProject,
  deleteProject,
} from '@/lib/services/projects'

const PROJECTS_PATH = '/dashboard/admin/projects'

const SlugSchema = z
  .string()
  .min(1, 'Slug is required.')
  .max(128, 'Slug must be 128 characters or fewer.')
  .regex(/^[a-z0-9._-]+$/i, 'Slug may only contain letters, digits, dots, underscores, and hyphens.')

const EnrollSchema = z.object({
  slug: SlugSchema,
  name: z.string().min(1, 'Name is required.').max(200, 'Name must be 200 characters or fewer.'),
})

type ActionResult = { error?: string; success?: boolean }

async function requireAdmin() {
  const cookieStore = await cookies()
  const session = await resolveSession(cookieStore.get('baseline_dashboard_session')?.value)
  if (!session || session.role !== 'admin') redirect('/dashboard')
  return session
}

export async function enrollProjectAction(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireAdmin()

  const raw = {
    slug: (formData.get('slug') as string | null)?.trim() ?? '',
    name: (formData.get('name') as string | null)?.trim() ?? '',
  }

  const parsed = EnrollSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Invalid input.' }
  }

  try {
    await enrollProject(parsed.data.slug, parsed.data.name, session.userId)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to enroll project.'
    return { error: message }
  }

  revalidatePath(PROJECTS_PATH)
  return { success: true }
}

export async function disableProjectAction(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireAdmin()

  const slug = (formData.get('slug') as string | null)?.trim() ?? ''
  if (!slug) return { error: 'Slug is required.' }

  try {
    await disableProject(slug, session.userId)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to disable project.'
    return { error: message }
  }

  revalidatePath(PROJECTS_PATH)
  return { success: true }
}

export async function enableProjectAction(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireAdmin()

  const slug = (formData.get('slug') as string | null)?.trim() ?? ''
  if (!slug) return { error: 'Slug is required.' }

  try {
    await enableProject(slug, session.userId)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to enable project.'
    return { error: message }
  }

  revalidatePath(PROJECTS_PATH)
  return { success: true }
}

export async function deleteProjectAction(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireAdmin()

  const slug = (formData.get('slug') as string | null)?.trim() ?? ''
  if (!slug) return { error: 'Slug is required.' }

  try {
    await deleteProject(slug, session.userId)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete project.'
    return { error: message }
  }

  revalidatePath(PROJECTS_PATH)
  return { success: true }
}
