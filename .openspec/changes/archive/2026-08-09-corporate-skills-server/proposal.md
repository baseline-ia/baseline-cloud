# Proposal: Corporate Skills — Server Side

## Intent

Teams need a centrally-managed, versioned library of "skills" (SKILL.md
markdown) that agent CLIs load per project. Today skills live in scattered
local files with no publishing, no versioning, no assignment control, and no
tamper-evidence. Admins have no way to say "this project uses skill X at
version N" nor to force a hard stop when a skill has been revoked. This change
adds the server-side foundation: an admin-managed skill catalog with immutable
versions (SHA-256 hashed), per-project assignments, a fail-closed flag, and a
Bearer-authenticated read API the CLI will consume.

## Scope

### In Scope

- Three new tables: `corporate_skills` (catalog), `corporate_skill_versions`
  (immutable content + SHA-256 hash + monotonic version per skill),
  `project_skill_assignments` (project → skill → version pinning).
- `lib/services/corporate-skills.ts` service: list/get skills, create skill,
  publish a new version (auto-increment, hash on insert), list assignments for
  a project, assign/unassign a skill to a project.
- Bearer-authenticated API for the CLI:
  - `GET /api/v1/skills?project=<slug>` — returns assigned skills with
    content, contentHash, version, and effective fail-closed flag.
  - `GET /api/v1/skills/:slug/verify?project=<slug>` — returns
    `{ active, version, contentHash }` for fail-closed verification.
- Admin UI under `app/(dashboard)/dashboard/admin/skills/`: server component
  page + client form + server actions for create skill, publish version,
  assign/unassign to project.
- Sidebar nav entry "Skills" in the admin section.
- Audit log entries for create, publish, assign, unassign.
- `failClosed` policy at two levels: skill-level default and per-assignment
  override (assignment wins).
- Project-enrollment guard: skill API rejects requests whose `project` slug is
  not enrolled/enabled (reuses existing enrollment allowlist).

### Out of Scope

- CLI implementation, local caching, or fail-closed enforcement in the agent
  runtime (separate change).
- Skill authoring UI beyond a plain textarea (no live markdown preview,
  linting, or SKILL.md schema validation).
- Cross-project bulk assignment, tags, categories, or search UI.
- Version rollback UI (admins can re-assign an older `versionId` manually via
  the assignment form; no dedicated rollback button).
- Delete/hard-remove of skills or versions (soft-only via unassignment;
  versions are immutable by design).
- Per-user or per-team skill ownership; permissions remain admin-only.
- Rate limiting specific to the skills API beyond the global limits.
- Signature/PGP verification of skill content (SHA-256 is the tamper-evidence
  primitive for this iteration).

## Capabilities

### New Capabilities

- `corporate-skills`: admin-managed catalog of versioned SKILL.md content,
  per-project assignments with fail-closed policy, and a Bearer-authenticated
  read API for CLI consumption.

### Modified Capabilities

- `security-api`: adds two new authenticated endpoints under `/api/v1/skills`
  that reuse the existing Bearer-token and project-enrollment guards.

## Approach

Model the catalog as three tables with nanoid(21) text PKs, mirroring existing
conventions. `corporate_skills` holds identity and defaults; each publish
inserts a new `corporate_skill_versions` row with an auto-incremented
`version` (unique per `skillId`) and a SHA-256 hex of `content` computed at
insert time via `node:crypto`. Assignments are upserted by
`(projectSlug, skillId)` and pin an optional `versionId` — null means "track
latest" (resolved at read time). The API returns the pinned version content,
its hash, and the effective `failClosed` (assignment override, else skill
default). The admin UI follows the existing admin pattern (server component
page + `'use client'` form + server actions), matching
`app/(dashboard)/dashboard/admin/projects/`. Bearer auth is copied verbatim
from `app/api/v1/events/route.ts`.

Rejected: (a) storing content in blob storage — small markdown, no benefit,
adds ops burden; (b) mutable versions with an "edit" button — defeats the
whole point of contentHash tamper-evidence; (c) making `versionId` NOT NULL
and forcing admins to re-assign on every publish — high friction, so null
means "latest" with an opt-in pin.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `lib/db/schema.ts` | Modified | Add three tables + FKs |
| `lib/db/migrations/` | New | SQL migration for the three tables |
| `lib/services/corporate-skills.ts` | New | Catalog, versioning, assignments |
| `app/api/v1/skills/route.ts` | New | `GET` list assigned skills for a project |
| `app/api/v1/skills/[slug]/verify/route.ts` | New | `GET` verify endpoint |
| `app/(dashboard)/dashboard/admin/skills/page.tsx` | New | Admin list (RSC) |
| `app/(dashboard)/dashboard/admin/skills/skills-form.tsx` | New | Client form |
| `app/(dashboard)/dashboard/admin/skills/actions.ts` | New | Server actions |
| Admin sidebar nav component | Modified | Add "Skills" link |
| `.openspec/specs/security-api/spec.md` | Modified | Document new endpoints + auth reuse |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Hash mismatch between server-computed and CLI-recomputed hash (CRLF/BOM/whitespace) | Med | Store raw bytes as inserted; document that hash is over the exact UTF-8 bytes served; no server-side normalization |
| Admin publishes a broken SKILL.md and it auto-rolls out to all projects tracking latest | Med | Encourage pin-to-version via UI copy; verify endpoint lets CLI detect drift; rollback = re-assign prior versionId |
| `content` column bloat over many versions | Low | Text column, small payloads; add index only on lookup keys; prune policy deferred |
| Fail-closed misconfiguration bricks a project's CLI | Med | Per-assignment override wins; verify endpoint returns active/version/hash so CLI can degrade with a clear signal; admin can unassign to unblock |
| Bearer-token replay reads skill content of any project the caller names | Low | Reuse existing token auth + project-enrollment guard; document that skill content is not a secret vault (source-of-truth prompts, not credentials) |
| Version number race under concurrent publish | Low | Compute `MAX(version)+1` inside the same transaction; UNIQUE(skillId, version) is the backstop; retry on conflict |

## Rollback Plan

1. Remove the sidebar "Skills" link and the `admin/skills/` route to hide the
   UI; API routes can stay dormant (no writes without UI).
2. Revert `app/api/v1/skills/**` route handlers to make the API 404.
3. Drop the three tables via down migration; no other table references them
   (all FKs point *into* these tables, not out to `events`).
4. No token or session invalidation required; existing Bearer tokens keep
   working for the events API.

## Dependencies

- Existing `users` table (for `createdByUserId`, `publishedByUserId`,
  `assignedByUserId` FKs with `SET NULL` on delete).
- Existing `projects` enrollment table (FK for `projectSlug`).
- Existing Bearer-token auth middleware pattern from
  `app/api/v1/events/route.ts`.
- `node:crypto` (standard library, no new npm dependency).

## Success Criteria

- [ ] Admin can create a skill, publish v1, and assign it to a project via
      the UI; all three actions produce audit log entries.
- [ ] Publishing a new version auto-increments `version` and stores a
      SHA-256 hex of the exact `content` bytes.
- [ ] `GET /api/v1/skills?project=<slug>` returns the assigned skill with
      matching `contentHash === sha256(content)`.
- [ ] `GET /api/v1/skills/:slug/verify?project=<slug>` returns `active: true`
      with current version/hash; returns `active: false` after unassignment.
- [ ] Requests without a valid Bearer token → 401. Requests for a
      non-enrolled or disabled project → 403 (same envelope as events API).
- [ ] Per-assignment `failClosed` override wins over the skill-level default
      in the API response.
- [ ] Integration tests cover: create/publish/assign happy path,
      hash-recompute equality, unassign flips verify to `active: false`, auth
      and enrollment guards, concurrent publish version integrity.

## Proposal question round

The core shape is clear from exploration, but four product decisions would
sharpen the spec. Flagging for user review rather than assuming silently:

1. **Latest-vs-pinned default**: when an admin assigns a skill without
   choosing a version, does the assignment track "latest" (null `versionId`,
   auto-rollout on publish) or does it pin to the current latest at
   assignment time? (Assumption: null = latest, opt-in pin; matches the
   schema shown.)
2. **Fail-closed semantics**: does `failClosed: true` mean the CLI must
   *refuse to run* if it cannot fetch/verify the skill, or that it must
   *refuse to load that specific skill* while other skills still load?
   (Assumption: per-skill refusal — the flag lives on the assignment so it is
   scoped to that skill, not the whole project.)
3. **Verify endpoint scope**: should `verify` also return the full content
   (so CLI can re-hash and compare) or just `{ active, version, contentHash }`
   (CLI trusts its cached content and compares hashes)? (Assumption: hash-only
   per the exploration — content is fetched via the list endpoint, verify is a
   cheap freshness probe.)
4. **Slug identity for skills**: same normalization as `projects` (lowercase +
   trim + `[a-z0-9._-]+`, max 128) or a stricter shape given these become
   filesystem paths in the CLI? (Assumption: `[a-z0-9-]+` max 64 chars, no
   dots/underscores, to keep CLI paths clean and portable.)
