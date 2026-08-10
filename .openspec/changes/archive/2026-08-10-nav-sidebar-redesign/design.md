# Design: Grouped Left Sidebar with Mobile Toggle

## Technical Approach

Replace the flat top-bar `Navbar` with a two-column CSS-grid shell (`Sidebar` + `<main>`) rendered by the existing `app/(dashboard)/layout.tsx` server component. The `Sidebar` stays a Server Component (renders links + admin gating from the already-resolved `DashboardSession`) and delegates only the mobile hamburger open/close state to a small `SidebarToggle` Client Component. Admin-group visibility is enforced at render time using the existing `session.role === 'admin'` check the current navbar already performs (see `components/layout/navbar.tsx:120`). All chrome CSS lives in `app/globals.css` under a new `.sidebar` / `.dashboard-shell` block; the current `.navbar` block (globals.css L128–236) is deleted in the same commit.

## Architecture Decisions

| Decision | Choice | Rejected | Rationale |
|---|---|---|---|
| Server vs. client boundary | Server `Sidebar` + tiny client `SidebarToggle` for mobile open/close only | Full client sidebar | Session/role and current path are already server-resolved in `layout.tsx`; keeps hydration payload minimal, matches existing pattern. |
| Layout technique | CSS Grid `grid-template-columns: var(--sidebar-width) 1fr` on `.dashboard-shell` | Flex row / fixed positioning | Grid gives a natural offset for `<main>` without margin math; sidebar sticky within its grid cell preserves scroll independence. |
| Admin gating | Conditional render `session.role === 'admin' &&` — group and header both omitted | CSS `display:none` or per-link filter | Product decision #1: hidden entirely from DOM for non-admins; matches current navbar's admin gating; no leaked link hrefs in HTML. |
| Mobile strategy | Off-canvas overlay toggled by client `useState`; body class `sidebar-open` drives CSS transform | Media-query-only collapse, `<dialog>`, third-party drawer | Zero new deps, single React state hook, pure CSS transform for animation; a11y via `aria-expanded` + `aria-controls`. |
| CSS ownership | Everything in `globals.css` under `@layer components` | Tailwind utilities on every element / CSS Modules | Matches existing convention (`.navbar`, `.page-header` blocks live there); a single edit swap keeps the diff surgical. |
| Sidebar width | `--sidebar-width: 240px` CSS variable | Hardcoded 240px | Single source of truth used by both `.sidebar` width and `.dashboard-shell` grid template; easy future tuning. |
| Theme toggle location | Sidebar footer slot (`.sidebar-footer`) alongside locale switcher + logout | Floating button / user menu popover | Product decision #3 (no rail): sidebar is always full width, footer is the natural home; keeps `<ThemeToggle>` untouched. |

## Data Flow

```
cookies() ─► resolveSession ─► DashboardSession { role, username }
                                        │
                                        ▼
              app/(dashboard)/layout.tsx (Server)
                                        │
             ┌──────────────────────────┼────────────────────┐
             ▼                          ▼                    ▼
     <Sidebar session locale        <main className=      SidebarToggle
       currentPath />                "dashboard-main">     (Client) — sets
        (Server)                     {children}            body[data-sidebar-open]
             │
             ├── NAV_GROUPS: analytics (6) + admin (5)
             ├── if session.role === 'admin' ⇒ render admin group
             └── footer: LocaleSwitch · <ThemeToggle/> · Logout
```

## File Changes

| File | Action | Description |
|---|---|---|
| `components/layout/sidebar.tsx` | Create | Server Component; renders brand, `NAV_GROUPS` (Analytics + optional Admin), active-link detection, footer slot (locale, theme, logout). Reuses `NAV_ICONS` / `NAV_LABELS` verbatim from current navbar. |
| `components/layout/sidebar-toggle.tsx` | Create | `'use client'` component; renders hamburger `<button>`; toggles `data-sidebar-open` attribute on `<body>` and mirrors it via `aria-expanded`. Hidden at ≥768px via CSS. |
| `components/layout/navbar.tsx` | Delete | Superseded. All constants (icons, labels, `navLabel`, `isActive`) migrate to `sidebar.tsx`. |
| `app/(dashboard)/layout.tsx` | Modify | Replace `<div><Navbar/><main style=…>…</main></div>` with `<div className="dashboard-shell"><Sidebar …/><SidebarToggle/><main className="dashboard-main">{children}</main></div>`. Session/locale/path resolution untouched. |
| `app/globals.css` | Modify | Delete `.navbar` block (L128–236). Add `--sidebar-width: 240px` under `:root`. Add `.dashboard-shell`, `.dashboard-main`, `.sidebar`, `.sidebar-brand`, `.sidebar-group`, `.sidebar-group-header`, `.sidebar-link`, `.sidebar-link.active`, `.sidebar-footer`, `.sidebar-toggle`, `body[data-sidebar-open="true"] .sidebar` blocks. |
| `components/layout/theme-toggle.tsx` | Unchanged | Consumed from `.sidebar-footer` instead of `.navbar-user`. |

## Interfaces / Contracts

```ts
// components/layout/sidebar.tsx
import type { DashboardSession } from '@/lib/auth';

interface SidebarProps {
  session: DashboardSession;   // provides session.role for admin gating
  locale: 'en' | 'es';
  currentPath: string;         // for isActive() highlight
}

interface NavLink { href: string; label: string; key: string }
interface NavGroup { id: 'analytics' | 'admin'; headerKey: string; links: NavLink[] }

const NAV_GROUPS: NavGroup[] = [
  { id: 'analytics', headerKey: 'nav.group.analytics', links: [...6] },
  { id: 'admin',     headerKey: 'nav.group.admin',     links: [...5] },
];
// Render rule: groups.filter(g => g.id !== 'admin' || session.role === 'admin')
```

```ts
// components/layout/sidebar-toggle.tsx
'use client';
// Effect: document.body.dataset.sidebarOpen = open ? 'true' : 'false'
// Cleanup on unmount resets the attribute.
```

Two new i18n keys (`nav.group.analytics`, `nav.group.admin`) are added to the existing `NAV_LABELS` map in `sidebar.tsx` (EN/ES); no external i18n file changes.

## CSS Contract (globals.css)

```css
:root { --sidebar-width: 240px; }

.dashboard-shell {
  display: grid;
  grid-template-columns: var(--sidebar-width) 1fr;
  min-height: 100vh;
}
.dashboard-main {
  max-width: min(1400px, 100%);
  margin: 0 auto;
  padding: 1.5rem;
}
.sidebar {
  position: sticky; top: 0; height: 100vh;
  display: flex; flex-direction: column;
  background: var(--bg-elevated);
  border-right: 1px solid var(--border-color);
}
.sidebar-group-header { color: var(--text-muted); font-size: 0.75rem; letter-spacing: 0.05em; }
.sidebar-link.active { background: var(--cl-primary-soft); color: var(--cl-primary); }
.sidebar-footer { margin-top: auto; }
.sidebar-toggle { display: none; }         /* hamburger hidden ≥768px */

@media (max-width: 767px) {
  .dashboard-shell { grid-template-columns: 1fr; }
  .sidebar {
    position: fixed; left: 0; top: 0; width: var(--sidebar-width);
    transform: translateX(-100%); transition: transform 0.2s ease;
    z-index: 50;
  }
  body[data-sidebar-open="true"] .sidebar { transform: translateX(0); }
  .sidebar-toggle { display: inline-flex; position: fixed; top: 0.75rem; left: 0.75rem; z-index: 60; }
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | `isActive(href, currentPath)` boundary cases (`/dashboard` vs `/dashboard/`) | Vitest, pure function extracted from `sidebar.tsx` |
| Integration | Admin group hidden for `role: 'member'`, visible for `role: 'admin'` | React Testing Library render with mocked `DashboardSession` — assert absence/presence of "Admin" header in DOM |
| Integration | Active-link class applied to exactly one link | RTL, iterate `NAV_GROUPS`, assert `.active` count === 1 |
| Visual QA (manual) | Sidebar at 1280px / 1366px / 1920px; mobile 375px open+closed; light + dark | Spot-check overview, changes, events pages |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. This is a UI shell refactor.

## Migration / Rollout

No data migration, no feature flag, no phased rollout. Single commit replaces the shell for all `(dashboard)` routes atomically. All 11 routes remain unchanged.

**Rollback**: single `git revert <sha>` restores `navbar.tsx`, the vertical-stack layout, and the `.navbar` CSS block. No persisted state to unwind.

## Open Questions

None. All product decisions confirmed by orchestrator (admin hidden, mobile hamburger, no rail).
