# Design: Dashboard Privacy — Remove Developer Identity from Non-Admin Views

## 1. Approach Summary

Pure display-layer refactor across five Server Component page files under
`app/(dashboard)/dashboard/`. No new components, no service-layer edits, no
schema or query changes. Four pages have identity elements deleted from their
JSX; one page gains an early `resolveSession` role guard that mirrors the
pattern already in use across `admin/**/page.tsx`.

The Overview page's ranking-widget swap is not a "build a new card" task — a
`Top Projects` widget already exists on the same page (lines 275–358 of
`overview/page.tsx`) driven by `timeAgg.byProject`. This change therefore
**deletes** the `Top Developers` block and **keeps** the existing `Top
Projects` block; layout collapses from a two-card `overview-bottom-grid` to a
single-column card. The proposal's phrasing "add a Top Projects card in its
place" is realized by removing its sibling and letting the existing widget
occupy the full-width slot.

## 2. Architecture

### 2.1 Layering

| Layer | Touched? | Reason |
|-------|----------|--------|
| DB / schema (`lib/db/**`) | No | Identity data still exists; only the render surface changes. |
| Service (`lib/services/**`) | No | `getRoiSummary()` still returns `byDeveloper` (may be consumed by admin pages/tests); removing it would be a wider change with no product win here. |
| Route / RSC (`app/(dashboard)/dashboard/*/page.tsx`) | Yes | All five edits happen here. |
| Client components (`components/**`) | No | The affected JSX is inline in the Server Components; no shared component is coupled to per-developer rendering. |
| Auth (`lib/auth`) | No | `resolveSession` already exists and returns `{ role: 'admin' \| 'user' \| ... }`. |

### 2.2 Data flow (unchanged where possible)

- **Overview**: `Promise.all([getRoiSummary(), getOverviewStats(), getEventsPerDay(30), getTimeAggregates(30)])` remains. `roi.byDeveloper` becomes an unused field on this page (still used elsewhere). `timeAgg.byProject` continues to feed the surviving `Top Projects` widget.
- **Changes / Events / Activity**: same server data fetches; only JSX columns/elements are removed.
- **Developers**: gains a `cookies()` + `resolveSession()` prelude before the existing `getDeveloperStats()` call. On non-admin session, `redirect('/dashboard')` short-circuits before any data fetch — avoids leaking identity data even in server logs.

### 2.3 Component / boundary map

```
app/(dashboard)/dashboard/
├─ overview/page.tsx      [MODIFIED] delete Top Developers block (lines 175–273)
├─ changes/page.tsx       [MODIFIED] delete Developer <th> + <td>
├─ events/page.tsx        [MODIFIED] delete Developer <th> + <td>
├─ activity/page.tsx      [MODIFIED] delete <code>{username}</code> per row
├─ developers/page.tsx    [MODIFIED] add resolveSession admin guard at top
└─ admin/**               [UNCHANGED] identity retained
```

Boundary invariant: the "public dashboard" surface (Overview / Changes /
Events / Activity) becomes identity-free at the render layer; the "admin
dashboard" surface (`admin/**` + `developers`) remains the sole holder of
per-developer visibility. There is no shared table/card component to change —
each page owns its own inline JSX.

## 3. Integration Points

### 3.1 Auth guard on `developers/page.tsx`

Exact pattern to follow (verbatim from `admin/projects/page.tsx` lines 8–11):

```ts
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { resolveSession } from '@/lib/auth'

export default async function DevelopersPage() {
  const cookieStore = await cookies()
  const session = await resolveSession(cookieStore.get('baseline_dashboard_session')?.value)
  if (!session || session.role !== 'admin') redirect('/dashboard')
  // ...existing getDeveloperStats() call and JSX
}
```

Notes:
- The exported helper is `resolveSession(cookieValue)`, not `getSession()`. The context handoff mentioned `getSession()` — that helper does not exist in `lib/auth/`. Design binds to `resolveSession` to match the identical usage in `admin/projects`, `admin/settings`, `admin/tokens`, `admin/users` page files and their `actions.ts` siblings.
- Cookie name is the literal `'baseline_dashboard_session'` — matches every other admin guard call site.
- Redirect target is `/dashboard` (Overview), not a 403 — preserves the "quiet redirect" UX established elsewhere.

### 3.2 Overview layout after Top Developers removal

Current layout:

```
overview-bottom-grid (grid-template-columns: 1fr 1fr)
├─ Top Developers card
└─ Top Projects card
```

Post-change layout:

```
overview-bottom-grid (grid-template-columns: 1fr)   // or drop the wrapper
└─ Top Projects card                                 // now full-width
```

Decision: keep the `.overview-bottom-grid` wrapper and change its
`grid-template-columns` to `1fr` (both the base and the `@media` rule). This
is a one-line CSS tweak in the same `<style>` block already inside
`overview/page.tsx`; it avoids restructuring the JSX tree and keeps the
existing Top Projects card rendering with the same styles.

Rejected alternative: unwrap the grid entirely and let Top Projects sit as a
sibling card. Rejected because it introduces a subtle spacing regression at
the `@media (max-width: 900px)` breakpoint where the grid currently manages
vertical gap.

### 3.3 Spec vs. reality: `byProject` shape mismatch

The spec's `Requirement: Top Projects Card Replaces Top Developers
Leaderboard` says each row MUST show "project slug, change count, and time
saved". The existing `Top Projects` widget uses `timeAgg.byProject` which is
typed `Array<{ key: string; totalMs: number }>` — it carries **no per-project
change count**. The proposal's suggestion that `getRoiSummary().byProject`
supplies `{project, changes, timeSaved}` is not true today: `getRoiSummary()`
returns `byWorkType` and `byDeveloper` only.

Design decision: **Ship the widget with the fields it can honestly render
today** — project key (slug) and formatted time (`formatMs(totalMs)`). Do
NOT invent a change-count service edit in this change; that would violate
the proposal's "no service changes" contract and expand scope. The tasks
phase will note this and the spec's scenario for "change count" is deferred
to a follow-up (or the spec should be softened during
`sdd-verify`/`openspec validate`).

Rejected alternatives:
- **Add `changes` to the ROI service and rewire**: violates the scope
  boundary in the proposal ("No service changes. No DB changes.").
- **Compute changes-per-project client-side from `roi` or `changes`**: no
  such array is fetched on Overview today; adding one is a service call and
  still contradicts scope.
- **Delete the existing Top Projects widget and build a new one from
  `getRoiSummary().byProject`**: that field does not exist and would need a
  service edit — same scope violation.

## 4. Key Decisions (ADR-style)

### ADR-1 — Delete the Top Developers block; keep the existing Top Projects widget

- **Context**: Overview already contains both a `Top Developers` (uses `roi.byDeveloper`) and a `Top Projects` (uses `timeAgg.byProject`) card, side by side in `.overview-bottom-grid`.
- **Decision**: Remove the `Top Developers` block entirely. Do not build a new Top Projects card; expand the existing one to full width by switching the grid to `1fr`.
- **Consequences**: Minimum diff. Zero risk of visual regression on the surviving card. Overview loses the two-column ranking layout.
- **Rejected**: Building a fresh "Top Projects" card and deleting both existing cards — larger diff, no functional gain, higher regression risk on already-shipped UI.

### ADR-2 — Bind the admin guard to `resolveSession`, not an imagined `getSession`

- **Context**: Handoff context referenced `getSession()` from a generic auth module; the actual codebase exports only `resolveSession(cookieValue)` from `lib/auth/index.ts`, and every existing admin page uses that plus a `cookies()` read plus the literal cookie name `'baseline_dashboard_session'`.
- **Decision**: Copy the exact 3-line pattern from `admin/projects/page.tsx`. No new helper, no wrapper function.
- **Consequences**: Zero-risk mirroring of an already-proven guard. If the guard pattern ever changes (e.g. `withSession()` HOC), all admin pages and this one migrate together.
- **Rejected**: Introducing an `assertAdmin()` helper in `lib/auth`. Rejected as premature abstraction — five call sites currently use the inline pattern; abstract when there are ten or when the guard grows a second responsibility.

### ADR-3 — No service, DB, or type-signature changes

- **Context**: Spec asks for per-project `change count` on Overview; the current typed data doesn't include it.
- **Decision**: Render only what the current service layer honestly provides (`{key, totalMs}`). Flag the shortfall in tasks so verify/validate can decide between softening the spec scenario or scheduling a follow-up service change.
- **Consequences**: Design stays inside the proposal's declared scope (display-layer only). Spec text becomes the honest source of truth after `openspec validate` reconciliation.
- **Rejected**: Silently synthesizing a change-count aggregation client-side or in a new service function — either breaks scope or misrepresents scope to the reviewer.

### ADR-4 — Route guard only; do not hide the sidebar link in this change

- **Context**: The Developers sidebar entry is currently visible to all authenticated users. A non-admin will see the link, click it, and be redirected.
- **Decision**: Server-side redirect is the security boundary; nav-link visibility is UX polish, explicitly deferred by the proposal.
- **Consequences**: Non-admin users see a "phantom" nav item until follow-up work. This is the accepted, documented risk.
- **Rejected**: Coupling this change to a nav-visibility refactor — expands blast radius into shared layout components without security benefit.

### ADR-5 — Delete inline JSX rather than gate it with a `session.role === 'admin'` conditional

- **Context**: A `{session.role === 'admin' && <DeveloperColumn />}` pattern would keep the identity code paths alive on the same page.
- **Decision**: Delete the JSX outright on public pages. Admin identity lives only under `admin/**` and `developers/page.tsx`.
- **Consequences**: Cleaner audit — grepping `username` under `app/(dashboard)/dashboard/{overview,changes,events,activity}` returns zero hits after the change. Regressions can't quietly reintroduce leakage through a flipped condition.
- **Rejected**: Role-conditional rendering — leaves the leak-prone code paths present in shared trees and makes future audits harder.

## 5. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| `overview-bottom-grid` visual regression when collapsed to `1fr` | Low | Low | One-line CSS change inside the same `<style>` block; visually verify at `md` (≤900px) and `lg`. |
| Spec scenario "row shows change count" cannot be satisfied without a service edit | Med | Med | Design flags for spec revision during `sdd-verify`; alternative is a follow-up SDD change for the ROI service. |
| Snapshot / integration tests reference the removed `Developer` columns or `dev.username` | Med | Low | Tasks phase will call out test updates; run `pnpm test` before merge. |
| `roi.byDeveloper` becomes unused in Overview but still computed server-side | Low | Negligible | Intentional — same service is consumed by admin pages; do not touch service. |
| Non-admin sees Developers nav link and clicks it | Med | Low | Redirect is silent; follow-up SDD can hide the link. Documented in ADR-4. |
| `resolveSession` returns a session shape different from `admin/projects` expectation | Very Low | High | Pattern is copy-pasted from a working call site; guard fails closed if role is missing (`!session \|\| session.role !== 'admin'`). |

## 6. Assumptions Requiring Validation

1. `getDeveloperStats()` (called by `developers/page.tsx`) does not itself gate on session role — the page-level guard is authoritative. **Validate**: quick read of `lib/services/metrics.ts` `getDeveloperStats` during `sdd-apply` to confirm no duplicated guard is needed.
2. Removing the `Developer` column from `changes/page.tsx` and `events/page.tsx` does not break a downstream sort/filter control on the same page. **Validate**: confirm during apply that the removed column is not referenced in any client-side filter/sort state on those pages.
3. The Activity feed row remains coherent without the `<code>{username}</code>` — i.e., action verb + target already form a readable sentence. **Validate**: read `activity/page.tsx` lines 120–130 during apply; if the verb depends on the username being present as a subject, restructure the sentence.
4. Snapshot tests (if any) covering these four pages exist under `__tests__/` or `*.test.tsx`. **Validate**: `rg -l 'byDeveloper|Top Developers|Developer.*column' __tests__ app` during apply.

## 7. Out-of-Scope (explicit)

- Any change under `lib/services/**`, `lib/db/**`, `app/(dashboard)/dashboard/admin/**`.
- Nav/sidebar visibility for the Developers link.
- Anonymization / pseudonymization of usernames.
- Introducing a `withAdmin` HOC or moving the guard into `middleware.ts`.
- Adding per-project change count to `getTimeAggregates()` or `getRoiSummary()`.
- Removing `roi.byDeveloper` from `getRoiSummary()` even though Overview no longer consumes it.
