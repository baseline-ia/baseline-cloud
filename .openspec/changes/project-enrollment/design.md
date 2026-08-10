# Design: Project Enrollment Allowlist

## Technical Approach

Add a `projects` table (Drizzle) keyed by lowercase `slug` with `enabled` flag and audit metadata. All admin CRUD flows through a new `lib/services/projects.ts` service — the only module allowed to normalize slugs, mutate the table, invalidate the in-process cache, and emit `writeAudit()` entries. Ingestion (`POST /api/v1/events` and `.../batch`) calls `isProjectEnrolled(slug)` — a cached membership predicate — after Zod validation and rate limiting, before the DB insert. Admin UI mirrors the existing tokens/settings pattern (RSC page + `'use server'` actions + client form).

Enforcement is API-layer only; `events.project` stays plain text (no FK) so historical rows survive slug deletion.

## Architecture Decisions

| Decision | Choice | Rejected | Rationale |
|---|---|---|---|
| Audit sink | Reuse existing `auditLog` + `writeAudit()` | New `project_audit_log` table | Table already fits shape; action-string discriminator is the current convention. |
| Slug regex | `^[a-z0-9._-]{1,128}$` (post-normalize) | Stricter `[a-z0-9-]+` | Matches proposal Q2 and permits current CLI-generated slugs (dots, underscores) already found in `events.project`. |
| Delete semantics | Hard delete row; leave `events.project` text stale | Soft-delete only | Spec Requirement `Project Physical Deletion` mandates it; no FK exists so DB is safe. Documented consequence: stale text remains in events. |
| Cache | Module-level `Map<string, {enabled: boolean; expiresAt: number}>` with 30 s TTL, invalidated on write | LRU library / Redis / no cache | Ingestion hot path; matches `lib/rate-limit.ts` single-node assumption; TTL + explicit invalidation gives sub-second staleness under multi-replica (documented limitation). |
| Batch lookup | Single `SELECT slug, enabled FROM projects WHERE slug IN (...)` on the distinct set | Per-event lookup | O(1) query per batch (max 100 events, ≤100 distinct slugs); atomic 403 verdict. |
| Seeding | Blank slate (spec Non-Goal) | Seed from `SELECT DISTINCT project FROM events` | Spec overrides proposal here — explicit enrollment only. Existing CLIs will start receiving 403 until admin enrolls them; called out in Rollout. |
| Error envelope | `{ error_class: "forbidden", error_code: "project_not_enrolled" }` | Custom `error_class: "enrollment"` | Aligns with spec text and existing `error_class` taxonomy (`auth`, `validation`, `rate_limit`, `forbidden`). |
| Slug identity column | `text` PK (nanoid) with `slug` unique | `slug` as PK | Consistent with every other table in the schema; permits future rename without cascade churn. |

## Data Flow

    POST /api/v1/events(/batch)
        │
        ├─→ bearer auth  ─→  rate limit  ─→  Zod validate
        │
        ├─→ normalize project slug(s)                         [service]
        │
        ├─→ isProjectEnrolled(slug)   ┐
        │       │                     │
        │       ├─→ cache hit? ───────┤
        │       └─→ SELECT enabled … ─┘  → cache put
        │
        ├─→ any slug missing/disabled?  ──→ 403 (all-or-nothing for batch)
        │
        └─→ INSERT events (single or tx)  → 201

    /dashboard/admin/projects
        │
        ├─→ page.tsx (RSC): auth gate + listProjects()
        └─→ *-form.tsx  ─→  actions.ts  ─→  projects service
                                              │
                                              ├─→ mutate row
                                              ├─→ invalidateProjectCache(slug)
                                              └─→ writeAudit({ action: 'project.*' })

## File Changes

| File | Action | Description |
|---|---|---|
| `lib/db/schema.ts` | Modify | Append `projects` pgTable, exported types. |
| `lib/db/migrations/0001_projects.sql` | Create | `CREATE TABLE projects` + unique index on `slug` + `updated_at` default. |
| `lib/db/migrations/meta/_journal.json` + snapshot | Modify | Drizzle metadata for migration 0001. |
| `lib/services/projects.ts` | Create | Service: `normalizeSlug`, `enrollProject`, `renameProject`, `disableProject`, `enableProject`, `deleteProject`, `listProjects`, `isProjectEnrolled`, `checkProjectsEnrolled(slugs)`. Owns cache + audit calls. |
| `app/api/v1/events/route.ts` | Modify | After Zod parse: `normalizeSlug` + `isProjectEnrolled`; return 403 envelope on miss. |
| `app/api/v1/events/batch/route.ts` | Modify | Compute distinct normalized slugs; `checkProjectsEnrolled`; 403 if any missing/disabled; then existing `db.transaction` insert. |
| `app/(dashboard)/dashboard/admin/projects/page.tsx` | Create | RSC: session admin gate, `listProjects()`, table with slug/name/enabled/updated, empty-state, form. |
| `app/(dashboard)/dashboard/admin/projects/actions.ts` | Create | `'use server'` actions: `enrollProjectAction`, `renameProjectAction`, `toggleProjectAction`, `deleteProjectAction`. Each: session admin gate → service call → `revalidatePath('/dashboard/admin/projects')`. |
| `app/(dashboard)/dashboard/admin/projects/enroll-project-form.tsx` | Create | Client form (`useActionState`) for slug + display name. |
| `.openspec/specs/security-api/spec.md` | Modify | Add 403 failure-mode requirement (delta from spec). |

## Interfaces / Contracts

**Drizzle table** (`lib/db/schema.ts`):

```ts
export const projects = pgTable(
  'projects',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull().unique(),
    displayName: text('display_name').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdByUserId: text('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  },
  (t) => ({ slugIdx: uniqueIndex('projects_slug_idx').on(t.slug) }),
)
```

**Migration SQL** (`lib/db/migrations/0001_projects.sql`):

```sql
CREATE TABLE IF NOT EXISTS "projects" (
  "id" text PRIMARY KEY NOT NULL,
  "slug" text NOT NULL,
  "display_name" text NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by_user_id" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "projects_slug_idx" ON "projects" ("slug");
--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_user_id_users_id_fk"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
```

**Service surface** (`lib/services/projects.ts`):

```ts
export const SLUG_RE = /^[a-z0-9._-]{1,128}$/
export function normalizeSlug(raw: string): string  // trim().toLowerCase(); throws on invalid post-normalize
export async function isProjectEnrolled(slug: string): Promise<boolean>          // cached
export async function checkProjectsEnrolled(slugs: string[]): Promise<{ ok: true } | { ok: false; missing: string[] }>
export async function listProjects(): Promise<Project[]>
export async function enrollProject(input: { slug: string; displayName?: string; actor: SessionActor }): Promise<Project>
export async function renameProject(input: { id: string; slug?: string; displayName?: string; actor: SessionActor }): Promise<Project>
export async function disableProject(input: { id: string; actor: SessionActor }): Promise<void>
export async function enableProject(input: { id: string; actor: SessionActor }): Promise<void>
export async function deleteProject(input: { id: string; actor: SessionActor }): Promise<void>
```

**Cache** (module-private):

```ts
type Entry = { enabled: boolean; expiresAt: number }
const CACHE_TTL_MS = 30_000
const cache = new Map<string, Entry>()
function invalidate(slug: string): void         // called by every write path
export function __resetProjectsCacheForTests(): void
```

**403 error envelope** (both event routes):

```json
{ "error_class": "forbidden", "error_code": "project_not_enrolled" }
```

**Audit `action` values** (via existing `writeAudit`, `metadata` carries `{ slug, previousSlug?, previousDisplayName? }`):

| Event | `action` |
|---|---|
| Enroll | `project.enrolled` |
| Rename | `project.renamed` |
| Disable | `project.disabled` |
| Re-enable | `project.enabled` |
| Delete | `project.deleted` |

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit | `normalizeSlug` regex + boundaries; cache TTL + invalidation | Vitest, `__resetProjectsCacheForTests()` between cases. |
| Unit | Service CRUD happy + conflict paths | Vitest against `db` (pg or sqlite parity per project convention). |
| Integration | `POST /api/v1/events` — enrolled 201, un-enrolled 403 envelope, disabled 403, normalized-case accepted, no row on 403 | Vitest, real DB, seed one project. |
| Integration | `POST /api/v1/events/batch` — all-enrolled 201, mixed 403 + zero rows, case-variant accepted | Same harness; assert transaction did not commit. |
| Integration | Audit — each mutation writes one `audit_log` row with expected `action` and `metadata.slug` | Query `audit_log` after action. |
| E2E (RSC action) | Non-admin session redirected from `/dashboard/admin/projects` | Existing session-cookie test util. |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. This change only adds a DB table, a service module, an admin UI page, and a membership check inside two existing HTTP handlers.

## Migration / Rollout

1. Ship migration `0001_projects.sql` — empty table, no data movement.
2. Deploy service + admin UI + route enforcement together (single PR).
3. Admin enrolls known projects via `/dashboard/admin/projects` before announcing rollout, or accepts the transient 403s while operators enroll.
4. Monitor 403 rate on event routes for the first 24 h; audit-log entries prove enrollment activity.
5. Rollback: revert the two `route.ts` changes to remove the allowlist check; table can stay in place (idle) or be dropped.

## Open Questions

- [ ] None — proposal Q1 (seed policy) resolved to blank-slate per spec Non-Goals; Q2 (slug regex) adopted `[a-z0-9._-]{1,128}`; Q3 (delete) resolved to hard-delete per spec.
