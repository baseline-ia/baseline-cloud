// Single-process in-memory cache for project enrollment checks.
// This module assumes exactly one Node instance; if the deployment ever scales
// horizontally the cache must be replaced with a shared store (Redis, etc.).
import { count, desc, eq, ilike, inArray, or } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db } from '@/lib/db/client'
import { projects } from '@/lib/db/schema'
import { writeAudit } from '@/lib/auth/index'

export type { Project, NewProject } from '@/lib/db/schema'
import type { Project } from '@/lib/db/schema'

export const ADMIN_PROJECT_PAGE_SIZE = 50

export interface AdminProjectListParams {
  search: string
  page: number
}

export interface AdminProjectList {
  rows: Project[]
  total: number
  page: number
  totalPages: number
}

type SearchParams = Record<string, string | string[] | undefined>

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export function parseAdminProjectListParams(params: SearchParams): AdminProjectListParams {
  const search = firstParam(params.q)?.trim() ?? ''
  const parsedPage = Number.parseInt(firstParam(params.page) ?? '1', 10)

  return {
    search,
    page: Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1,
  }
}

function adminProjectListWhere(search: string) {
  if (!search) return undefined

  const searchPattern = `%${search}%`
  return or(ilike(projects.slug, searchPattern), ilike(projects.name, searchPattern))
}

export class ProjectAlreadyEnrolledError extends Error {
  constructor(public readonly slug: string) {
    super(`Project "${slug}" is already enrolled.`)
    this.name = 'ProjectAlreadyEnrolledError'
  }
}

// ============================================================================
// Slug validation
// ============================================================================

export const SLUG_RE = /^[a-z0-9._-]{1,128}$/

export function normalizeSlug(raw: string): string {
  const normalized = raw.trim().toLowerCase()
  if (!SLUG_RE.test(normalized)) {
    throw new Error(
      `Invalid slug "${raw}": must match ${SLUG_RE} after normalization (trim + lowercase).`,
    )
  }
  return normalized
}

// ============================================================================
// In-process cache (30 s TTL)
// ============================================================================

type CacheEntry = { enabled: boolean; expiresAt: number }
const CACHE_TTL_MS = 30_000
const cache = new Map<string, CacheEntry>()

function invalidate(slug: string): void {
  cache.delete(slug)
}

/** Exposed for tests only — never re-export from a barrel. */
export function __resetProjectsCacheForTests(): void {
  cache.clear()
}

// ============================================================================
// isProjectEnrolled — hot path for event ingestion
// ============================================================================

export async function isProjectEnrolled(slug: string): Promise<boolean> {
  const normalized = normalizeSlug(slug)
  const now = Date.now()
  const hit = cache.get(normalized)
  if (hit && hit.expiresAt > now) {
    return hit.enabled
  }

  const rows = await db
    .select()
    .from(projects)
    .where(eq(projects.slug, normalized))

  if (rows.length === 0) {
    // Cache negative result too (not enrolled means false)
    cache.set(normalized, { enabled: false, expiresAt: now + CACHE_TTL_MS })
    return false
  }

  const project = rows[0]
  cache.set(normalized, { enabled: project.enabled, expiresAt: now + CACHE_TTL_MS })
  return project.enabled
}

// ============================================================================
// checkProjectsEnrolled — batch check for batch event ingestion
// ============================================================================

export async function checkProjectsEnrolled(
  slugs: string[],
): Promise<{ ok: true } | { ok: false; missing: string[] }> {
  // Deduplicate and normalize
  const normalized = [...new Set(slugs.map((s) => normalizeSlug(s)))]

  const rows = await db
    .select({ slug: projects.slug, enabled: projects.enabled })
    .from(projects)
    .where(inArray(projects.slug, normalized))

  const found = new Map(rows.map((r) => [r.slug, r.enabled]))

  const missing: string[] = []
  for (const slug of normalized) {
    const enabled = found.get(slug)
    if (enabled === undefined || !enabled) {
      missing.push(slug)
    }
  }

  if (missing.length > 0) {
    return { ok: false, missing }
  }
  return { ok: true }
}

// ============================================================================
// listProjects
// ============================================================================

export async function listProjects(): Promise<Project[]> {
  return db.select().from(projects).orderBy(desc(projects.createdAt))
}

export async function listAdminProjects(
  params: AdminProjectListParams,
): Promise<AdminProjectList> {
  const where = adminProjectListWhere(params.search)
  const countRows = await db.select({ total: count() }).from(projects).where(where)

  const total = Number(countRows[0]?.total ?? 0)
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_PROJECT_PAGE_SIZE))
  const page = Math.min(params.page, totalPages)

  const rows = await db
    .select()
    .from(projects)
    .where(where)
    .orderBy(desc(projects.createdAt))
    .limit(ADMIN_PROJECT_PAGE_SIZE)
    .offset((page - 1) * ADMIN_PROJECT_PAGE_SIZE)

  return { rows, total, page, totalPages }
}

export async function getProject(slug: string): Promise<Project | null> {
  const normalizedSlug = normalizeSlug(slug)
  const rows = await db.select().from(projects).where(eq(projects.slug, normalizedSlug)).limit(1)
  return rows[0] ?? null
}

// ============================================================================
// enrollProject
// ============================================================================

export async function enrollProject(
  slug: string,
  name: string,
  byUserId: string,
): Promise<Project> {
  const normalizedSlug = normalizeSlug(slug)

  let inserted: Project[]
  try {
    inserted = await db
      .insert(projects)
      .values({
        slug: normalizedSlug,
        name,
        enabled: true,
        createdByUserId: byUserId,
      })
      .returning()
  } catch (error) {
    if (isUniqueViolation(error)) throw new ProjectAlreadyEnrolledError(normalizedSlug)
    throw error
  }

  const project = inserted[0]

  await writeAudit({
    actorUserId: byUserId,
    action: 'project.enrolled',
    metadata: { slug: normalizedSlug },
  })

  invalidate(normalizedSlug)
  return project
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'
}

// ============================================================================
// disableProject
// ============================================================================

export async function disableProject(slug: string, byUserId: string): Promise<void> {
  const normalizedSlug = normalizeSlug(slug)

  await db
    .update(projects)
    .set({
      enabled: false,
      disabledAt: new Date(),
      disabledByUserId: byUserId,
    })
    .where(eq(projects.slug, normalizedSlug))

  await writeAudit({
    actorUserId: byUserId,
    action: 'project.disabled',
    metadata: { slug: normalizedSlug },
  })

  invalidate(normalizedSlug)
}

// ============================================================================
// enableProject
// ============================================================================

export async function enableProject(slug: string, byUserId: string): Promise<void> {
  const normalizedSlug = normalizeSlug(slug)

  await db
    .update(projects)
    .set({
      enabled: true,
      disabledAt: null,
      disabledByUserId: null,
    })
    .where(eq(projects.slug, normalizedSlug))

  await writeAudit({
    actorUserId: byUserId,
    action: 'project.enabled',
    metadata: { slug: normalizedSlug },
  })

  invalidate(normalizedSlug)
}

// ============================================================================
// deleteProject
// ============================================================================

export async function deleteProject(slug: string, byUserId: string): Promise<void> {
  const normalizedSlug = normalizeSlug(slug)

  await writeAudit({
    actorUserId: byUserId,
    action: 'project.deleted',
    metadata: { slug: normalizedSlug },
  })

  await db.delete(projects).where(eq(projects.slug, normalizedSlug))

  invalidate(normalizedSlug)
}

// ============================================================================
// getProjectPolicy / setProjectPolicy
// ============================================================================

export async function getProjectPolicy(slug: string): Promise<{ skills: { disabled: string[] } }> {
  const normalizedSlug = normalizeSlug(slug)
  const rows = await db
    .select({ config: projects.config })
    .from(projects)
    .where(eq(projects.slug, normalizedSlug))
    .limit(1)
  const config = (rows[0]?.config ?? {}) as { skills?: { disabled?: string[] } }
  return { skills: { disabled: config?.skills?.disabled ?? [] } }
}

export async function setProjectPolicy(
  slug: string,
  policy: { skills: { disabled: string[] } },
  byUserId: string,
): Promise<void> {
  const normalizedSlug = normalizeSlug(slug)
  await db
    .update(projects)
    .set({ config: policy })
    .where(eq(projects.slug, normalizedSlug))
  await writeAudit({
    actorUserId: byUserId,
    action: 'project.policy_updated',
    metadata: { slug: normalizedSlug, disabled: policy.skills.disabled },
  })
  invalidate(normalizedSlug)
}
