import { createHash } from 'node:crypto'
import { eq, and, desc, max, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import {
  corporateSkills,
  corporateSkillVersions,
  projectSkillAssignments,
} from '@/lib/db/schema'
import type {
  CorporateSkill,
  CorporateSkillVersion,
  ProjectSkillAssignment,
} from '@/lib/db/schema'
import { writeAudit } from '@/lib/auth/index'

// ============================================================================
// Exports (re-export types for consumers)
// ============================================================================

export type { CorporateSkill, CorporateSkillVersion, ProjectSkillAssignment }

// ============================================================================
// Slug validation
// ============================================================================

export const SKILL_SLUG_RE = /^[a-z0-9-]{1,64}$/

// ============================================================================
// Custom errors
// ============================================================================

export class SkillSlugTakenError extends Error {
  constructor(public readonly slug: string) {
    super(`Skill slug "${slug}" is already taken.`)
    this.name = 'SkillSlugTakenError'
  }
}

export class SkillNotFoundError extends Error {
  constructor(public readonly slugOrId: string) {
    super(`Skill "${slugOrId}" not found.`)
    this.name = 'SkillNotFoundError'
  }
}

export class SkillNotPublishedError extends Error {
  constructor(public readonly skillId: string) {
    super(`Skill "${skillId}" has no published versions.`)
    this.name = 'SkillNotPublishedError'
  }
}

// ============================================================================
// Helpers
// ============================================================================

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === '23505'
  )
}

// ============================================================================
// listCorporateSkills
// ============================================================================

export async function listCorporateSkills(): Promise<
  Array<CorporateSkill & { latestVersion: number | null }>
> {
  const latestVersionSubquery = db
    .select({
      skillId: corporateSkillVersions.skillId,
      latestVersion: max(corporateSkillVersions.version).as('latest_version'),
    })
    .from(corporateSkillVersions)
    .groupBy(corporateSkillVersions.skillId)
    .as('latest_versions')

  const rows = await db
    .select({
      id: corporateSkills.id,
      slug: corporateSkills.slug,
      name: corporateSkills.name,
      description: corporateSkills.description,
      tool: corporateSkills.tool,
      failClosed: corporateSkills.failClosed,
      createdByUserId: corporateSkills.createdByUserId,
      createdAt: corporateSkills.createdAt,
      updatedAt: corporateSkills.updatedAt,
      latestVersion: latestVersionSubquery.latestVersion,
    })
    .from(corporateSkills)
    .leftJoin(latestVersionSubquery, eq(corporateSkills.id, latestVersionSubquery.skillId))
    .orderBy(desc(corporateSkills.createdAt))

  return rows.map((r) => ({
    ...r,
    latestVersion: r.latestVersion ?? null,
  }))
}

// ============================================================================
// getCorporateSkill
// ============================================================================

export async function getCorporateSkill(
  slug: string,
): Promise<{ skill: CorporateSkill; versions: CorporateSkillVersion[] } | null> {
  const skillRows = await db
    .select()
    .from(corporateSkills)
    .where(eq(corporateSkills.slug, slug))
    .limit(1)

  if (skillRows.length === 0) return null
  const skill = skillRows[0]

  const versions = await db
    .select()
    .from(corporateSkillVersions)
    .where(eq(corporateSkillVersions.skillId, skill.id))
    .orderBy(desc(corporateSkillVersions.version))

  return { skill, versions }
}

// ============================================================================
// createCorporateSkill
// ============================================================================

export async function createCorporateSkill(
  input: {
    slug: string
    name: string
    description?: string | null
    tool?: string | null
    failClosed?: boolean
  },
  byUserId: string,
): Promise<CorporateSkill> {
  if (!SKILL_SLUG_RE.test(input.slug)) {
    throw new Error(
      `Invalid skill slug "${input.slug}": must match ${SKILL_SLUG_RE} (lowercase alphanumeric and hyphens, 1–64 chars).`,
    )
  }

  let inserted: CorporateSkill[]
  try {
    inserted = await db
      .insert(corporateSkills)
      .values({
        slug: input.slug,
        name: input.name,
        description: input.description ?? null,
        tool: input.tool ?? null,
        failClosed: input.failClosed ?? false,
        createdByUserId: byUserId,
      })
      .returning()
  } catch (error) {
    if (isUniqueViolation(error)) throw new SkillSlugTakenError(input.slug)
    throw error
  }

  const skill = inserted[0]

  await writeAudit({
    actorUserId: byUserId,
    action: 'corporate_skill.created',
    metadata: { skillId: skill.id, slug: skill.slug },
  })

  return skill
}

// ============================================================================
// publishSkillVersion
// ============================================================================

export async function publishSkillVersion(
  skillId: string,
  content: string,
  byUserId: string,
): Promise<CorporateSkillVersion> {
  const contentHash = createHash('sha256').update(content).digest('hex')

  async function attemptInsert(): Promise<CorporateSkillVersion> {
    return db.transaction(async (tx) => {
      const rows = await tx
        .select({ maxVersion: max(corporateSkillVersions.version) })
        .from(corporateSkillVersions)
        .where(eq(corporateSkillVersions.skillId, skillId))
        .limit(1)

      const currentMax = rows[0]?.maxVersion ?? null
      const nextVersion = (currentMax ?? 0) + 1

      const inserted = await tx
        .insert(corporateSkillVersions)
        .values({
          skillId,
          version: nextVersion,
          content,
          contentHash,
          publishedByUserId: byUserId,
        })
        .returning()

      return inserted[0]
    })
  }

  let version: CorporateSkillVersion
  try {
    version = await attemptInsert()
  } catch (error) {
    if (isUniqueViolation(error)) {
      // Retry once on concurrent publish race
      version = await attemptInsert()
    } else {
      throw error
    }
  }

  await writeAudit({
    actorUserId: byUserId,
    action: 'skill_version.published',
    metadata: { skillId, version: version.version },
  })

  return version
}

// ============================================================================
// getAssignmentsForProject
// ============================================================================

export interface SkillAssignmentRow {
  slug: string
  name: string
  version: number
  content: string
  contentHash: string
  failClosed: boolean
  tool: string | null
}

export async function getAssignmentsForProject(
  projectSlug: string,
): Promise<SkillAssignmentRow[]> {
  // Use a lateral-style join to resolve null versionId to latest version.
  // Since Drizzle doesn't have native LATERAL JOIN support in all versions,
  // we use a subquery approach: join to the latest version per skill.
  const latestVersionSubquery = db
    .select({
      skillId: corporateSkillVersions.skillId,
      latestVersionId: sql<string>`(
        SELECT id FROM corporate_skill_versions v2
        WHERE v2.skill_id = ${corporateSkillVersions.skillId}
        ORDER BY v2.version DESC
        LIMIT 1
      )`.as('latest_version_id'),
    })
    .from(corporateSkillVersions)
    .groupBy(corporateSkillVersions.skillId)
    .as('lv')

  // We need to resolve: if versionId IS NULL → use latest version for that skill
  // if versionId IS NOT NULL → use that specific version
  // Approach: join the resolved version using a raw SQL expression
  const rows = await db
    .select({
      slug: corporateSkills.slug,
      name: corporateSkills.name,
      version: corporateSkillVersions.version,
      content: corporateSkillVersions.content,
      contentHash: corporateSkillVersions.contentHash,
      failClosed: projectSkillAssignments.failClosed,
      tool: corporateSkills.tool,
    })
    .from(projectSkillAssignments)
    .leftJoin(corporateSkills, eq(projectSkillAssignments.skillId, corporateSkills.id))
    .leftJoin(
      corporateSkillVersions,
      sql`(
        ${corporateSkillVersions.id} = COALESCE(
          ${projectSkillAssignments.versionId},
          (
            SELECT id FROM corporate_skill_versions v2
            WHERE v2.skill_id = ${projectSkillAssignments.skillId}
            ORDER BY v2.version DESC
            LIMIT 1
          )
        )
      )`,
    )
    .where(eq(projectSkillAssignments.projectSlug, projectSlug))

  return rows
    .filter((r): r is SkillAssignmentRow =>
      r.slug !== null &&
      r.name !== null &&
      r.version !== null &&
      r.content !== null &&
      r.contentHash !== null,
    )
    .map((r) => ({
      slug: r.slug!,
      name: r.name!,
      version: r.version!,
      content: r.content!,
      contentHash: r.contentHash!,
      failClosed: r.failClosed,
      tool: r.tool ?? null,
    }))
}

// ============================================================================
// assignSkillToProject
// ============================================================================

export async function assignSkillToProject(
  input: {
    projectSlug: string
    skillId: string
    versionId?: string | null
    failClosed?: boolean
  },
  byUserId: string,
): Promise<ProjectSkillAssignment> {
  // Guard: skill must have at least one published version
  const versionRows = await db
    .select({ id: corporateSkillVersions.id })
    .from(corporateSkillVersions)
    .where(eq(corporateSkillVersions.skillId, input.skillId))
    .limit(1)

  if (versionRows.length === 0) {
    throw new SkillNotPublishedError(input.skillId)
  }

  const inserted = await db
    .insert(projectSkillAssignments)
    .values({
      projectSlug: input.projectSlug,
      skillId: input.skillId,
      versionId: input.versionId ?? null,
      failClosed: input.failClosed ?? false,
      assignedByUserId: byUserId,
    })
    .onConflictDoUpdate({
      target: [projectSkillAssignments.projectSlug, projectSkillAssignments.skillId],
      set: {
        versionId: input.versionId ?? null,
        failClosed: input.failClosed ?? false,
        assignedByUserId: byUserId,
        assignedAt: new Date(),
      },
    })
    .returning()

  const assignment = inserted[0]

  await writeAudit({
    actorUserId: byUserId,
    action: 'project_skill.assigned',
    metadata: {
      projectSlug: input.projectSlug,
      skillId: input.skillId,
      versionId: input.versionId ?? null,
    },
  })

  return assignment
}

// ============================================================================
// unassignSkill
// ============================================================================

export async function unassignSkill(
  projectSlug: string,
  skillId: string,
  byUserId: string,
): Promise<void> {
  await db
    .delete(projectSkillAssignments)
    .where(
      and(
        eq(projectSkillAssignments.projectSlug, projectSlug),
        eq(projectSkillAssignments.skillId, skillId),
      ),
    )

  await writeAudit({
    actorUserId: byUserId,
    action: 'project_skill.unassigned',
    metadata: { projectSlug, skillId },
  })
}

// ============================================================================
// updateCorporateSkillMetadata
// ============================================================================

export async function updateCorporateSkillMetadata(
  id: string,
  input: {
    name?: string
    description?: string | null
    tool?: string | null
    failClosed?: boolean
  },
  byUserId: string,
): Promise<CorporateSkill> {
  const rows = await db
    .update(corporateSkills)
    .set({
      name: input.name,
      description: input.description,
      tool: input.tool,
      failClosed: input.failClosed,
      updatedAt: new Date(),
    })
    .where(eq(corporateSkills.id, id))
    .returning()

  if (rows.length === 0) throw new SkillNotFoundError(id)

  await writeAudit({
    actorUserId: byUserId,
    action: 'corporate_skill.updated',
    metadata: { skillId: id, changes: Object.keys(input) },
  })

  return rows[0]
}

// ============================================================================
// getSkillAssignments
// ============================================================================

export interface SkillProjectAssignmentRow {
  projectSlug: string
  versionId: string | null
  failClosed: boolean
  assignedAt: Date
}

export async function getSkillAssignments(skillId: string): Promise<SkillProjectAssignmentRow[]> {
  const rows = await db
    .select({
      projectSlug: projectSkillAssignments.projectSlug,
      versionId: projectSkillAssignments.versionId,
      failClosed: projectSkillAssignments.failClosed,
      assignedAt: projectSkillAssignments.assignedAt,
    })
    .from(projectSkillAssignments)
    .where(eq(projectSkillAssignments.skillId, skillId))
    .orderBy(projectSkillAssignments.assignedAt)

  return rows
}
