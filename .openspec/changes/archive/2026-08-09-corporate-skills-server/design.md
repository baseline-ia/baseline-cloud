# Design: Corporate Skills — Server Side

## Architectural Approach

Layered, hexagonal-friendly slice that mirrors the existing `projects` capability:

```
Route Handler (app/api/v1/skills/**)         Server Actions (admin/skills/actions.ts)
        |                                                    |
        +-------------------> Service (lib/services/corporate-skills.ts)
                                       |
                                       +----> Drizzle ORM ----> Postgres (3 new tables)
                                       +----> writeAudit (lib/auth)
```

- No new frameworks, no new npm dependencies. Uses `node:crypto` (SHA-256), `drizzle-orm`, `nanoid`, `zod`, and existing auth utilities (`resolveBearerToken`, `resolveSession`, `writeAudit`, `checkRateLimit`, `isProjectEnrolled`, `normalizeSlug`).
- Copies the exact shape of `app/api/v1/events/route.ts` for Bearer + enrollment + rate-limit guards. Copies the exact shape of `app/(dashboard)/dashboard/admin/projects/{page,actions,projects-form}.tsx` for the admin surface.
- All service functions are pure async functions taking a DB handle from the shared `db` singleton and returning plain rows. No repository class abstraction — matches project convention.

## Components & Data Flow

### 1. Database (three new tables)

Added to `lib/db/schema.ts`. Text PKs via `nanoid(21)` matching existing convention (`events.id`, `tokens.id`).

```ts
// corporate_skills — identity + defaults
export const corporateSkills = pgTable('corporate_skills', {
  id: text('id').primaryKey().$defaultFn(() => nanoid(21)),
  slug: text('slug').notNull().unique(),                    // [a-z0-9-]{1,64}
  name: text('name').notNull(),
  description: text('description'),
  tool: text('tool'),                                        // 'claude'|'opencode'|'kiro'|null
  failClosed: boolean('fail_closed').notNull().default(false),
  createdByUserId: text('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// corporate_skill_versions — immutable content snapshots
export const corporateSkillVersions = pgTable('corporate_skill_versions', {
  id: text('id').primaryKey().$defaultFn(() => nanoid(21)),
  skillId: text('skill_id').notNull().references(() => corporateSkills.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),                    // monotonic per skill
  content: text('content').notNull(),                       // full SKILL.md bytes as sent
  contentHash: text('content_hash').notNull(),              // SHA-256 hex of content
  publishedByUserId: text('published_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  publishedAt: timestamp('published_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('uq_skill_version').on(t.skillId, t.version)])

// project_skill_assignments — project ↔ skill with optional version pin
export const projectSkillAssignments = pgTable('project_skill_assignments', {
  id: text('id').primaryKey().$defaultFn(() => nanoid(21)),
  projectSlug: text('project_slug').notNull().references(() => projects.slug, { onDelete: 'cascade' }),
  skillId: text('skill_id').notNull().references(() => corporateSkills.id, { onDelete: 'cascade' }),
  versionId: text('version_id').references(() => corporateSkillVersions.id, { onDelete: 'set null' }),
  failClosed: boolean('fail_closed').notNull().default(false),
  assignedByUserId: text('assigned_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('uq_project_skill').on(t.projectSlug, t.skillId)])
```

Also add inferred types:
```ts
export type CorporateSkill = typeof corporateSkills.$inferSelect
export type CorporateSkillVersion = typeof corporateSkillVersions.$inferSelect
export type ProjectSkillAssignment = typeof projectSkillAssignments.$inferSelect
```

**Migration**: `lib/db/migrations/0002_corporate_skills.sql` — three `CREATE TABLE` statements in the order above (FK order matters), plus the two `CREATE UNIQUE INDEX` statements. Follows the naming pattern of `0001_projects.sql`.

### 2. Service layer — `lib/services/corporate-skills.ts`

Functions (all async, all take user id for audit context where mutating):

| Function | Signature | Behavior |
|---|---|---|
| `listCorporateSkills()` | `() => Promise<Array<CorporateSkill & { latestVersion: number \| null }>>` | Left-joins skills with a subquery `MAX(version)` per skill; used by admin page. |
| `getCorporateSkill(slug)` | `(slug: string) => Promise<{ skill: CorporateSkill; versions: CorporateSkillVersion[] } \| null>` | Single skill + all versions desc; used for the admin expand panel. |
| `createCorporateSkill(input, byUserId)` | `(input: { slug; name; description?; tool?; failClosed? }, byUserId) => Promise<CorporateSkill>` | Validates slug via `SKILL_SLUG_RE`, inserts, catches unique-violation as `SkillSlugTakenError`, writes audit `corporate_skill.created`. |
| `publishSkillVersion(skillId, content, byUserId)` | `(skillId, content: string, byUserId) => Promise<CorporateSkillVersion>` | Inside a transaction: `SELECT COALESCE(MAX(version),0) FROM corporate_skill_versions WHERE skill_id = $1`, insert `version = N+1` and `contentHash = createHash('sha256').update(content).digest('hex')`. On `23505` (unique violation on `(skill_id, version)`), retry once. Writes audit `skill_version.published` with `{ skillId, version }`. |
| `getAssignmentsForProject(projectSlug)` | `(slug) => Promise<Array<{ slug; name; version; content; contentHash; failClosed; tool }>>` | Joins `project_skill_assignments` → `corporate_skills` → resolved `corporate_skill_versions`. When `versionId IS NULL`, resolves to the row with `MAX(version)` for that skill via a correlated subquery / lateral join. `failClosed` is `COALESCE(assignment.fail_closed, skill.fail_closed)` but since both columns are `NOT NULL DEFAULT false`, use `assignment.failClosed OR skill.failClosed` per the "assignment override wins" spec — implemented as `assignment.failClosed` alone since it defaults to false and admins set it explicitly (see ADR-4). |
| `assignSkillToProject(input, byUserId)` | `(input: { projectSlug; skillId; versionId?; failClosed? }, byUserId) => Promise<ProjectSkillAssignment>` | Upsert via Drizzle's `.onConflictDoUpdate({ target: [projectSlug, skillId], set: { versionId, failClosed, assignedByUserId, assignedAt: new Date() } })`. Writes audit `project_skill.assigned`. |
| `unassignSkill(projectSlug, skillId, byUserId)` | `(projectSlug, skillId, byUserId) => Promise<void>` | Delete by `(projectSlug, skillId)`; writes audit `project_skill.unassigned`. |

Local validation constant (not exported from `projects.ts` — skills have their own stricter shape):
```ts
export const SKILL_SLUG_RE = /^[a-z0-9-]{1,64}$/
```

Custom errors:
```ts
export class SkillSlugTakenError extends Error { constructor(public slug: string) { ... } }
export class SkillNotFoundError extends Error { constructor(public slugOrId: string) { ... } }
```

### 3. API routes

Both handlers are thin: auth → rate-limit → enrollment → service → JSON response.

**`app/api/v1/skills/route.ts`** (`GET`):
1. `extractBearer(req)` → `resolveBearerToken(raw)` → 401 `{ error_class: 'auth', error_code: 'token_required' }` on either miss (identical wording to events route).
2. `checkRateLimit(\`skills:${resolved.tokenId}\`, { limit: 60, windowMs: 60_000 })` → `rateLimitResponse(...)` on deny.
3. Read `req.nextUrl.searchParams.get('project')` → 400 `{ error_class: 'validation', error_code: 'project_required' }` if empty.
4. `normalizeSlug(project)` (via `lib/services/projects`) → catch validation error → 400.
5. `await isProjectEnrolled(slug)` → 403 `{ error_class: 'forbidden', error_code: 'project_not_enrolled', project: slug }` if false. (Spec says "unenrolled → 403"; matches events route.)
6. `const skills = await getAssignmentsForProject(slug)`.
7. `return NextResponse.json({ ok: true, skills }, { status: 200 })`.

**`app/api/v1/skills/[slug]/verify/route.ts`** (`GET`):
1. Steps 1–5 identical to above (Bearer, rate limit key `skills:verify:${tokenId}`, project param, enrollment).
2. Read `slug` from route params, normalize with `SKILL_SLUG_RE.test(...)` → 400 on invalid shape.
3. Query for the assignment row joined to skill+version. If none → 404 `{ error_class: 'not_found', error_code: 'skill_not_assigned' }`.
4. `return NextResponse.json({ ok: true, active: true, version, contentHash }, { status: 200 })`.

Response shape for the list endpoint (spec-locked):
```json
{
  "ok": true,
  "skills": [
    {
      "slug": "sdd-apply",
      "name": "SDD Apply",
      "version": 3,
      "content": "# ... full markdown ...",
      "contentHash": "abc123...",
      "failClosed": true,
      "tool": "claude"
    }
  ]
}
```

### 4. Admin UI — `app/(dashboard)/dashboard/admin/skills/`

Three files following `admin/projects/` verbatim (RSC page + `'use client'` form + `'use server'` actions).

**`page.tsx`** (Server Component):
- Resolve session via `cookies() → resolveSession(...)`. Redirect to `/dashboard` if not admin (same as projects page).
- `const skills = await listCorporateSkills()`.
- Render `<SkillsForm initialSkills={skills} />`.

**`skills-form.tsx`** (`'use client'`):
- Uses `useActionState` for each action (same pattern as `projects-form.tsx`).
- Section 1 — Create Skill form: fields `slug`, `name`, `description` (textarea), `tool` (select: none/claude/opencode/kiro), `failClosed` (checkbox). Submits to `createSkillAction`.
- Section 2 — Skills table: one row per skill with columns `slug`, `name`, `latestVersion`, `failClosed`, `tool`, actions. Each row has two expandable panels (details `<details>` element):
  - **Publish Version**: `<textarea name="content">` + submit → `publishVersionAction(skillId, content)`.
  - **Manage Assignments**: fetches per-skill assignment list via a server action returning `{ projectSlug, versionId, failClosed }[]`. Inline form to add: `projectSlug` (text), `versionId` (select of that skill's versions, "Latest" = empty), `failClosed` (checkbox) → `assignToProjectAction`. Per-row "Unassign" button → `unassignAction`.

**`actions.ts`** (`'use server'`):
- `requireAdmin()` helper identical to projects (`resolveSession` → redirect if not admin).
- Zod schemas: `CreateSkillSchema`, `PublishVersionSchema`, `AssignSchema`, `UnassignSchema`.
- Actions: `createSkillAction`, `publishVersionAction`, `assignToProjectAction`, `unassignAction`. Each: `requireAdmin()` → parse FormData → try service call → `revalidatePath('/dashboard/admin/skills')` → return `{ success: true }` or `{ error }`.

### 5. Sidebar nav — `components/layout/navbar.tsx`

Add to `ADMIN_NAV_LINKS`:
```ts
{ href: '/dashboard/admin/skills', label: 'nav.skills-admin', key: 'admin-skills' },
```
Add to `NAV_ICONS`: `'admin-skills': <Zap size={15} />` (icon already imported).
Add label to both `en` and `es`:
- `en`: `'nav.skills-admin': 'Skills'`
- `es`: `'nav.skills-admin': 'Habilidades'`

Note the existing `nav.skills` key is for the read-only `/dashboard/skills` (member view), separate from `nav.skills-admin` under admin. Different `key` avoids icon collision.

## Integration Points

| Existing surface | How it is reused |
|---|---|
| `resolveBearerToken`, `extractBearer` pattern | Copied 1:1 from events route |
| `checkRateLimit`, `rateLimitResponse` | Same helpers, new keys `skills:${tokenId}` and `skills:verify:${tokenId}` |
| `isProjectEnrolled`, `normalizeSlug` | Same guard, no changes to `lib/services/projects.ts` |
| `writeAudit` from `lib/auth` | Called from all four mutating service functions |
| `resolveSession` + admin role check | Identical to `admin/projects/actions.ts::requireAdmin` |
| Drizzle `db` singleton | Same client, no separate connection |
| `users.id` FK | `SET NULL on delete` — deleting a user does not erase history |
| `projects.slug` FK | `CASCADE on delete` — deleting a project drops its assignments |

## ADRs

### ADR-1: Text-column storage over blob storage
**Decision**: Store SKILL.md content as `TEXT NOT NULL` in `corporate_skill_versions.content`.
**Rationale**: Payloads are small (few KB markdown). No BLOB store operator burden, no fetch round-trip on the hot API path, no dual-write consistency risk, no signed-URL machinery. Postgres TEXT has no meaningful upper bound for this use case.
**Rejected**: S3/blob storage (adds ops, hides content from `psql`, no benefit at this size).

### ADR-2: Immutable versions with monotonic integer per skill
**Decision**: `corporate_skill_versions` rows are insert-only. `version` is `INT NOT NULL` scoped per `skill_id`, computed as `MAX(version)+1` inside a transaction, backstopped by `UNIQUE(skill_id, version)`. No update path is exposed.
**Rationale**: Tamper-evidence (`contentHash`) is meaningless if content mutates. Monotonic integers per skill are human-readable ("v3"), unlike UUIDs; the UNIQUE constraint eliminates race windows even under concurrent publishes.
**Rejected**: (a) UUID-only versioning (loses human-readable v1/v2/v3 semantics that admins expect); (b) mutable versions with an `edit` button (destroys hash provenance); (c) global monotonic version across all skills (unnecessary coupling).

### ADR-3: `versionId NULL` means "track latest"
**Decision**: `project_skill_assignments.versionId` is nullable. `NULL` = resolve to `MAX(version)` at read time. Pinning is opt-in.
**Rationale**: Forcing admins to re-assign every skill after every publish is high-friction and would produce stale pins by default. The verify endpoint gives CLIs a cheap drift signal so they can react without forcing pinning.
**Rejected**: NOT NULL versionId (defeats zero-touch rollouts); auto-repin-to-latest on publish (silent mutation, harder to reason about); explicit `pin_mode` enum (over-engineered for a two-state truth already expressed by nullability).

### ADR-4: Per-assignment `failClosed` overrides skill default via boolean OR
**Decision**: Both `corporate_skills.failClosed` and `project_skill_assignments.failClosed` are `BOOLEAN NOT NULL DEFAULT false`. Effective policy is `assignment.failClosed || skill.failClosed`.
**Rationale**: Spec says "assignment wins". With both defaulting to false, the assignment column starts at false and admins must explicitly opt in; the skill-level default remains authoritative for skills where security demands hard-stop everywhere. A logical OR ("if either says fail-closed, be fail-closed") is the safer merge — no admin can accidentally relax a globally-critical skill by leaving the assignment at default false. If a spec scenario demands strict "assignment overrides" semantics (an admin can turn OFF fail-closed for one project even when the skill default is ON), swap to `assignment.failClosed` alone. **Assumption locked as OR-merge**; flag on review if scenario "Assignment fail_closed overrides skill default" (spec line 103–107) is intended as override-both-ways.

### ADR-5: SHA-256 via `node:crypto`, hashed at insert time, over raw submitted bytes
**Decision**: `contentHash = createHash('sha256').update(content).digest('hex')` computed in the service before insert. No server-side normalization (no CRLF fixup, no BOM strip, no trailing-newline enforcement).
**Rationale**: The hash must be verifiable byte-for-byte by the CLI over the exact bytes served. Any transform introduces a mismatch class the CLI cannot recover from. Document this contract in the API response ("hash covers the exact `content` bytes returned").
**Rejected**: `pgcrypto` `digest()` at DB level (portability concern, tests would need a running Postgres for hashing); PGP/signature (spec explicitly out of scope for this iteration).

### ADR-6: Stricter slug shape than projects (`[a-z0-9-]{1,64}`)
**Decision**: Skill slugs use `SKILL_SLUG_RE = /^[a-z0-9-]{1,64}$/`. No dots, no underscores, tighter length.
**Rationale**: Skill slugs become filesystem paths in the CLI (`.claude/skills/<slug>/SKILL.md`). Dots trigger extension parsing, underscores are inconsistent with the kebab-case convention seen in the shipped skill directory (`sdd-apply`, `sdd-verify`, etc.), and 64 chars is generous for a filename segment while staying safely under filesystem limits.
**Rejected**: Reuse `projects.SLUG_RE` (`[a-z0-9._-]{1,128}` — too permissive for filesystem paths).

### ADR-7: Upsert on `(projectSlug, skillId)` — one assignment per pair
**Decision**: `UNIQUE(project_slug, skill_id)`. Re-assigning updates version pin and failClosed in place.
**Rationale**: Multiple assignments of the same skill to one project is a nonsense state (which one wins?). Upsert gives idempotent admin ergonomics — the "assign" form is also the "edit" form.
**Rejected**: Historical assignment log (out of scope; audit table captures assign/unassign events already).

### ADR-8: No dedicated skills rate limit tier; reuse global helper with per-token key
**Decision**: `checkRateLimit(\`skills:${tokenId}\`, { limit: 60, windowMs: 60_000 })` for list and `skills:verify:${tokenId}` at same limit for verify.
**Rationale**: CLI polls the verify endpoint on skill load — 60/min per token is generous for interactive use, cheap to enforce with the existing in-memory helper. Different key prefix from events (`events:single:${userId}`) keeps buckets independent.
**Rejected**: Cross-endpoint shared bucket (couples unrelated traffic patterns); per-project bucket (attacker can pivot to another project easily).

### ADR-9: Latest-version resolution in SQL, not application code
**Decision**: `getAssignmentsForProject` uses a lateral join / correlated subquery to resolve `versionId IS NULL` to `MAX(version)` in one round-trip:
```sql
SELECT ... FROM project_skill_assignments a
JOIN corporate_skills s ON s.id = a.skill_id
LEFT JOIN LATERAL (
  SELECT * FROM corporate_skill_versions v
  WHERE v.skill_id = a.skill_id
    AND (a.version_id IS NULL OR v.id = a.version_id)
  ORDER BY v.version DESC
  LIMIT 1
) v ON true
WHERE a.project_slug = $1
```
**Rationale**: N+1 avoidance for projects with many assignments. One query per API call.
**Rejected**: Application-side loop querying versions per assignment (N+1); materialized view (invalidation complexity for a low-traffic read).

### ADR-10: Sidebar entry as a separate admin link key (`admin-skills`)
**Decision**: Add to `ADMIN_NAV_LINKS`, distinct from the existing `skills` member-view key. Reuse the `Zap` icon already imported for the member `/dashboard/skills`.
**Rationale**: `/dashboard/skills` (existing) and `/dashboard/admin/skills` (new) are different pages with different audiences; the admin gate is enforced by the `user.role === 'admin'` check that already wraps `ADMIN_NAV_LINKS.map(...)`. Reusing the icon keeps the visual language consistent.

## Rejected Architectural Alternatives

- **Single "skills" table with a `content` column and mutable rows** — kills version history and hash provenance in one stroke.
- **Event-sourced skills (append-only log, project by replay)** — over-engineered for a 3-table CRUD workflow; adds no capability admins want.
- **GraphQL for the CLI API** — the CLI needs two specific endpoints; REST matches the events API and keeps the auth path identical.
- **Separate microservice for skills** — would fork auth, DB, and deploy paths; nothing about skills warrants that split at current scale.
- **Server-computed hash after normalization (LF-only, no BOM)** — see ADR-5; normalization is a mismatch source that the CLI cannot detect independently.

## Assumptions Requiring Validation

1. **ADR-4 merge semantics**: OR-merge (safer) vs strict-assignment-wins (spec-literal). Locked as OR-merge; flag if wrong.
2. **Slug shape** (proposal Q4): locked to `[a-z0-9-]{1,64}` per proposal assumption.
3. **Verify returns hash-only** (proposal Q3): locked, content only via list endpoint.
4. **Null versionId = latest** (proposal Q1): locked, opt-in pin.
5. **`failClosed` scope** (proposal Q2): per-skill refusal; server merely reports the flag. CLI change (out of scope here) enforces.

## Risks Introduced by This Design

| Risk | Notes |
|---|---|
| `MAX(version)+1` inside app-level tx can race under high concurrency | Unique index is the backstop; single retry on `23505` in `publishSkillVersion`. Publish frequency is human-driven, contention negligible. |
| Text `content` grows unbounded across versions | Deferred prune policy; document that operators can `DELETE FROM corporate_skill_versions WHERE skill_id = $1 AND version < $N` manually, subject to no assignment pinning that version. |
| Admin sets `failClosed=true` on a skill with no published version → CLI locks | Enforce in service: `assignSkillToProject` refuses (`SkillNotPublishedError`) if no version exists for the skill unless `versionId` was explicitly provided. |
| CLI hash mismatch from HTTP compression re-encoding | Hash is computed over raw string in JSON body; middleware compression operates on the wire, not the JSON string, so the client sees identical bytes after `JSON.parse(...).content`. |
| Cache invalidation on publish for CLI cache | Out of scope; verify endpoint is the CLI's freshness primitive. |
