# Corporate Skills Server — Spec

## Capability: corporate-skills (New)

### Purpose

Admin-managed, versioned SKILL.md catalog with per-project assignments, fail-closed policy, and CLI read API. Tables: `corporate_skills`, `corporate_skill_versions`, `project_skill_assignments`.

---

## Requirements

### Requirement: Skill Catalog Management

The system MUST allow an admin to create a corporate skill. A skill MUST have a unique `slug` (pattern `[a-z0-9-]+`, max 64 chars, lowercase), a `name`, an optional `description`, an optional `tool`, and a `fail_closed` boolean defaulting to `false`. Duplicate slugs MUST be rejected.

#### Scenario: Admin creates a valid skill

- GIVEN an authenticated admin user
- WHEN the admin submits a new skill with a unique slug matching `[a-z0-9-]+` (≤ 64 chars)
- THEN the skill is stored in `corporate_skills` and an audit entry is written
- AND the skill is retrievable by slug

#### Scenario: Duplicate slug is rejected

- GIVEN a skill with slug `my-skill` already exists
- WHEN an admin submits a new skill with slug `my-skill`
- THEN the system returns a validation error
- AND no new row is inserted in `corporate_skills`

#### Scenario: Invalid slug format is rejected

- GIVEN an authenticated admin user
- WHEN the admin submits a slug containing uppercase letters, spaces, or special characters (e.g. `My Skill!`)
- THEN the system returns a validation error identifying the slug constraint

#### Scenario: Slug exceeds max length

- GIVEN an authenticated admin user
- WHEN the admin submits a slug longer than 64 characters
- THEN the system returns a validation error

---

### Requirement: Version Publishing

The system MUST allow an admin to publish a new version of a skill by submitting SKILL.md content. Each publish MUST auto-increment the version number (1, 2, 3, …) scoped to the skill. The system MUST compute and store the SHA-256 hex digest of the raw submitted content at publish time. Published versions MUST be immutable — content MUST NOT be editable after publishing. Concurrent publishes for the same skill MUST resolve to distinct version numbers via a UNIQUE constraint backstop.

#### Scenario: Admin publishes first version

- GIVEN a skill exists with no published versions
- WHEN an admin publishes SKILL.md content
- THEN a row is inserted in `corporate_skill_versions` with `version = 1`
- AND `contentHash` equals SHA-256 hex of the submitted bytes
- AND an audit entry is written

#### Scenario: Admin publishes subsequent version

- GIVEN a skill already has version N published
- WHEN an admin publishes new SKILL.md content
- THEN a row is inserted with `version = N + 1`
- AND the previous version row is unchanged

#### Scenario: Published content cannot be modified

- GIVEN a version already exists in `corporate_skill_versions`
- WHEN any actor attempts to update its `content` or `contentHash`
- THEN the system rejects the operation (no update path exposed)

---

### Requirement: Project Skill Assignment

The system MUST allow an admin to assign a skill to an enrolled project, optionally pinning to a specific `versionId` (`null` means track latest). Each project MUST have at most one assignment per skill (unique on `(projectSlug, skillId)`). Admin MUST be able to unassign. Each assignment MUST carry its own `fail_closed` boolean that overrides the skill-level default.

#### Scenario: Admin assigns skill without pinning

- GIVEN an enrolled project and a skill with at least one published version
- WHEN an admin assigns the skill to the project with no `versionId`
- THEN an assignment row is upserted in `project_skill_assignments` with `versionId = null`
- AND an audit entry is written

#### Scenario: Admin assigns skill pinned to a version

- GIVEN an enrolled project and a published skill version V
- WHEN an admin assigns the skill to the project with `versionId = V`
- THEN the assignment row stores `versionId = V`
- AND the CLI list endpoint returns version V content for that project

#### Scenario: Duplicate assignment upserts

- GIVEN a project already has an assignment for skill S
- WHEN an admin assigns skill S to the same project again (possibly with different pin or failClosed)
- THEN the existing assignment row is updated, not duplicated

#### Scenario: Admin unassigns a skill

- GIVEN a project has an assignment for skill S
- WHEN an admin unassigns skill S from the project
- THEN the assignment row is removed from `project_skill_assignments`
- AND an audit entry is written

#### Scenario: Assignment fail_closed overrides skill default

- GIVEN a skill with `fail_closed = false`
- WHEN an assignment is created with `fail_closed = true`
- THEN the API response for that project returns `fail_closed = true` for that skill

---

### Requirement: CLI Skill Distribution API

The system MUST expose `GET /api/v1/skills?project=<slug>`. The endpoint MUST require a valid Bearer token. The project MUST be enrolled; unenrolled project slugs MUST return 403. The response MUST be HTTP 200 with an array of assigned skills, each containing: `slug`, `name`, `version` (number), full SKILL.md `content`, `contentHash` (SHA-256 hex), and `fail_closed` (resolved: assignment override wins over skill default). If no skills are assigned the array MUST be empty. The `contentHash` returned MUST match the SHA-256 hex of the returned `content` byte-for-byte.

#### Scenario: Authenticated CLI fetches assigned skills

- GIVEN a project is enrolled and has two skill assignments (one pinned, one latest)
- WHEN a CLI sends `GET /api/v1/skills?project=<slug>` with a valid Bearer token
- THEN the response is HTTP 200 with an array of two skill objects
- AND each object contains `slug`, `name`, `version`, `content`, `contentHash`, `fail_closed`

#### Scenario: No skills assigned returns empty array

- GIVEN an enrolled project with no skill assignments
- WHEN a CLI sends `GET /api/v1/skills?project=<slug>` with a valid Bearer token
- THEN the response is HTTP 200 with `[]`

#### Scenario: Unenrolled project is rejected

- GIVEN a project slug that is not enrolled
- WHEN a CLI sends `GET /api/v1/skills?project=<slug>` with a valid Bearer token
- THEN the response is HTTP 403

#### Scenario: Missing or invalid token is rejected

- GIVEN no Authorization header or an invalid Bearer token
- WHEN a request is sent to `GET /api/v1/skills?project=<slug>`
- THEN the response is HTTP 401

#### Scenario: Content hash matches content

- GIVEN a skill assignment is returned in the list response
- WHEN the CLI computes SHA-256 of the returned `content`
- THEN it equals the returned `contentHash`

---

### Requirement: CLI Verify Endpoint

The system MUST expose `GET /api/v1/skills/:slug/verify?project=<slug>`. The endpoint MUST require a valid Bearer token. If the skill is currently assigned to the project, the system MUST return HTTP 200 with `{ active: true, version: <number>, contentHash: "<hex>" }`. If the skill is not assigned, the system MUST return HTTP 404.

#### Scenario: Skill is assigned — returns active true

- GIVEN skill `my-skill` is assigned to enrolled project `acme`
- WHEN a CLI sends `GET /api/v1/skills/my-skill/verify?project=acme` with a valid token
- THEN the response is HTTP 200 with `{ active: true, version: N, contentHash: "<hex>" }`

#### Scenario: Skill is not assigned — returns 404

- GIVEN skill `my-skill` is NOT assigned to project `acme`
- WHEN a CLI sends `GET /api/v1/skills/my-skill/verify?project=acme` with a valid token
- THEN the response is HTTP 404

#### Scenario: Skill unassigned after prior assignment flips to 404

- GIVEN skill `my-skill` was assigned to project `acme` and then unassigned
- WHEN a CLI sends `GET /api/v1/skills/my-skill/verify?project=acme`
- THEN the response is HTTP 404

---

### Requirement: Admin-Only Mutations

All admin UI actions (create skill, publish version, assign, unassign) MUST require the user to have the `admin` role. Non-admin authenticated users MUST be rejected. The CLI API endpoints MUST require only a valid Bearer token (any role).

#### Scenario: Admin performs create — succeeds

- GIVEN an authenticated user with role `admin`
- WHEN the user invokes any admin mutation (create / publish / assign / unassign)
- THEN the operation is permitted and proceeds

#### Scenario: Non-admin is rejected from admin mutations

- GIVEN an authenticated user without the `admin` role
- WHEN the user attempts any admin mutation
- THEN the system returns a 403 / authorization error

#### Scenario: CLI token with non-admin role accesses list endpoint

- GIVEN a valid Bearer token associated with a non-admin user
- WHEN the token is used on `GET /api/v1/skills?project=<slug>`
- THEN the response is HTTP 200 (role is not checked for read API)

---

### Requirement: Audit Trail

The system MUST write an audit entry via `writeAudit` for each of the following mutations: skill creation, version publish, skill assignment, skill unassignment. Each entry MUST be written in the same logical operation as the mutation.

#### Scenario: Audit on skill create

- GIVEN an admin creates a new skill
- WHEN the skill row is inserted
- THEN `writeAudit` is called with an entry identifying the create action and skill slug

#### Scenario: Audit on version publish

- GIVEN an admin publishes a new version
- WHEN the version row is inserted
- THEN `writeAudit` is called with an entry identifying the publish action and version number

#### Scenario: Audit on assign

- GIVEN an admin assigns a skill to a project
- WHEN the assignment is upserted
- THEN `writeAudit` is called with an entry identifying the assign action

#### Scenario: Audit on unassign

- GIVEN an admin unassigns a skill from a project
- WHEN the assignment is deleted
- THEN `writeAudit` is called with an entry identifying the unassign action

---

## Capability: security-api (Delta)

### Delta for: security-api

## ADDED Requirements

### Requirement: Skills List Endpoint Authentication

The system MUST protect `GET /api/v1/skills` using the same Bearer token validation and enrollment guard as the existing events endpoint. Requests without a valid token MUST return 401. Requests with a valid token but an unenrolled project MUST return 403. These guards MUST execute before any data access.

#### Scenario: Valid token, enrolled project — allowed

- GIVEN a valid Bearer token and an enrolled project slug in the query string
- WHEN `GET /api/v1/skills?project=<slug>` is called
- THEN the guard passes and skill data is returned

#### Scenario: Missing token — 401

- GIVEN no Authorization header
- WHEN `GET /api/v1/skills?project=<slug>` is called
- THEN the response is HTTP 401

#### Scenario: Valid token, unenrolled project — 403

- GIVEN a valid Bearer token and a project slug not in the enrollment table
- WHEN `GET /api/v1/skills?project=<slug>` is called
- THEN the response is HTTP 403

---

### Requirement: Skills Verify Endpoint Authentication

The system MUST protect `GET /api/v1/skills/:slug/verify` using the same Bearer token validation and enrollment guard as the skills list endpoint. Auth rules are identical.

#### Scenario: Valid token, enrolled project — allowed

- GIVEN a valid Bearer token and an enrolled project slug in the query string
- WHEN `GET /api/v1/skills/:slug/verify?project=<slug>` is called
- THEN the guard passes and verify data is returned

#### Scenario: Missing token — 401

- GIVEN no Authorization header
- WHEN `GET /api/v1/skills/:slug/verify?project=<slug>` is called
- THEN the response is HTTP 401
