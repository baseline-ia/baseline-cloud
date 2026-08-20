import { createHash } from 'node:crypto'
import { count, desc, eq, ilike, max, or, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import {
  corporateSkills,
  corporateSkillVersions,
} from '@/lib/db/schema'
import type {
  CorporateSkill,
  CorporateSkillVersion,
} from '@/lib/db/schema'
import { writeAudit } from '@/lib/auth/index'

// ============================================================================
// Exports (re-export types for consumers)
// ============================================================================

export type { CorporateSkill, CorporateSkillVersion }

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

export const SKILL_VERSION_PAGE_SIZE = 50

export interface SkillVersionPageParams {
  page: number
}

export interface SkillVersionPage {
  skill: CorporateSkill
  latestVersion: CorporateSkillVersion | null
  versions: CorporateSkillVersion[]
  total: number
  page: number
  totalPages: number
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

export const ADMIN_SKILL_PAGE_SIZE = 50

export interface AdminCorporateSkillListParams {
  search: string
  page: number
}

export interface AdminCorporateSkillList {
  rows: Array<CorporateSkill & { latestVersion: number | null }>
  total: number
  page: number
  totalPages: number
}

type SearchParams = Record<string, string | string[] | undefined>

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export function parseAdminCorporateSkillListParams(
  params: SearchParams,
): AdminCorporateSkillListParams {
  const search = firstParam(params.q)?.trim() ?? ''
  const parsedPage = Number.parseInt(firstParam(params.page) ?? '1', 10)

  return {
    search,
    page: Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1,
  }
}

function adminCorporateSkillListWhere(search: string) {
  if (!search) return undefined

  const searchPattern = `%${search}%`
  return or(
    ilike(corporateSkills.slug, searchPattern),
    ilike(corporateSkills.name, searchPattern),
    ilike(corporateSkills.description, searchPattern),
    ilike(corporateSkills.tool, searchPattern),
  )
}

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

export async function listAdminCorporateSkills(
  params: AdminCorporateSkillListParams,
): Promise<AdminCorporateSkillList> {
  const where = adminCorporateSkillListWhere(params.search)
  const countRows = await db.select({ total: count() }).from(corporateSkills).where(where)

  const total = Number(countRows[0]?.total ?? 0)
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_SKILL_PAGE_SIZE))
  const page = Math.min(params.page, totalPages)
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
    .where(where)
    .orderBy(desc(corporateSkills.createdAt))
    .limit(ADMIN_SKILL_PAGE_SIZE)
    .offset((page - 1) * ADMIN_SKILL_PAGE_SIZE)

  return {
    rows: rows.map((row) => ({ ...row, latestVersion: row.latestVersion ?? null })),
    total,
    page,
    totalPages,
  }
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

export function parseSkillVersionPageParams(
  params: SearchParams,
): SkillVersionPageParams {
  const parsedPage = Number.parseInt(firstParam(params.page) ?? '1', 10)
  return { page: Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1 }
}

export async function getCorporateSkillVersionPage(
  slug: string,
  params: SkillVersionPageParams,
): Promise<SkillVersionPage | null> {
  const skillRows = await db
    .select()
    .from(corporateSkills)
    .where(eq(corporateSkills.slug, slug))
    .limit(1)

  if (skillRows.length === 0) return null
  const skill = skillRows[0]
  const versionWhere = eq(corporateSkillVersions.skillId, skill.id)

  const latestRows = await db
    .select()
    .from(corporateSkillVersions)
    .where(versionWhere)
    .orderBy(desc(corporateSkillVersions.version))
    .limit(1)
  const countRows = await db
    .select({ total: count() })
    .from(corporateSkillVersions)
    .where(versionWhere)
  const total = Number(countRows[0]?.total ?? 0)
  const totalPages = Math.max(1, Math.ceil(total / SKILL_VERSION_PAGE_SIZE))
  const page = Math.min(params.page, totalPages)
  const versions = await db
    .select()
    .from(corporateSkillVersions)
    .where(versionWhere)
    .orderBy(desc(corporateSkillVersions.version))
    .limit(SKILL_VERSION_PAGE_SIZE)
    .offset((page - 1) * SKILL_VERSION_PAGE_SIZE)

  return {
    skill,
    latestVersion: latestRows[0] ?? null,
    versions,
    total,
    page,
    totalPages,
  }
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
  byUserId: string | null,
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
  byUserId: string | null,
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
  _projectSlug: string,
): Promise<SkillAssignmentRow[]> {
  // Corporate skills are global — all published skills are delivered to every project.
  const rows = await db
    .select({
      slug: corporateSkills.slug,
      name: corporateSkills.name,
      version: corporateSkillVersions.version,
      content: corporateSkillVersions.content,
      contentHash: corporateSkillVersions.contentHash,
      failClosed: corporateSkills.failClosed,
      tool: corporateSkills.tool,
    })
    .from(corporateSkills)
    .innerJoin(
      corporateSkillVersions,
      sql`(
        ${corporateSkillVersions.id} = (
          SELECT id FROM corporate_skill_versions v2
          WHERE v2.skill_id = ${corporateSkills.id}
          ORDER BY v2.version DESC
          LIMIT 1
        )
      )`,
    )

  return rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    version: r.version,
    content: r.content,
    contentHash: r.contentHash,
    failClosed: r.failClosed,
    tool: r.tool ?? null,
  }))
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
  byUserId: string | null,
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
// upsertCorporateSkill
// ============================================================================

export interface UpsertSkillResult {
  slug: string
  action: 'created' | 'updated' | 'skipped'
  version: number
}

export async function upsertCorporateSkill(
  input: {
    slug: string
    name: string
    description?: string | null
    tool?: string | null
    content: string
  },
  byUserId: string | null,
): Promise<UpsertSkillResult> {
  const contentHash = createHash('sha256').update(input.content).digest('hex')

  const existing = await db
    .select()
    .from(corporateSkills)
    .where(eq(corporateSkills.slug, input.slug))
    .limit(1)

  if (existing.length === 0) {
    const skill = await createCorporateSkill(
      { slug: input.slug, name: input.name, description: input.description ?? null, tool: input.tool ?? null, failClosed: false },
      byUserId,
    )
    const ver = await publishSkillVersion(skill.id, input.content, byUserId)
    return { slug: input.slug, action: 'created', version: ver.version }
  }

  const skillId = existing[0].id

  const latest = await db
    .select({ contentHash: corporateSkillVersions.contentHash, version: corporateSkillVersions.version })
    .from(corporateSkillVersions)
    .where(eq(corporateSkillVersions.skillId, skillId))
    .orderBy(desc(corporateSkillVersions.version))
    .limit(1)

  if (latest.length > 0 && latest[0].contentHash === contentHash) {
    return { slug: input.slug, action: 'skipped', version: latest[0].version }
  }

  const ver = await publishSkillVersion(skillId, input.content, byUserId)
  return { slug: input.slug, action: 'updated', version: ver.version }
}
