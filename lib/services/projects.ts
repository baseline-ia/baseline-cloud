// Single-process in-memory cache for project enrollment checks.
// This module assumes exactly one Node instance; if the deployment ever scales
// horizontally the cache must be replaced with a shared store (Redis, etc.).
import { eq, inArray, desc } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db } from '@/lib/db/client'
import { projects } from '@/lib/db/schema'
import { writeAudit } from '@/lib/auth/index'

export type { Project, NewProject } from '@/lib/db/schema'
import type { Project } from '@/lib/db/schema'

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

// ============================================================================
// enrollProject
// ============================================================================

export async function enrollProject(
  slug: string,
  name: string,
  byUserId: string,
): Promise<Project> {
  const normalizedSlug = normalizeSlug(slug)

  const inserted = await db
    .insert(projects)
    .values({
      slug: normalizedSlug,
      name,
      enabled: true,
      createdByUserId: byUserId,
    })
    .returning()

  const project = inserted[0]

  await writeAudit({
    actorUserId: byUserId,
    action: 'project.enrolled',
    metadata: { slug: normalizedSlug },
  })

  invalidate(normalizedSlug)
  return project
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
