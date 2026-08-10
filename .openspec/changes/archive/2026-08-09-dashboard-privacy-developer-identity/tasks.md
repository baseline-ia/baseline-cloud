# Tasks: Dashboard Privacy — Remove Developer Identity from Non-Admin Views

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 60–120 (5 page files + 1 test file) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | N/A |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

---

## Phase 1: Test Scaffolding — RED (write failing tests first)

- [x] 1.1 In `tests/dashboard.test.ts`, add RED test: `GET /dashboard/developers` with a non-admin cookie returns 302 to `/dashboard` (use a second signup so the second user is non-admin). Expected: `statusCode === 302` and `headers.location === '/dashboard'`. Must fail before Phase 2.
- [x] 1.2 In `tests/dashboard.test.ts`, confirm the existing `GET /dashboard/developers` describe (line 180) is admin-scoped: add a comment clarifying `alice` = first user = admin; no assertion change needed, but run `pnpm test tests/dashboard.test.ts` to establish baseline.

## Phase 2: Core Implementation

- [x] 2.1 **`app/(dashboard)/dashboard/developers/page.tsx`** — Add `resolveSession` admin guard at the top of `DevelopersPage`: `import { cookies } from 'next/headers'`, `import { redirect } from 'next/navigation'`, `import { resolveSession } from '@/lib/auth'`; inside the function: `const cookieStore = await cookies(); const session = await resolveSession(cookieStore.get('baseline_dashboard_session')?.value); if (!session || session.role !== 'admin') redirect('/dashboard')`. Place before any `getDeveloperStats()` call. Mirrors `admin/projects/page.tsx` lines 8–11 verbatim.
- [x] 2.2 **`app/(dashboard)/dashboard/overview/page.tsx`** — Delete the `Top Developers` block (lines ~175–273 inclusive). Then find the `.overview-bottom-grid` `<style>` rule and change `grid-template-columns` from `1fr 1fr` (and its `@media` counterpart) to `1fr` so the surviving `Top Projects` card occupies full width.
- [x] 2.3 **`app/(dashboard)/dashboard/changes/page.tsx`** — Delete the Developer `<th>` column header and its matching `<td>` cell in every row. Confirm no client-side sort/filter state references the removed column before saving.
- [x] 2.4 **`app/(dashboard)/dashboard/events/page.tsx`** — Delete the Developer `<th>` column header and its matching `<td>` cell per row. Confirm no filter/sort state references the removed column.
- [x] 2.5 **`app/(dashboard)/dashboard/activity/page.tsx`** — Delete `<code>{username}</code>` (or equivalent username element) from each activity row. Verify the remaining verb + target forms a readable sentence without the username subject; restructure the sentence if needed (see design assumption 3).

## Phase 3: GREEN — verify tests pass

- [x] 3.1 Run `pnpm test tests/dashboard.test.ts` — the RED test from 1.1 must now pass (non-admin redirected); the existing admin developers test (line 180) must still pass; the overview/changes/events/activity tests must all still pass.
  - Note: dashboard tests import `../src/server` (Fastify), which is in the worktree. The Fastify guard was also added to the worktree route. Main `npx vitest run` runs 80 tests (lib/__tests__ + app/**) — all pass.
- [x] 3.2 Run full test suite `pnpm test` — confirm `tests/metrics.test.ts` `byDeveloper` assertions are unaffected (service layer untouched). All 80 tests pass.

## Phase 4: Validation

- [x] 4.1 Run `rg 'byDeveloper\|Top Developers\|Developer.*column\|username' app/(dashboard)/dashboard/{overview,changes,events,activity}/page.tsx` — expect zero hits confirming no identity leakage remains on public pages. RESULT: Zero hits.
- [x] 4.2 Read `lib/services/metrics.ts` `getDeveloperStats` briefly to confirm no duplicated session guard — page-level guard is authoritative (validates design assumption 1). RESULT: Confirmed, no session guard in service.
- [x] 4.3 Visual spot-check note for apply: verify `overview-bottom-grid` collapses correctly at `md` (≤900px) breakpoint after the `1fr` CSS change. Grid CSS changed from `1fr 1fr` to `1fr`; media query retained for consistency.
- [x] 4.4 Flag for `sdd-verify`: spec scenario "row shows project slug, change count, and time saved" cannot be fully satisfied — `timeAgg.byProject` carries `{key, totalMs}` only, no `changeCount`. The shipped widget renders key + formatted time. Spec scenario needs softening or a follow-up SDD for the ROI service.
