# Tasks: Corporate Skills Server

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 580–650 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1: DB + Service → PR 2: API routes → PR 3: Admin UI + Nav |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | DB schema + migration + service layer | PR 1 | `npx vitest run lib/__tests__/corporate-skills.test.ts` | N/A — service is pure DB; run against test DB | Drop 3 tables via down migration; remove `lib/services/corporate-skills.ts` |
| 2 | API routes `/api/v1/skills` + verify | PR 2 (base: PR 1) | `npx vitest run app/api/v1/skills/` | `curl -H "Authorization: Bearer <token>" /api/v1/skills?project=<slug>` | Delete `app/api/v1/skills/` directory; no other code depends on it |
| 3 | Admin UI (3 files) + sidebar nav + i18n | PR 3 (base: PR 2) | `npx vitest run app/(dashboard)/dashboard/admin/skills/` | Visit `/dashboard/admin/skills` with admin session | Remove `admin/skills/` dir + revert navbar + i18n keys |

---

## Phase 1: Database Foundation

- [x] 1.1 Add `corporateSkills` table definition to `lib/db/schema.ts` (nanoid PK, slug unique, name, description, tool, failClosed, createdByUserId FK SET NULL, createdAt, updatedAt).
- [x] 1.2 Add `corporateSkillVersions` table to `lib/db/schema.ts` (nanoid PK, skillId FK CASCADE, version integer, content text, contentHash text, publishedByUserId FK SET NULL, publishedAt) + `uniqueIndex('uq_skill_version')` on `(skillId, version)`.
- [x] 1.3 Add `projectSkillAssignments` table to `lib/db/schema.ts` (nanoid PK, projectSlug FK CASCADE, skillId FK CASCADE, versionId FK SET NULL, failClosed boolean NOT NULL DEFAULT false, assignedByUserId FK SET NULL, assignedAt) + `uniqueIndex('uq_project_skill')` on `(projectSlug, skillId)`.
- [x] 1.4 Add inferred type exports `CorporateSkill`, `CorporateSkillVersion`, `ProjectSkillAssignment` to `lib/db/schema.ts`.
- [x] 1.5 Run `npx drizzle-kit generate` to emit `lib/db/migrations/0002_sharp_jigsaw.sql`; verify three `CREATE TABLE` + two `CREATE UNIQUE INDEX` statements in FK-safe order.
- [x] 1.6 Commit generated SQL migration file unchanged.

## Phase 2: Service Layer (TDD — RED first)

- [x] 2.1 **RED** Create `lib/__tests__/corporate-skills.test.ts`; write failing test: `createCorporateSkill` inserts row and writes audit entry `corporate_skill.created`.
- [x] 2.2 **RED** Add failing test: duplicate slug throws `SkillSlugTakenError`.
- [x] 2.3 **RED** Add failing test: invalid slug format (`My Skill!`) throws validation error.
- [x] 2.4 **RED** Add failing test: `publishSkillVersion` inserts version 1, `contentHash === sha256(content)`.
- [x] 2.5 **RED** Add failing test: second publish yields `version = 2`; first row unchanged.
- [x] 2.6 **RED** Add failing test: `getAssignmentsForProject` returns `failClosed` from assignment row directly (not OR-merged with skill default).
- [x] 2.7 **RED** Add failing test: `null versionId` resolves to `MAX(version)` content via lateral join.
- [x] 2.8 **RED** Add failing test: `assignSkillToProject` with no published versions throws `SkillNotPublishedError`.
- [x] 2.9 **RED** Add failing test: `unassignSkill` removes row and writes audit `project_skill.unassigned`.
- [x] 2.10 **GREEN** Create `lib/services/corporate-skills.ts`; export `SKILL_SLUG_RE`, `SkillSlugTakenError`, `SkillNotFoundError`, `SkillNotPublishedError`.
- [x] 2.11 **GREEN** Implement `createCorporateSkill`: validate slug with `SKILL_SLUG_RE`, insert, catch `23505` → `SkillSlugTakenError`, call `writeAudit('corporate_skill.created', ...)`.
- [x] 2.12 **GREEN** Implement `publishSkillVersion`: transaction → `SELECT COALESCE(MAX(version),0)+1`, compute SHA-256 via `createHash('sha256').update(content).digest('hex')`, insert, retry once on `23505`, call `writeAudit('skill_version.published', ...)`.
- [x] 2.13 **GREEN** Implement `listCorporateSkills`: left-join with `MAX(version)` subquery.
- [x] 2.14 **GREEN** Implement `getCorporateSkill(slug)`: single skill + all versions desc.
- [x] 2.15 **GREEN** Implement `getAssignmentsForProject(slug)`: lateral join resolving `versionId IS NULL` to `MAX(version)`; return `failClosed` from assignment row directly.
- [x] 2.16 **GREEN** Implement `assignSkillToProject`: guard no published version when failClosed, upsert on `(projectSlug, skillId)`, call `writeAudit('project_skill.assigned', ...)`.
- [x] 2.17 **GREEN** Implement `unassignSkill`: delete by `(projectSlug, skillId)`, call `writeAudit('project_skill.unassigned', ...)`.
- [x] 2.18 Run `npx vitest run lib/__tests__/corporate-skills.test.ts` — all tests GREEN.

## Phase 3: API Routes (TDD — RED first)

- [x] 3.1 **RED** Create `app/api/v1/skills/route.test.ts`; write failing tests: valid token + enrolled project → 200 with skills array; no token → 401; valid token + unenrolled → 403; enrolled + no assignments → `{ ok: true, skills: [] }`.
- [x] 3.2 **RED** Add failing test: `contentHash` in response matches `sha256(content)` byte-for-byte.
- [x] 3.3 **RED** Add failing test: assignment `failClosed` value is returned directly (not OR-merged with skill-level flag).
- [x] 3.4 **RED** Create `app/api/v1/skills/[slug]/verify/route.test.ts`; write failing tests: assigned skill → 200 `{ active: true, version, contentHash }`; not assigned → 404; token missing → 401; unenrolled project → 403.
- [x] 3.5 **RED** Add failing test: after unassignment, verify returns 404 (was previously 200).
- [x] 3.6 **GREEN** Create `app/api/v1/skills/route.ts`: `GET` handler — `extractBearer` → `resolveBearerToken` → 401; `checkRateLimit('skills:${tokenId}', { limit: 60, windowMs: 60_000 })`; read `project` param → 400 if missing; `normalizeSlug` → 400 on error; `isProjectEnrolled` → 403; `getAssignmentsForProject` → `NextResponse.json({ ok: true, skills }, { status: 200 })`.
- [x] 3.7 **GREEN** Create `app/api/v1/skills/[slug]/verify/route.ts`: `GET` handler — same guards as 3.6 (rate-limit key `skills:verify:${tokenId}`); validate slug param with `SKILL_SLUG_RE` → 400; query assignment + resolved version → 404 if none; return `{ ok: true, active: true, version, contentHash }`.
- [x] 3.8 Run `npx vitest run app/api/v1/skills/` — all tests GREEN.

## Phase 4: Admin UI

- [x] 4.1 Create `app/(dashboard)/dashboard/admin/skills/actions.ts` (`'use server'`): `requireAdmin()` helper; Zod schemas `CreateSkillSchema`, `PublishVersionSchema`, `AssignSchema`, `UnassignSchema`; actions `createSkillAction`, `publishVersionAction`, `assignToProjectAction`, `unassignAction` — each calls service and `revalidatePath('/dashboard/admin/skills')`.
- [x] 4.2 Create `app/(dashboard)/dashboard/admin/skills/skills-form.tsx` (`'use client'`): Section 1 — Create Skill form (`slug`, `name`, `description`, `tool` select, `failClosed` checkbox) → `createSkillAction`. Section 2 — skills table with per-row `<details>` panels for Publish Version (textarea + submit) and Manage Assignments (project select + version select + failClosed + assign/unassign buttons).
- [x] 4.3 Create `app/(dashboard)/dashboard/admin/skills/page.tsx` (RSC): resolve session, redirect if not admin, `listCorporateSkills()`, render `<SkillsForm initialSkills={skills} />`.
- [x] 4.4 **RED** Write `app/(dashboard)/dashboard/admin/skills/skills-form.test.tsx`: non-admin redirect test; create form submission wires to `createSkillAction`; publish panel submits `publishVersionAction` with skillId.
- [x] 4.5 **GREEN** Confirm all skills-form tests pass after 4.1–4.3 implementation.

## Phase 5: Navigation + i18n

- [x] 5.1 In `components/layout/navbar.tsx` add to `ADMIN_NAV_LINKS`: `{ href: '/dashboard/admin/skills', label: 'nav.skills-admin', key: 'admin-skills' }`.
- [x] 5.2 In `components/layout/navbar.tsx` add to `NAV_ICONS`: `'admin-skills': <Zap size={15} />`.
- [x] 5.3 Add `'nav.skills-admin': 'Skills'` to `en` locale file and `'nav.skills-admin': 'Habilidades'` to `es` locale file.
- [ ] 5.4 Smoke test: run dev server, log in as admin, confirm "Skills" link appears in sidebar and navigates to `/dashboard/admin/skills`.

## Phase 6: Integration Verification

- [x] 6.1 Run full test suite `npx vitest run` — no regressions.
- [x] 6.2 Run `npx tsc --noEmit` — zero type errors.
- [ ] 6.3 Manual happy path: create skill → publish v1 → assign to enrolled project → `GET /api/v1/skills?project=<slug>` returns skill with matching `contentHash`; publish v2 → list returns v2 (null pin); pin to v1 → list returns v1.
- [ ] 6.4 Verify concurrent publish guard: simulate two simultaneous publishes; confirm both receive distinct version numbers (unique index backstop).
- [ ] 6.5 Verify `failClosed` semantics: create skill with `failClosed=false`; assign with `failClosed=true`; confirm API returns `failClosed: true` (assignment wins directly, no OR-merge).
