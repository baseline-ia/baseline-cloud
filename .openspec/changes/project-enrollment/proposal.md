# Proposal: Project Enrollment Allowlist

## Intent

Telemetry ingestion accepts any string in the `project` field, so noise, typos,
and unauthorized projects pollute the dataset and inflate storage. Admins have
no way to declare which projects are officially tracked. This change turns
`project` into an admin-managed allowlist: only enrolled projects can send
events; everything else is rejected at the edge with `403`.

## Scope

### In Scope

- New `projects` table (enrollment registry: slug, display name, enabled flag,
  audit metadata).
- Admin-only enrollment CRUD via `/dashboard/admin/projects` (list, enroll,
  disable/enable, rename). Server actions gated by `session.role === 'admin'`.
- Allowlist enforcement in `POST /api/v1/events` and `POST /api/v1/events/batch`:
  reject non-enrolled or disabled projects with `403` and
  `{ error_class: 'forbidden', error_code: 'project_not_enrolled' }`.
- Batch semantics: the entire batch is rejected `403` if ANY event references
  a non-enrolled project (all-or-nothing, consistent with existing transaction).
- Audit log entries for enroll / disable / enable / rename actions.
- Data migration: seed enrollment from existing distinct `events.project` values
  so historical projects keep working; admins can prune after review.

### Out of Scope

- Per-project quotas, rate limits, or retention policies.
- Per-project token scoping (tokens remain user-scoped).
- Project-to-user ownership or team membership.
- Bulk import / CSV upload UI.
- Migrating `events.project` to a foreign key (kept as text for historical
  integrity; enforcement lives in the API layer).
- CLI-side project registration or self-service enrollment.

## Capabilities

### New Capabilities

- `project-enrollment`: admin-managed allowlist of projects permitted to submit
  telemetry, with lifecycle (enroll, disable, re-enable, rename) and audit trail.

### Modified Capabilities

- `security-api`: event ingestion endpoints gain a `403` failure mode when the
  `project` field is not in the enrolled/enabled set.

## Approach

Add a `projects` table keyed by lowercase slug with `enabled` boolean and audit
columns. Ingestion normalizes the incoming `project` string (trim + lowercase),
looks it up in the enrollment set, and rejects with `403` when missing or
disabled. Lookup is a single indexed query per request; batch does one lookup
of the distinct slug set. The admin page mirrors the existing tokens/settings
pages (server component + server actions + shadcn Table).

Rejected: (a) storing the allowlist in `settings` JSON — poor auditability and
awkward CRUD; (b) making `events.project` a foreign key — breaks historical
inserts and complicates the migration.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `lib/db/schema.ts` | Modified | Add `projects` table |
| `lib/db/migrations/` | New | SQL migration + seed from existing distinct projects |
| `lib/services/projects.ts` | New | Enrollment service (list, enroll, toggle, rename, isEnrolled) |
| `app/api/v1/events/route.ts` | Modified | Add allowlist check before insert |
| `app/api/v1/events/batch/route.ts` | Modified | Add batch allowlist check |
| `app/(dashboard)/dashboard/admin/projects/` | New | Admin UI (page, form, actions) |
| `.openspec/specs/security-api/spec.md` | Modified | New 403 failure mode for events endpoints |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Existing CLIs sending events for un-enrolled projects break silently | High | Seed enrollment from distinct historical projects on migration; log 403s |
| Lookup adds latency to every event insert | Low | Indexed unique slug; in-process LRU cache with short TTL if needed |
| Race between disable and in-flight batch | Low | Per-request lookup; disabled projects reject within the same transaction |
| Slug normalization inconsistency (case, whitespace) | Med | Normalize on both write and read paths; unique index on normalized slug |

## Rollback Plan

1. Revert route handlers to remove the allowlist check (feature is entirely in
   the API layer; UI and table can remain harmlessly).
2. If needed, `DROP TABLE projects` via down migration; `events.project`
   remains untouched (no FK to unwind).
3. No token or session invalidation required.

## Dependencies

- None external. Uses existing Drizzle, shadcn Table, and session-based admin
  gating already in place.

## Success Criteria

- [ ] Events with un-enrolled `project` are rejected with `403` and the
      documented error envelope.
- [ ] Batch containing any un-enrolled project is rejected atomically.
- [ ] Admins can enroll, disable, re-enable, and rename projects from the UI.
- [ ] All enrollment mutations produce audit log entries.
- [ ] Historical projects from the `events` table are seeded on migration so
      currently active CLIs continue to work.
- [ ] Integration tests cover: allowed, not enrolled, disabled, batch mixed,
      normalization edges.

## Proposal question round

The core proposal is defined, but three product decisions would sharpen scope
before spec. Flagging for user review rather than assuming:

1. **Seed policy**: seed ALL historical distinct projects as enabled, or seed
   them as `disabled` so admins must explicitly opt each one in? (Assumption:
   seed as enabled to avoid breaking active CLIs.)
2. **Slug identity**: enrollment slug matches `project` string case-insensitively
   with whitespace trim; is a stricter regex needed (e.g. `[a-z0-9-]+`)?
   (Assumption: lowercase + trim + `[a-z0-9._-]+`, max 128 chars, mirroring the
   current Zod max.)
3. **Disable vs delete**: should admins be able to fully DELETE an enrollment,
   or only disable it? (Assumption: soft-disable only — keeps audit trail and
   preserves the semantic meaning of historical `events.project` rows.)
