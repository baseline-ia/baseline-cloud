'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { resolveSession } from '@/lib/auth'
import {
  createCorporateSkill,
  publishSkillVersion,
  assignSkillToProject,
  unassignSkill,
  SkillSlugTakenError,
  SkillNotPublishedError,
} from '@/lib/services/corporate-skills'

const SKILLS_PATH = '/dashboard/admin/skills'

// ============================================================================
// Zod schemas
// ============================================================================

const CreateSkillSchema = z.object({
  slug: z
    .string()
    .min(1, 'Slug is required.')
    .max(64, 'Slug must be 64 characters or fewer.')
    .regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, digits, and hyphens.'),
  name: z.string().min(1, 'Name is required.').max(200, 'Name must be 200 characters or fewer.'),
  description: z.string().max(1000, 'Description must be 1000 characters or fewer.').optional(),
  tool: z.enum(['', 'claude', 'opencode', 'kiro']).optional(),
  failClosed: z.preprocess((v) => v === 'on' || v === true || v === 'true', z.boolean()).optional(),
})

const PublishVersionSchema = z.object({
  skillId: z.string().min(1, 'Skill ID is required.'),
  content: z.string().min(1, 'Content is required.'),
})

const AssignSchema = z.object({
  projectSlug: z.string().min(1, 'Project slug is required.'),
  skillId: z.string().min(1, 'Skill ID is required.'),
  versionId: z.string().optional(),
  failClosed: z.preprocess((v) => v === 'on' || v === true || v === 'true', z.boolean()).optional(),
})

const UnassignSchema = z.object({
  projectSlug: z.string().min(1, 'Project slug is required.'),
  skillId: z.string().min(1, 'Skill ID is required.'),
})

// ============================================================================
// Types
// ============================================================================

type ActionResult = { error?: string; success?: boolean }

// ============================================================================
// requireAdmin
// ============================================================================

async function requireAdmin() {
  const cookieStore = await cookies()
  const session = await resolveSession(cookieStore.get('baseline_dashboard_session')?.value)
  if (!session || session.role !== 'admin') redirect('/dashboard')
  return session
}

// ============================================================================
// Actions
// ============================================================================

export async function createSkillAction(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireAdmin()

  const raw = {
    slug: (formData.get('slug') as string | null)?.trim() ?? '',
    name: (formData.get('name') as string | null)?.trim() ?? '',
    description: (formData.get('description') as string | null)?.trim() ?? '',
    tool: (formData.get('tool') as string | null)?.trim() ?? '',
    failClosed: formData.get('failClosed'),
  }

  const parsed = CreateSkillSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Invalid input.' }
  }

  try {
    await createCorporateSkill(
      {
        slug: parsed.data.slug,
        name: parsed.data.name,
        description: parsed.data.description || null,
        tool: parsed.data.tool || null,
        failClosed: parsed.data.failClosed ?? false,
      },
      session.userId,
    )
  } catch (err) {
    if (err instanceof SkillSlugTakenError) {
      return { error: `Slug "${parsed.data.slug}" is already taken.` }
    }
    const message = err instanceof Error ? err.message : 'Failed to create skill.'
    return { error: message }
  }

  revalidatePath(SKILLS_PATH)
  return { success: true }
}

export async function publishVersionAction(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireAdmin()

  const raw = {
    skillId: (formData.get('skillId') as string | null)?.trim() ?? '',
    content: (formData.get('content') as string | null) ?? '',
  }

  const parsed = PublishVersionSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Invalid input.' }
  }

  try {
    await publishSkillVersion(parsed.data.skillId, parsed.data.content, session.userId)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to publish version.'
    return { error: message }
  }

  revalidatePath(SKILLS_PATH)
  return { success: true }
}

export async function assignToProjectAction(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireAdmin()

  const raw = {
    projectSlug: (formData.get('projectSlug') as string | null)?.trim() ?? '',
    skillId: (formData.get('skillId') as string | null)?.trim() ?? '',
    versionId: (formData.get('versionId') as string | null)?.trim() ?? '',
    failClosed: formData.get('failClosed'),
  }

  const parsed = AssignSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Invalid input.' }
  }

  try {
    await assignSkillToProject(
      {
        projectSlug: parsed.data.projectSlug,
        skillId: parsed.data.skillId,
        versionId: parsed.data.versionId || null,
        failClosed: parsed.data.failClosed ?? false,
      },
      session.userId,
    )
  } catch (err) {
    if (err instanceof SkillNotPublishedError) {
      return { error: 'Skill has no published versions yet.' }
    }
    const message = err instanceof Error ? err.message : 'Failed to assign skill.'
    return { error: message }
  }

  revalidatePath(SKILLS_PATH)
  return { success: true }
}

export async function unassignAction(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireAdmin()

  const raw = {
    projectSlug: (formData.get('projectSlug') as string | null)?.trim() ?? '',
    skillId: (formData.get('skillId') as string | null)?.trim() ?? '',
  }

  const parsed = UnassignSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Invalid input.' }
  }

  try {
    await unassignSkill(parsed.data.projectSlug, parsed.data.skillId, session.userId)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to unassign skill.'
    return { error: message }
  }

  revalidatePath(SKILLS_PATH)
  return { success: true }
}
