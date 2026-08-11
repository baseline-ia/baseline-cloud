---
id: nav-sidebar-redesign
title: Grouped left sidebar navigation for the dashboard shell
status: draft
created: 2026-08-10
---

## Intent

Replace the flat horizontal top navbar with a persistent left sidebar that visually groups analytics links (overview, changes, skills, events, developers, activity) apart from admin links (tokens, users, settings, projects, skills-admin). Today all 11 links render inline with no separator, making it hard to tell operational vs. administrative surface at a glance. Success means the dashboard shell renders a fixed-width left sidebar with two labeled groups, the main content offsets by the sidebar width without layout shift, and the current route stays visually highlighted.

## Scope

### In Scope
- Convert `components/layout/navbar.tsx` into a `Sidebar` component (or introduce `components/layout/sidebar.tsx` and retire the navbar) that renders links in two groups: **Analytics** and **Admin**.
- Update `app/(dashboard)/layout.tsx` shell from a vertically stacked `<div>` to a two-column flex/grid layout (sidebar + main content).
- Introduce a `--sidebar-width` CSS variable (~240px) in `app/globals.css`; main content applies matching left offset / responsive `max-width`.
- Add sidebar CSS block in `app/globals.css` (replacing the existing `.navbar` block at lines 130–236) covering: fixed positioning, vertical link stack, group headers, active-link highlight, hover state, and theme-toggle placement.
- Preserve all 11 existing routes, icons, and behavior; keep `ThemeToggle` reachable from the sidebar.
- Ensure dark-mode parity via existing token system.

### Out of Scope
- Collapsible / mini-rail sidebar mode (icon-only collapsed state) — deferred.
- Mobile off-canvas drawer with hamburger toggle — deferred (first slice targets desktop breakpoints).
- Search box, breadcrumbs, or user avatar/menu in the sidebar — not part of this redesign.
- New nav destinations or route additions; link inventory is unchanged.
- Role-based visibility of admin links (already handled upstream; not revisited here).
- Analytics/telemetry on nav clicks.
- Non-dashboard routes (auth pages, public marketing) — those keep their existing chrome.

## Capabilities

### New Capabilities
- `navigation-shell`: dashboard chrome that renders a grouped left sidebar (Analytics + Admin), owns the sidebar width contract, and hosts the theme toggle. Covers active-route highlighting, group headers, and the layout offset the main content depends on.

### Modified Capabilities
- None (no existing spec describes the top navbar; this is net-new UI capability).

## Approach

Introduce a `Sidebar` server component that maps a static `NAV_GROUPS` array (`{ label, links: [{ href, label, icon }] }`) into two `<nav>` sections with a `<h3>` group header for each. Active-link detection reuses the existing `usePathname` pattern from `navbar.tsx`. The dashboard shell (`app/(dashboard)/layout.tsx`) becomes `<div className="dashboard-shell"><Sidebar /><main>{children}</main></div>`, with `.dashboard-shell` using `display: grid; grid-template-columns: var(--sidebar-width) 1fr; min-height: 100vh`. The `<main>` inline style (`maxWidth: 1400px; margin: 0 auto; padding: 1.5rem`) becomes a class so it can adapt without fighting the grid.

CSS lives entirely in `app/globals.css` under a new `.sidebar` block; the current `.navbar` block is removed in the same commit to avoid dead selectors. Icons and link labels are reused verbatim from `navbar.tsx`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `components/layout/navbar.tsx` | Removed / replaced | Superseded by new sidebar component |
| `components/layout/sidebar.tsx` | New | Grouped left sidebar with Analytics + Admin sections |
| `app/(dashboard)/layout.tsx` | Modified | Two-column shell; renders `<Sidebar />` + `<main>` |
| `app/globals.css` | Modified | Remove `.navbar` block (L130–236); add `.sidebar` + `.dashboard-shell` + `--sidebar-width` |
| `components/layout/theme-toggle.tsx` | Unchanged | Consumed by sidebar footer slot instead of navbar right side |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Content overflow on narrow desktops (<1280px) when 240px sidebar + 1400px max-width main compete | Medium | Cap main `max-width` via `min(1400px, 100% - 3rem)`; verify at 1280/1366 |
| Sticky-scroll behavior differences (old navbar was `position: sticky; top: 0`; sidebar is `position: fixed`/full-height) | Low | Use `position: sticky; top: 0; height: 100vh; align-self: start` within the grid |
| Dark-mode contrast regression on group headers | Low | Reuse existing muted-foreground token; visual QA in both themes |
| Layout shift on first paint (grid template not applied before main renders) | Low | Server-render layout; keep sidebar width as a CSS var with a compile-time default |
| Existing pages depending on top-of-viewport space (headers, hero) may look cramped | Low | Spot-check overview, changes, events pages after shell change |

## Rollback Plan

Single-commit revert: restore `components/layout/navbar.tsx`, revert `app/(dashboard)/layout.tsx` to the vertical stack, and restore the `.navbar` CSS block in `app/globals.css`. No data, migrations, or persisted user state involved — visual-only change. Feature can be reverted independently without touching business logic or API routes.

## Dependencies

- None. No new npm packages, no route changes, no schema or config additions beyond a single CSS variable.

## Success Criteria

- [ ] Dashboard renders with a fixed left sidebar (~240px) instead of a top bar on all `(dashboard)` routes.
- [ ] Analytics group (6 links) and Admin group (5 links) each show a labeled header and are visually separated.
- [ ] Active route is highlighted in the sidebar using the existing accent token.
- [ ] Main content offsets correctly (no overlap with sidebar; no horizontal scroll at ≥1280px viewport).
- [ ] Theme toggle remains accessible and functional from the sidebar.
- [ ] Dark and light themes both pass visual QA (contrast, hover, active state).
- [ ] No regressions in existing page routes; all 11 links continue to navigate to the same destinations.
