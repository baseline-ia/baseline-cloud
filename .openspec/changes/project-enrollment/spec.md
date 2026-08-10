# Project Enrollment — Spec

<!-- Domains: project-enrollment (new), security-api (delta) -->

---

# Project Enrollment Specification

## Purpose

Define the admin-managed allowlist that gates which projects may submit telemetry
events, including lifecycle management (enroll, rename, disable, re-enable, delete)
and the normalization contract for project slugs.

## Data Model

### Table: `projects` (lib/db/schema.ts)

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | serial / uuid | PK | |
| `slug` | varchar(128) | NOT NULL, UNIQUE | Always lowercase; index on slug |
| `display_name` | varchar(255) | NOT NULL | Human-readable label |
| `enabled` | boolean | NOT NULL, DEFAULT true | Controls allowlist membership |
| `created_at` | timestamptz | NOT NULL, DEFAULT now() | |
| `updated_at` | timestamptz | NOT NULL | Updated on every mutation |

`slug` is the enrollment identity. No foreign key from `events.project` — that
column remains plain text to preserve historical row integrity.

## Requirements

### Requirement: Slug Normalization

The system MUST normalize the `project` value at every write boundary (enroll,
rename) by trimming whitespace and converting to lowercase. The stored `slug`
MUST always be lowercase. The format MUST match `[a-z0-9._-]+`, 1–128 characters.
The system MUST reject slugs that do not satisfy this format after normalization.

#### Scenario: Mixed-case slug is normalized on enrollment

- GIVEN an admin submits the project name `"MyProject"`
- WHEN the enrollment request is processed
- THEN the stored slug is `"myproject"`
- AND the display name preserves the original casing as submitted

#### Scenario: Slug with leading/trailing whitespace is trimmed

- GIVEN an admin submits `"  backend  "` as the project name
- WHEN the enrollment request is processed
- THEN the stored slug is `"backend"`

#### Scenario: Slug with invalid characters is rejected

- GIVEN an admin submits `"my project!"` (contains space and `!`)
- WHEN the enrollment request is processed
- THEN the system returns a validation error
- AND no row is inserted into `projects`

#### Scenario: Slug exceeding 128 characters is rejected

- GIVEN an admin submits a project name whose normalized form exceeds 128 characters
- WHEN the enrollment request is processed
- THEN the system returns a validation error

---

### Requirement: Project Enrollment

The system MUST allow admins to enroll a new project by providing a slug and
optional display name. The enrollment MUST fail if the normalized slug already
exists in the `projects` table (case-insensitive deduplication guaranteed by
lowercase normalization + UNIQUE index). The system MUST record an audit log
entry on successful enrollment.

#### Scenario: Admin enrolls a new project

- GIVEN no project with slug `"alpha"` exists
- WHEN an admin submits enrollment for `"alpha"` with display name `"Alpha Service"`
- THEN a row is inserted with `slug = "alpha"`, `enabled = true`
- AND an audit log entry of type `project_enrolled` is recorded

#### Scenario: Duplicate slug is rejected

- GIVEN a project with slug `"alpha"` already exists
- WHEN an admin attempts to enroll another project that normalizes to `"alpha"`
- THEN the system returns a conflict error
- AND no new row is inserted

#### Scenario: Empty slug is rejected

- GIVEN an admin submits an empty string as the project name
- WHEN the enrollment request is processed
- THEN the system returns a validation error

---

### Requirement: Project Rename

The system MUST allow admins to rename an enrolled project's display name and/or
slug. If the slug changes, the new slug MUST pass the normalization and uniqueness
rules. The system MUST record an audit log entry on successful rename.

#### Scenario: Admin renames a project's display name

- GIVEN a project with slug `"alpha"` exists
- WHEN an admin updates its display name to `"Alpha v2"`
- THEN the `display_name` column is updated
- AND the `slug` remains unchanged
- AND an audit log entry of type `project_renamed` is recorded

#### Scenario: Admin changes slug to a new unique value

- GIVEN a project with slug `"alpha"` exists and no project `"beta"` exists
- WHEN an admin changes the slug to `"Beta"`
- THEN the stored slug becomes `"beta"` (normalized)
- AND an audit log entry of type `project_renamed` is recorded

#### Scenario: Rename to an existing slug is rejected

- GIVEN projects `"alpha"` and `"gamma"` both exist
- WHEN an admin attempts to rename `"alpha"` to `"Gamma"`
- THEN the system returns a conflict error
- AND `"alpha"` remains unchanged

---

### Requirement: Project Disable and Re-enable

The system MUST allow admins to toggle a project's `enabled` flag. A disabled
project MUST NOT be treated as enrolled for allowlist purposes. The system MUST
record an audit log entry for disable and re-enable actions separately.

#### Scenario: Admin disables an enrolled project

- GIVEN a project with slug `"alpha"` is currently `enabled = true`
- WHEN an admin disables it
- THEN `enabled` is set to `false`
- AND an audit log entry of type `project_disabled` is recorded

#### Scenario: Admin re-enables a disabled project

- GIVEN a project with slug `"alpha"` is currently `enabled = false`
- WHEN an admin re-enables it
- THEN `enabled` is set to `true`
- AND an audit log entry of type `project_enabled` is recorded

---

### Requirement: Project Physical Deletion

The system MUST allow admins to permanently delete an enrolled project record.
Deletion removes the row from `projects`. Existing `events` rows referencing the
deleted slug retain their `project` text value; these references become stale
strings and carry no FK constraint. The system MUST record an audit log entry
before deletion.

#### Scenario: Admin deletes an enrolled project

- GIVEN a project with slug `"alpha"` exists
- WHEN an admin deletes it
- THEN the row is removed from `projects`
- AND an audit log entry of type `project_deleted` is recorded

#### Scenario: Deleted project's historical events are unaffected

- GIVEN events exist with `project = "alpha"` and admin deletes the `"alpha"` project
- WHEN those event rows are queried
- THEN they still exist with `project = "alpha"` as a plain text value
- AND no referential error occurs

#### Scenario: Re-enrolling a previously deleted slug is allowed

- GIVEN a project `"alpha"` was deleted
- WHEN an admin enrolls `"alpha"` again
- THEN a new row is inserted and the project is active

---

### Requirement: Admin Enrollment UI

The system MUST provide an admin-only UI at `/dashboard/admin/projects` for
managing the project allowlist. Access MUST be gated to sessions with
`role === 'admin'`. Non-admin requests to this route MUST be redirected or
shown an authorization error.

#### Scenario: Admin views the project list

- GIVEN one or more projects are enrolled
- WHEN an admin navigates to `/dashboard/admin/projects`
- THEN all enrolled projects are listed with their slug, display name, and enabled status

#### Scenario: Empty enrollment list

- GIVEN no projects are enrolled
- WHEN an admin navigates to `/dashboard/admin/projects`
- THEN the page renders without error and shows an empty-state message

#### Scenario: Non-admin cannot access the admin projects page

- GIVEN a session with `role !== 'admin'`
- WHEN the user navigates to `/dashboard/admin/projects`
- THEN the system returns an authorization error or redirects away

---

### Requirement: Audit Log

The system MUST persist an audit log entry for every enrollment lifecycle
mutation: enroll, rename, disable, re-enable, delete. Each entry MUST capture
the acting admin identity, the action type, and the affected slug.

#### Scenario: Each mutation type produces a distinct audit entry

- GIVEN an admin performs each of: enroll, rename, disable, re-enable, delete
- WHEN each action completes successfully
- THEN one audit entry per action is persisted with the correct action type

---

## Non-Goals (Out of Scope)

- Per-project quotas, rate limits, or retention policies
- Per-project token scoping
- Project-to-user ownership or team membership
- Bulk import / CSV upload UI
- Foreign key from `events.project` to `projects.slug`
- CLI-side project registration or self-service enrollment
- Historical seeding from existing `events.project` values (blank slate; each project must be enrolled explicitly)

---

# Delta for Security API

## ADDED Requirements

### Requirement: Project Enrollment Allowlist Check

The event ingestion endpoints MUST verify that the `project` field in the
incoming payload resolves to an enrolled and enabled project before persisting
any data. The system MUST normalize the `project` value (trim + lowercase)
before the lookup. A request whose project is absent from `projects` or has
`enabled = false` MUST be rejected with HTTP 403 and body
`{ "error_class": "forbidden", "error_code": "project_not_enrolled" }`.
No event data MUST be persisted for a rejected request.

For batch ingestion, the entire batch MUST be rejected with HTTP 403 if ANY
event in the batch references a non-enrolled or disabled project. Partial
batch acceptance is not permitted.

#### Scenario: Event with enrolled project is accepted

- GIVEN a project `"alpha"` exists with `enabled = true`
- WHEN `POST /api/v1/events` is called with `{ "project": "alpha", ... }`
- THEN the event is persisted and the endpoint returns a success response

#### Scenario: Event with un-enrolled project is rejected

- GIVEN no project `"unknown-proj"` exists in the enrollment table
- WHEN `POST /api/v1/events` is called with `{ "project": "unknown-proj", ... }`
- THEN the system returns HTTP 403
- AND the body is `{ "error_class": "forbidden", "error_code": "project_not_enrolled" }`
- AND no event row is inserted

#### Scenario: Event with disabled project is rejected

- GIVEN a project `"alpha"` exists with `enabled = false`
- WHEN `POST /api/v1/events` is called with `{ "project": "alpha", ... }`
- THEN the system returns HTTP 403
- AND the body is `{ "error_class": "forbidden", "error_code": "project_not_enrolled" }`

#### Scenario: Project name is normalized before lookup

- GIVEN a project with slug `"alpha"` is enrolled and enabled
- WHEN `POST /api/v1/events` is called with `{ "project": "  Alpha  ", ... }`
- THEN the system normalizes to `"alpha"`, finds the enrolled project, and accepts the request

#### Scenario: Batch with all enrolled projects is accepted

- GIVEN all projects referenced in a batch are enrolled and enabled
- WHEN `POST /api/v1/events/batch` is called with that batch
- THEN all events are persisted and the endpoint returns a success response

#### Scenario: Batch with any un-enrolled project is rejected atomically

- GIVEN a batch contains events for `"alpha"` (enrolled) and `"unknown"` (not enrolled)
- WHEN `POST /api/v1/events/batch` is called
- THEN the system returns HTTP 403
- AND NO events from the batch are persisted (all-or-nothing semantics)
- AND the body is `{ "error_class": "forbidden", "error_code": "project_not_enrolled" }`

#### Scenario: Case variant in batch event is normalized

- GIVEN a project `"alpha"` is enrolled and a batch uses `"ALPHA"` as the project value
- WHEN `POST /api/v1/events/batch` is called
- THEN `"ALPHA"` normalizes to `"alpha"`, the project is found, and the batch is accepted
