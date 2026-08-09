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

## Phase 2 — Dashboard Pages ✅ COMPLETE

### Shared components
- [x] `components/ui/table.tsx` — shadcn Table (7 exports)
- [x] `components/ui/skeleton.tsx` — animate-pulse skeleton
- [x] `components/dashboard/kpi-card.tsx` — metric card with icon, trend, accent
- [x] `components/dashboard/activity-chart.tsx` — `'use client'` Recharts AreaChart
- [x] `components/dashboard/worktype-chart.tsx` — `'use client'` Recharts horizontal BarChart

### Pages (all RSC, routes under /dashboard/*)
- [x] `app/(dashboard)/dashboard/page.tsx` — redirect to /dashboard/overview
- [x] `app/(dashboard)/dashboard/overview/page.tsx` — 4 KPI cards + activity + worktype charts + top devs/projects
- [x] `app/(dashboard)/dashboard/changes/page.tsx` — ROI table with badges, sorted closed-first
- [x] `app/(dashboard)/dashboard/developers/page.tsx` — dev stats with relative time + error rate badges
- [x] `app/(dashboard)/dashboard/activity/page.tsx` — event feed with type categorization
- [x] `app/(dashboard)/dashboard/skills/page.tsx` — skill adoption table with empty state
- [x] `app/(dashboard)/dashboard/events/page.tsx` — raw events with payload preview

Build: ✅ `next build` passes — 13 routes, 0 errors

---

## Phase 3 — REST API routes ✅ COMPLETE

- [x] `app/api/v1/events/route.ts` — POST single event (Bearer auth, Zod validation)
- [x] `app/api/v1/events/batch/route.ts` — POST batch 1–100 events (db.transaction)
- [x] `app/api/v1/auth/signup/route.ts` — POST signup (first-user→admin, duplicate guard, issues token)
- [x] `app/api/v1/auth/login/route.ts` — POST login (audit success/failure, returns active tokens)
- [x] `app/api/v1/auth/token/route.ts` — POST issue token (Bearer + password re-validation)
- [x] `app/api/v1/auth/logout/route.ts` — POST logout (revokes presenting token)

Build: ✅ 22 routes, 0 errors

---

## Phase 4 — Admin Pages ✅ COMPLETE

- [x] `app/(dashboard)/dashboard/admin/tokens/page.tsx` — tokens table + one-time raw token display
- [x] `app/(dashboard)/dashboard/admin/tokens/actions.ts` — `createTokenAction`, `revokeTokenAction`
- [x] `app/(dashboard)/dashboard/admin/tokens/create-token-form.tsx` — `'use client'` form
- [x] `app/(dashboard)/dashboard/admin/users/page.tsx` — users table with avatar circles
- [x] `app/(dashboard)/dashboard/admin/users/actions.ts` — `createUserAction` with Zod validation
- [x] `app/(dashboard)/dashboard/admin/users/create-user-form.tsx` — `'use client'` 4-field grid form
- [x] `app/(dashboard)/dashboard/admin/settings/page.tsx` — time baselines form
- [x] `app/(dashboard)/dashboard/admin/settings/actions.ts` — `updateBaselinesAction`
- [x] `app/(dashboard)/dashboard/admin/settings/settings-form.tsx` — `'use client'` 2-col grid

Build: ✅ 16 routes, 0 errors. All admin pages guard `role !== 'admin'`.

---

## Phase 5 — Docker + Cleanup ✅ PARTIAL

- [x] `docker/Dockerfile` — multi-stage Next.js standalone build (builder → runtime `node server.js`)
- [x] `docker/docker-compose.yml` — healthcheck updated to `/api/health`, removed unused Fastify env vars
- [ ] Delete `src/` directory (Fastify code no longer needed — keep until confirmed working in prod)
- [ ] Update `README.md` — remove Fastify references, add Next.js setup + Docker instructions
- [ ] Final Docker build + smoke test in container

---

## Blocked / Notes

- Phase 2 charts require `'use client'` components — wrap only the chart, keep the page as RSC.
- `lib/db/migrations/` needs the actual SQL files from `src/db/migrations/` — copy during Phase 1 merge or Phase 5.
- Admin role check: verify in `(dashboard)/layout.tsx` or individual admin page `generateMetadata`/page function using `getUser()` from cookies.
- Dark mode: `theme-toggle.tsx` uses `data-theme` attribute on `<html>` — verify `globals.css` uses `[data-theme="dark"]` selector, not `.dark` class (shadcn default).
