# Apply Progress: nav-sidebar-redesign

## PR Boundary
- Mode: chained PR slice
- Current work unit: PR 1 — CSS Foundation (tasks 1.1–1.9)
- Chain strategy: stacked-to-main
- Target branch: main
- Estimated review budget impact: ~150 additions + ~108 deletions ≈ 258 changed lines (within 400-line budget)

## Phase 1: CSS Foundation (PR 1) — COMPLETE

- [x] 1.1 Deleted `.navbar` CSS block from `app/globals.css`. CSS-only — no RED phase.
- [x] 1.2 Added `--sidebar-width: 240px` under `:root` in `app/globals.css`. CSS-only — no RED phase.
- [x] 1.3 Added `.dashboard-shell` rule (`display: grid; grid-template-columns: var(--sidebar-width) 1fr; min-height: 100vh`) in `@layer components`. CSS-only — no RED phase.
- [x] 1.4 Added `.dashboard-main` rule (`max-width: min(1400px, 100%); margin: 0 auto; padding: 1.5rem`). CSS-only — no RED phase.
- [x] 1.5 Added `.sidebar` rule (sticky, 100vh, flex column, bg-elevated, border-right, overflow-y auto). CSS-only — no RED phase.
- [x] 1.6 Added `.sidebar-brand`, `.sidebar-brand .logo`, `.sidebar-group`, `.sidebar-group-header`, `.sidebar-link`, `.sidebar-link:hover`, `.sidebar-link.active`, `.sidebar-footer`, `.sidebar-toggle`, `.sidebar-overlay`. CSS-only — no RED phase.
- [x] 1.7 Added `@media (max-width: 767px)` block: single-column grid, sidebar fixed + off-canvas translateX(-100%), `body[data-sidebar-open="true"] .sidebar` reveal, sidebar-toggle shown fixed top-left (z-index 60), sidebar-overlay backdrop. CSS-only — no RED phase.
- [x] 1.8 Verified no `.navbar` selector remains — `rg '.navbar' app/globals.css` returns zero matches. CSS-only — no RED phase.
- [x] 1.9 Verified `.sidebar`, `.dashboard-shell`, `--sidebar-width` all present. `npx tsc --noEmit` passes. `npx vitest run`: 119/119 tests pass. CSS-only — no RED phase.

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `npx vitest run` → 12 test files, 119 tests passed, 0 failed |
| Runtime harness | N/A — CSS-only change; no component boundary; manual `npm run dev` on dashboard routes is the applicable check |
| Rollback boundary | Revert `app/globals.css` only; no component files changed in PR 1 |

## TDD Cycle Evidence

| Task | Mode | RED | GREEN | REFACTOR |
|------|------|-----|-------|----------|
| 1.1–1.9 | CSS-only — no RED phase | N/A | CSS written, verified with rg/grep and TypeScript build | N/A |

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `app/globals.css` | Modified | Removed `.navbar` block (108 lines); added `--sidebar-width` to `:root`; added `.dashboard-shell`, `.dashboard-main`, `.sidebar`, `.sidebar-brand`, `.sidebar-group`, `.sidebar-group-header`, `.sidebar-link`, `.sidebar-link.active`, `.sidebar-footer`, `.sidebar-toggle`, `.sidebar-overlay`, and `@media (max-width: 767px)` responsive block |

## Deviations from Design

- Dark mode parity is handled automatically by the existing token system. The `[data-theme="dark"]` block in `:root` already defines dark variants for `--bg-elevated`, `--border-color`, `--text-muted`, `--cl-primary-soft`, and `--cl-primary`. No additional sidebar-specific dark overrides are needed.
- Added `overflow-y: auto` to `.sidebar` (not in design excerpt but required for tall sidebars and consistent with design's scroll independence goal).
- Added `flex-shrink: 0` to `.sidebar-brand` and `.sidebar-footer` for correct flex layout in the sidebar column.
- Added `.sidebar-overlay` class (task 1.7 / design spec mobile section) to support the backdrop behind the open sidebar on mobile.

## Phase 2: Core Components (PR 2) — COMPLETE

### RED — write failing tests first

- [x] 2.1 RED: Created `app/__tests__/sidebar.test.tsx` with `isActive` unit tests (4 cases).
- [x] 2.2 RED: Added failing test for non-admin: Admin group absent, exactly 6 links.
- [x] 2.3 RED: Added failing test for admin: Admin group present, exactly 11 links.
- [x] 2.4 RED: Added failing test for active link class on matching path.
- [x] 2.5 RED: Added failing test for zero active links on unknown path.
- [x] 2.6 RED: Added failing test for ThemeToggle in `.sidebar-footer`.

### GREEN — implement to pass tests

- [x] 2.7 GREEN: Created `components/layout/sidebar.tsx` — Server Component; NAV_GROUPS (analytics 6 + admin 5); admin filtering by `session.role === 'admin'`; ThemeToggle in footer; isActive from `lib/nav-utils.ts`.
- [x] 2.8 GREEN: Created `components/layout/sidebar-toggle.tsx` — `'use client'`; hamburger button; `document.body.dataset.sidebarOpen`; `aria-expanded`.
- [x] 2.9 GREEN: Updated `app/(dashboard)/layout.tsx` — replaced Navbar with Sidebar + SidebarToggle; `div.dashboard-shell`; `main.dashboard-main`; no `style=` prop.
- [x] 2.10 GREEN: `npx vitest run` — 133/133 tests pass.

### REFACTOR — cleanup

- [x] 2.11 REFACTOR: `components/layout/navbar.tsx` deleted — confirmed absent.
- [x] 2.12 REFACTOR: No import of `navbar` remains in codebase (only a JSDoc comment in `lib/nav-utils.ts`).
- [x] 2.13 REFACTOR: `app/(dashboard)/layout.tsx` has no `style=` on `<main>` — CSS-class-driven only.

Also created `lib/nav-utils.ts` with `isActive(href, currentPath)`.

## Work Unit Evidence (PR 2)

| Evidence | Value |
|---|---|
| Focused test command | `npx vitest run` → 13 test files, 133 tests passed, 0 failed |
| TypeScript | `npx tsc --noEmit` → clean |
| .navbar grep | `grep '.navbar' app/globals.css` → 0 matches |
| navbar import grep | `grep -r 'navbar' src --include="*.ts" --include="*.tsx"` → 0 import matches |

## Files Changed (PR 2)

| File | Action | What Was Done |
|------|--------|---------------|
| `app/__tests__/sidebar.test.tsx` | Created | 16 tests covering isActive, analytics/admin group gating, active link class, ThemeToggle in footer |
| `lib/nav-utils.ts` | Created | `isActive(href, currentPath)` utility |
| `components/layout/sidebar.tsx` | Created | Server Component; full nav groups; admin gating; ThemeToggle in footer |
| `components/layout/sidebar-toggle.tsx` | Created | Client Component; hamburger toggle; aria-expanded |
| `components/layout/navbar.tsx` | Deleted | Superseded by sidebar.tsx |
| `app/(dashboard)/layout.tsx` | Modified | Replaced Navbar with Sidebar + SidebarToggle; CSS-class-driven layout |

## Remaining Tasks

Phase 3 (PR 2 manual QA): tasks 3.1–3.6
Phase 4 (PR 2 compliance): tasks 4.1–4.6

## Status

PR 1: 9/9 complete. PR 2 automated tasks: 13/13 complete (2.1–2.13). All 133 tests pass. TypeScript clean. Ready for PR 2 delivery.
