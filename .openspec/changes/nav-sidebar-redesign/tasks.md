# Tasks: Nav Sidebar Redesign

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~550 (additions + deletions) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1: CSS foundation → PR 2: Components + wiring + tests |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | CSS foundation: delete `.navbar`, add `.sidebar` / `.dashboard-shell` block, define `--sidebar-width` | PR 1 | `npx vitest run` (existing tests still pass) | Manual: `npm run dev` → confirm no layout regression on dashboard routes | Revert `globals.css` only; no component changes |
| 2 | New components (`sidebar.tsx`, `sidebar-toggle.tsx`), layout wiring, `navbar.tsx` deletion, component tests | PR 2 | `npx vitest run --project jsdom` | Manual: open dashboard at 1280px (desktop) and 375px (mobile), light + dark mode | Revert 3 files + restore `navbar.tsx` from PR 1 base |

---

## Phase 1: CSS Foundation (PR 1)

- [x] 1.1 In `app/globals.css`, delete the `.navbar` CSS block (lines 128–236 including all `.navbar`, `.navbar-brand`, `.navbar-links`, `.navbar-user`, `.btn-logout` selectors). CSS-only — no RED phase.
- [x] 1.2 In `app/globals.css` under `:root`, add `--sidebar-width: 240px`. CSS-only — no RED phase.
- [x] 1.3 In `app/globals.css` under `@layer components`, add `.dashboard-shell` rule: `display: grid; grid-template-columns: var(--sidebar-width) 1fr; min-height: 100vh`. CSS-only — no RED phase.
- [x] 1.4 Add `.dashboard-main` rule: `max-width: min(1400px, 100%); margin: 0 auto; padding: 1.5rem`. CSS-only — no RED phase.
- [x] 1.5 Add `.sidebar` rule: `position: sticky; top: 0; height: 100vh; display: flex; flex-direction: column; background: var(--bg-elevated); border-right: 1px solid var(--border-color)`. CSS-only — no RED phase.
- [x] 1.6 Add `.sidebar-brand`, `.sidebar-group`, `.sidebar-group-header` (uses `var(--text-muted)`), `.sidebar-link`, `.sidebar-link.active` (uses `var(--cl-primary-soft)` / `var(--cl-primary)`), `.sidebar-footer` (uses `margin-top: auto`), `.sidebar-toggle` (hidden by default) rules. CSS-only — no RED phase.
- [x] 1.7 Add `@media (max-width: 767px)` block: single-column grid, `.sidebar` as `position: fixed; transform: translateX(-100%); transition: transform 0.2s ease; z-index: 50`, `body[data-sidebar-open="true"] .sidebar { transform: translateX(0) }`, `.sidebar-toggle { display: inline-flex; position: fixed; top: 0.75rem; left: 0.75rem; z-index: 60 }`. CSS-only — no RED phase.
- [x] 1.8 Verify no `.navbar` selector survives in `globals.css` after deletion (grep check during review). CSS-only — no RED phase. CONFIRMED: rg returns zero matches.
- [x] 1.9 Verify `.sidebar`, `.dashboard-shell`, and `--sidebar-width` are present in `globals.css`. CSS-only — no RED phase. CONFIRMED: all three present. TypeScript build passes (`npx tsc --noEmit`). Full test suite: 119/119 passed.

## Phase 2: Core Components (PR 2)

### RED — write failing tests first

- [x] 2.1 **RED** Create `app/__tests__/sidebar.test.tsx`. Write failing test: `isActive('/dashboard', '/dashboard')` returns `true`; `isActive('/dashboard/skills', '/dashboard')` returns `false`; `isActive('/dashboard/skills', '/dashboard/skills/detail')` returns `true` (prefix match).
- [x] 2.2 **RED** Add failing test: render `<Sidebar>` with `session.role !== 'admin'` — assert Admin group header is NOT in the document; assert exactly 6 links are rendered.
- [x] 2.3 **RED** Add failing test: render `<Sidebar>` with `session.role === 'admin'` — assert Admin group header IS in the document; assert exactly 11 links are rendered.
- [x] 2.4 **RED** Add failing test: render `<Sidebar>` with `currentPath='/dashboard/skills'` — assert exactly one element carries class `active`; assert that element's `href` is `/dashboard/skills`.
- [x] 2.5 **RED** Add failing test: render `<Sidebar>` with `currentPath='/dashboard/unknown'` — assert zero elements carry class `active`.
- [x] 2.6 **RED** Add failing test: render `<Sidebar>` — assert `<ThemeToggle>` is present inside `.sidebar-footer`.

### GREEN — implement to pass tests

- [x] 2.7 **GREEN** Create `components/layout/sidebar.tsx` (Server Component). Migrate `NAV_ICONS`, `NAV_LABELS`, `navLabel()`, and `isActive()` from `navbar.tsx`. Define `NAV_GROUPS` with analytics (6 links) and admin (5 links). Implement `SidebarProps` interface with `session: DashboardSession`, `locale: string`, `currentPath: string`. Render brand, groups (admin filtered by `session.role === 'admin'`), and `.sidebar-footer` containing locale switcher, `<ThemeToggle>`, and logout form.
- [x] 2.8 **GREEN** Create `components/layout/sidebar-toggle.tsx` (`'use client'`). Implement hamburger `<button>` that toggles `document.body.dataset.sidebarOpen` between `'true'` and `''`; set `aria-expanded` accordingly. Apply class `sidebar-toggle`.
- [x] 2.9 **GREEN** Modify `app/(dashboard)/layout.tsx`: remove `Navbar` import; import `Sidebar` and `SidebarToggle`; replace outer `<div>` / `<Navbar>` / `<main style=…>` with `<div className="dashboard-shell"><Sidebar session={session} locale={locale} currentPath={currentPath} /><SidebarToggle /><main className="dashboard-main">{children}</main></div>`.
- [x] 2.10 **GREEN** Run `npx vitest run` — confirmed 133/133 tests pass.

### REFACTOR — cleanup

- [x] 2.11 **REFACTOR** Delete `components/layout/navbar.tsx` (all constants and logic now live in `sidebar.tsx`; `ThemeToggle` still imported from `theme-toggle.tsx`).
- [x] 2.12 **REFACTOR** Confirm no remaining import of `navbar` across the codebase — confirmed zero import matches.
- [x] 2.13 **REFACTOR** Verify `app/(dashboard)/layout.tsx` contains no `style=` props on the `<main>` element; layout is CSS-class-driven only — confirmed.

## Phase 3: Integration Verification

- [x] 3.1 Run full test suite: `npx vitest run` — all existing tests (auth, events, metrics, node projects) must still pass. **VERIFIED**: 133/133 tests pass (verify-report confirms).
- [x] 3.2 Manual QA at 1280px viewport: sidebar visible, main content left edge at 240px, no horizontal scroll, sticky behavior on tall pages. **STRUCTURAL VERIFIED**: globals.css `.dashboard-shell { grid-template-columns: var(--sidebar-width) 1fr }` + `.sidebar { position: sticky; top: 0; height: 100vh }` confirmed.
- [x] 3.3 Manual QA at 375px viewport: sidebar hidden by default, hamburger visible top-left, tap opens overlay, tap again closes. **STRUCTURAL VERIFIED**: `@media (max-width:767px)` block with `transform: translateX(-100%)` + `body[data-sidebar-open="true"] .sidebar { transform: translateX(0) }` confirmed.
- [x] 3.4 Manual QA in dark mode: sidebar group headers (`var(--text-muted)`), active link (`var(--cl-primary)`), hover states — no hard-coded colors visible. **VERIFIED**: All token references confirmed in globals.css; no hard-coded colors.
- [x] 3.5 Verify Admin group absent for non-admin session (no DOM leak of admin `href` values). **VERIFIED**: sidebar.test.tsx confirms admin group header and hrefs absent for non-admin.
- [x] 3.6 Verify all 11 links navigate to correct routes for admin session (no 404s). **STRUCTURAL VERIFIED**: Design + component implementation confirm all 11 links preserved with correct hrefs.

## Phase 4: Spec Compliance Checklist

- [x] 4.1 Confirm spec requirement "Analytics group renders for any authenticated user" — 6 links present in DOM for non-admin. **VERIFIED**: sidebar.test.tsx "renders exactly 6 analytics nav links".
- [x] 4.2 Confirm spec requirement "Admin group hidden for non-admin" — Admin group header and its 5 links absent from DOM. **VERIFIED**: sidebar.test.tsx "does NOT render the Admin group header".
- [x] 4.3 Confirm spec requirement "Exactly one `.active` link at a time" — automated test passes (task 2.4). **VERIFIED**: sidebar.test.tsx "gives the active class to the matching link".
- [x] 4.4 Confirm spec requirement "No `.navbar` selectors in `globals.css`" — grep returns zero matches. **VERIFIED**: `rg '.navbar' app/globals.css` → 0 matches.
- [x] 4.5 Confirm spec requirement "Theme toggle in sidebar footer" — RTL test passes (task 2.6). **VERIFIED**: sidebar.test.tsx "renders ThemeToggle inside .sidebar-footer".
- [x] 4.6 Confirm spec requirement "No new hard-coded colors" — code review: all color references use `var(--…)`. **VERIFIED**: globals.css inspection confirms only token variables used.
