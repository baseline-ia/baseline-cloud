---
id: nextjs-migration-tasks
change: nextjs-migration
status: in_progress
---

## Phase 1 — Foundation ✅ COMPLETE

- [x] `package.json` — Next.js 15, React 19, shadcn/ui deps, Recharts, Radix UI, Drizzle
- [x] `tsconfig.json` — Next.js standard config + `@/*` path alias
- [x] `next.config.ts` — `output: 'standalone'`, image domains
- [x] `tailwind.config.ts` — content paths, shadcn plugin
- [x] `postcss.config.mjs` — Tailwind + autoprefixer
- [x] `components.json` — shadcn config (baseColor: slate)
- [x] `drizzle.config.ts` — updated to `lib/db/` paths
- [x] `lib/db/schema.ts` — exact copy from `src/db/schema.ts`
- [x] `lib/db/client.ts` — postgres.js pool with `max_lifetime: 1800`
- [x] `lib/db/migrate.ts` — Drizzle `migrate()` runner
- [x] `lib/db/migrations/.gitkeep` — placeholder
- [x] `lib/config.ts` — env vars, Fastify-only vars removed (PORT/HOST/LOG_LEVEL)
- [x] `lib/auth/index.ts` — HMAC token logic, ported with `@/` imports
- [x] `lib/i18n/index.ts` — i18n helper, Fastify types removed
- [x] `lib/services/metrics.ts` — metrics queries, ported with `@/` imports
- [x] `lib/utils.ts` — shadcn `cn()` utility
- [x] `app/globals.css` — design system + Tailwind directives + shadcn CSS vars
- [x] `app/layout.tsx` — root layout, Inter + JetBrains Mono fonts
- [x] `app/page.tsx` — root redirect to `/dashboard`
- [x] `app/(dashboard)/layout.tsx` — auth guard + Navbar
- [x] `app/(dashboard)/dashboard/page.tsx` — placeholder (redirects to /overview)
- [x] `app/login/page.tsx` — login page
- [x] `app/login/login-form.tsx` — `'use client'` form component
- [x] `app/login/actions.ts` — login Server Action
- [x] `app/api/health/route.ts` — GET /api/health with DB check
- [x] `app/api/auth/logout/route.ts` — DELETE logout, clears cookie
- [x] `middleware.ts` — Edge middleware protecting `/dashboard/*`
- [x] `components/layout/navbar.tsx` — two-tier Server Component
- [x] `components/layout/theme-toggle.tsx` — `'use client'` dark mode toggle
- [x] `components/ui/button.tsx` — shadcn Button
- [x] `components/ui/badge.tsx` — shadcn Badge
- [x] `components/ui/card.tsx` — shadcn Card
- [x] `components/ui/input.tsx` — shadcn Input
- [x] `components/ui/label.tsx` — shadcn Label
- [x] `components/ui/select.tsx` — shadcn Select
- [x] `components/ui/separator.tsx` — shadcn Separator
- [x] `components/ui/dropdown-menu.tsx` — shadcn DropdownMenu

**Merge step:**
- [x] Commit Phase 1 files in worktree branch `worktree-agent-a467615e3ff8150ed`
- [x] Merge worktree branch into main (commit `bee81e1`)
- [x] Fix tsconfig — explicit `include` list to exclude `src/` from Next.js type checking
- [x] `npm install && npm run build` passes ✅
- [x] Copy DB migrations: `src/db/migrations/` → `lib/db/migrations/`
- [ ] Run `npm run dev` and verify `/login` and `/api/health` work

---

## Phase 2 — Dashboard Pages

### Shared components
- [ ] `components/ui/chart.tsx` — Recharts wrapper (ResponsiveContainer + palette)
- [ ] `components/ui/table.tsx` — shadcn Table primitives
- [ ] `components/ui/skeleton.tsx` — loading skeleton
- [ ] `components/dashboard/kpi-card.tsx` — metric card (value, label, icon, delta)
- [ ] `components/dashboard/activity-chart.tsx` — `'use client'` AreaChart
- [ ] `components/dashboard/top-events-list.tsx` — ranked event list

### Pages
- [ ] `app/(dashboard)/overview/page.tsx` — KPI cards + activity chart + top events
- [ ] `app/(dashboard)/events/page.tsx` — events table with filters
- [ ] `app/(dashboard)/developers/page.tsx` — developer stats table
- [ ] `app/(dashboard)/changes/page.tsx` — code change metrics
- [ ] `app/(dashboard)/skills/page.tsx` — skill distribution (PieChart)
- [ ] `app/(dashboard)/activity/page.tsx` — chronological activity feed

### Services
- [ ] Extend `lib/services/metrics.ts` with: `getEventsPage()`, `getDeveloperStats()`, `getChangeMetrics()`, `getSkillDistribution()`, `getActivityFeed()`

---

## Phase 3 — REST API routes

- [ ] `app/api/v1/events/route.ts` — POST batch ingest (validate → insert → return `{ inserted: N }`)
- [ ] `app/api/v1/auth/login/route.ts` — POST login (return API token)
- [ ] `app/api/v1/auth/signup/route.ts` — POST signup (admin token required or bootstrap mode)
- [ ] `app/api/v1/auth/logout/route.ts` — DELETE invalidate token
- [ ] `app/api/v1/auth/token/route.ts` — POST create long-lived API token
- [ ] Add `lib/services/auth-api.ts` — token CRUD helpers

---

## Phase 4 — Admin Pages

### Shared components
- [ ] `components/ui/dialog.tsx` — shadcn Dialog (for confirm modals)
- [ ] `components/ui/form.tsx` + `components/ui/textarea.tsx`

### Users page
- [ ] `app/(dashboard)/admin/users/page.tsx` — users table (avatar, email, role badge, status, dates)
- [ ] `app/(dashboard)/admin/users/actions.ts` — `createUser(formData)` Server Action
- [ ] `components/admin/create-user-form.tsx` — collapsible form (shadcn Accordion or details)

### Tokens page
- [ ] `app/(dashboard)/admin/tokens/page.tsx` — tokens table (name, prefix, expiry, last used)
- [ ] `app/(dashboard)/admin/tokens/actions.ts` — `createToken()`, `revokeToken()` Server Actions

### Settings page
- [ ] `app/(dashboard)/admin/settings/page.tsx` — settings form (app name, allowed origins)
- [ ] `app/(dashboard)/admin/settings/actions.ts` — `updateSettings()` Server Action

---

## Phase 5 — Docker + Cleanup

- [ ] `docker/Dockerfile` — multi-stage Next.js build (standalone output)
  - Builder: `npm ci && npm run build`
  - Runtime: `node .next/standalone/server.js`, port 3000
  - Copy: `.next/standalone/`, `.next/static/`, `public/`
- [ ] `docker/docker-compose.yml` — update healthcheck path to `/api/health`
- [ ] Copy `src/db/migrations/` → `lib/db/migrations/` (if not done in Phase 1 merge)
- [ ] Delete `src/` directory (Fastify code no longer needed)
- [ ] Delete `src/views/` (Eta templates)
- [ ] Update `README.md` — remove Fastify references, add Next.js setup instructions
- [ ] Final Docker build + smoke test

---

## Blocked / Notes

- Phase 2 charts require `'use client'` components — wrap only the chart, keep the page as RSC.
- `lib/db/migrations/` needs the actual SQL files from `src/db/migrations/` — copy during Phase 1 merge or Phase 5.
- Admin role check: verify in `(dashboard)/layout.tsx` or individual admin page `generateMetadata`/page function using `getUser()` from cookies.
- Dark mode: `theme-toggle.tsx` uses `data-theme` attribute on `<html>` — verify `globals.css` uses `[data-theme="dark"]` selector, not `.dark` class (shadcn default).
