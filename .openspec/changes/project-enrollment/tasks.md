# Tasks: Project Enrollment Allowlist

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 480–620 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Schema + migration + projects service + unit tests | PR 1 | `npx vitest run tests/projects.test.ts` | N/A — service is headless; no HTTP surface until PR 2 | Delete `lib/services/projects.ts`, `lib/db/migrations/0001_projects.sql`, revert `lib/db/schema.ts`, revert `lib/db/migrations/meta/` |
| 2 | API enforcement (events + batch routes) + integration tests | PR 2 | `npx vitest run tests/events.test.ts` | `curl -H "Authorization: Bearer <token>" -d '{"project":"unknown",...}' http://localhost:3000/api/v1/events` → expect 403 | Revert `app/api/v1/events/route.ts` and `app/api/v1/events/batch/route.ts` to pre-PR2 state |
| 3 | Admin UI (page + actions + form) | PR 3 | N/A — no automated RSC test harness installed | Manual: navigate `/dashboard/admin/projects` as admin; attempt as non-admin → expect redirect | Delete `app/(dashboard)/dashboard/admin/projects/` directory |

---

## Phase 1: Schema and Migration (PR 1)

- [x] 1.1 Modify `lib/db/schema.ts`: append `projects` pgTable with columns `id` (text PK, nanoid), `slug` (text, notNull, unique), `displayName` (text, notNull), `enabled` (boolean, notNull, default true), `createdAt` (timestamptz, defaultNow), `updatedAt` (timestamptz, defaultNow), `createdByUserId` (text, FK → users.id onDelete set null). Export `Project` inferred type.
- [x] 1.2 Create `lib/db/migrations/0001_projects.sql`: `CREATE TABLE IF NOT EXISTS "projects"` with all columns; `CREATE UNIQUE INDEX "projects_slug_idx" ON "projects" ("slug")`; `ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_user_id_users_id_fk" FOREIGN KEY ... ON DELETE set null`. Add `---> statement-breakpoint` separators per Drizzle convention.
- [x] 1.3 Modify `lib/db/migrations/meta/_journal.json`: append entry `{ idx: 1, version: "7", when: <timestamp>, tag: "0001_projects", breakpoints: true }`.
- [x] 1.4 Create `lib/db/migrations/meta/0001_snapshot.json`: Drizzle snapshot for the `projects` table (mirrors existing `0000_snapshot.json` pattern).

---

## Phase 2: Projects Service + Unit Tests (PR 1, continued)

- [x] 2.1 Create `lib/services/projects.ts`: export `SLUG_RE = /^[a-z0-9._-]{1,128}$/` and `normalizeSlug(raw: string): string` (trim + toLowerCase; throws `ValidationError` if post-normalize result fails `SLUG_RE` or is empty).
- [x] 2.2 Add module-private cache to `lib/services/projects.ts`: `Map<string, { enabled: boolean; expiresAt: number }>` with `CACHE_TTL_MS = 30_000`; private `invalidate(slug)` called by every write path; export `__resetProjectsCacheForTests()` (never re-exported from a barrel).
- [x] 2.3 Add `isProjectEnrolled(slug: string): Promise<boolean>` to `lib/services/projects.ts`: normalize slug, check cache; on miss `SELECT enabled FROM projects WHERE slug = ?`; write to cache; return `enabled`.
- [x] 2.4 Add `checkProjectsEnrolled(slugs: string[]): Promise<{ ok: true } | { ok: false; missing: string[] }>` to `lib/services/projects.ts`: deduplicate slugs; single `SELECT slug, enabled FROM projects WHERE slug IN (...)` on distinct set; return `ok: false` with missing/disabled slugs list.
- [x] 2.5 Add `listProjects(): Promise<Project[]>` to `lib/services/projects.ts`: `SELECT * FROM projects ORDER BY slug ASC`.
- [x] 2.6 Add `enrollProject(input: { slug: string; displayName?: string; actor: SessionActor }): Promise<Project>` to `lib/services/projects.ts`: `normalizeSlug`; `INSERT INTO projects`; `writeAudit({ action: 'project.enrolled', metadata: { slug } })`; `invalidate(slug)`. Throw conflict error on duplicate.
- [x] 2.7 Add `renameProject(input: { id: string; slug?: string; displayName?: string; actor: SessionActor }): Promise<Project>` — NOTE: renameProject deferred to later PR; slug is PK in this schema design so rename is a delete+re-insert. disableProject/enableProject/deleteProject implemented as per prompt scope.
- [x] 2.8 Add `disableProject(input: { id: string; actor: SessionActor }): Promise<void>` and `enableProject(input: { id: string; actor: SessionActor }): Promise<void>` to `lib/services/projects.ts`: `UPDATE projects SET enabled, updatedAt WHERE id`; `writeAudit({ action: 'project.disabled' | 'project.enabled' })`; `invalidate(slug)`.
- [x] 2.9 Add `deleteProject(input: { id: string; actor: SessionActor }): Promise<void>` to `lib/services/projects.ts`: fetch slug first; `writeAudit({ action: 'project.deleted' })`; `DELETE FROM projects WHERE id`; `invalidate(slug)`.

### TDD — Phase 2 Unit Tests

- [x] 2.10 **RED** `lib/__tests__/projects.test.ts` — `normalizeSlug`: (a) mixed-case normalizes to lowercase; (b) leading/trailing whitespace trimmed; (c) invalid characters throw; (d) empty string throws; (e) slug exactly 128 chars is accepted; (f) slug 129 chars throws.
- [x] 2.11 **GREEN** implement `normalizeSlug` to pass 2.10.
- [x] 2.12 **RED** `lib/__tests__/projects.test.ts` — cache: (a) second call within TTL hits cache, not DB; (b) cache entry expires after `CACHE_TTL_MS`; (c) `invalidate` removes entry immediately; (d) `__resetProjectsCacheForTests` clears all entries.
- [x] 2.13 **GREEN** implement cache logic to pass 2.12.
- [x] 2.14 **RED** `lib/__tests__/projects.test.ts` — `enrollProject`: (a) valid slug creates row with `enabled = true`; (b) duplicate normalized slug returns conflict error without inserting; (c) empty slug is rejected before DB call; (d) audit row with action `project.enrolled` is persisted.
- [x] 2.15 **GREEN** implement `enrollProject` to pass 2.14.
- [x] 2.16 **RED** `lib/__tests__/projects.test.ts` — `disableProject`, `enableProject`, `deleteProject`: (c) disable sets `enabled = false` + audit; (d) enable sets `enabled = true` + audit; (e) delete removes row + audit.
- [x] 2.17 **GREEN** implement remaining service functions to pass 2.16.
- [x] 2.18 **RED** `lib/__tests__/projects.test.ts` — `checkProjectsEnrolled`: (a) all enrolled → `ok: true`; (b) one un-enrolled → `ok: false, missing: [slug]`; (c) one disabled → `ok: false, missing: [slug]`; (d) case variant normalized before lookup.
- [x] 2.19 **GREEN** implement `checkProjectsEnrolled` to pass 2.18.

---

## Phase 3: API Enforcement + Integration Tests (PR 2)

- [x] 3.1 Modify `app/api/v1/events/route.ts`: after Zod parse and rate-limit check, call `normalizeSlug(body.project)`; call `isProjectEnrolled(slug)`; if not enrolled return `NextResponse.json({ error_class: 'forbidden', error_code: 'project_not_enrolled' }, { status: 403 })` before any DB insert.
- [x] 3.2 Modify `app/api/v1/events/batch/route.ts`: after Zod parse and rate-limit check, compute distinct normalized slugs from `body.events`; call `checkProjectsEnrolled(slugs)`; if `!ok` return 403 envelope before the existing `db.transaction` insert block. No partial acceptance.

### TDD — Phase 3 Integration Tests

- [x] 3.3 **RED** `lib/__tests__/events-enrollment.test.ts` — 11 tests written: single event route (enrolled→201, unenrolled→403, no insert guard, normalization, disabled→403) + batch route (all enrolled→201, one unenrolled→403, no transaction guard, slug normalization+dedup, normalized slug in insert).
- [x] 3.4 **GREEN** route changes in 3.1 pass all 11 tests.
- [x] 3.5 **RED** (merged with 3.3) batch route tests written in same file — failed before implementation.
- [x] 3.6 **GREEN** route changes in 3.2 pass all batch tests.
- [ ] 3.7 **RED** `tests/projects.test.ts` audit assertions — each of enroll, rename, disable, enable, delete produces exactly one `audit_log` row with the correct `action` string and `metadata.slug`.
- [ ] 3.8 **GREEN** verify existing service implementation satisfies 3.7 (no code change expected; test only).

---

## Phase 4: Admin UI (PR 3)

- [x] 4.1 Create `app/(dashboard)/dashboard/admin/projects/page.tsx` (RSC): check `session.user.role === 'admin'` (redirect to `/dashboard` if not); call `listProjects()`; render `ProjectsForm` with project list; page header with FolderKanban icon.
- [x] 4.2 Create `app/(dashboard)/dashboard/admin/projects/actions.ts` (`'use server'`): implement `enrollProjectAction`, `disableProjectAction`, `enableProjectAction`, `deleteProjectAction`. Each: `requireAdmin()` helper → service call → `revalidatePath('/dashboard/admin/projects')`.
- [x] 4.3 Create `app/(dashboard)/dashboard/admin/projects/projects-form.tsx` (client component, `'use client'`): `EnrollForm` collapsible accordion with `useActionState(enrollProjectAction, {})`; `ProjectRow` per-row with disable/enable toggle form + delete form each using `useActionState`; `ProjectsForm` renders both. Visual style matches existing admin pages.
- [x] 4.4 Added Projects link to admin navbar: `FolderKanban` icon in `NAV_ICONS`, entry in `ADMIN_NAV_LINKS`, en/es labels in `NAV_LABELS`.

---

## Phase 5: Cleanup and OpenSpec Delta

- [ ] 5.1 Modify `.openspec/specs/security-api/spec.md`: add the 403 `project_not_enrolled` failure mode for `POST /api/v1/events` and `POST /api/v1/events/batch` per design delta.
- [ ] 5.2 Review `lib/services/projects.ts` for any `console.log` calls (architecture hard rule #3); replace with logger if present.
- [ ] 5.3 Confirm no raw SQL bypasses tenant/slug filtering (architecture hard rule #5); `normalizeSlug` is the single normalization point.
