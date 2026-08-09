---
id: nextjs-migration-spec
change: nextjs-migration
status: approved
---

## Requirements

### R1 — Authentication

- **R1.1** Login form at `/login` accepts username + password, validates against DB using existing HMAC logic, sets `token` cookie, redirects to `/dashboard`.
- **R1.2** Logout clears the `token` cookie and redirects to `/login`.
- **R1.3** All `/dashboard/*` routes require a valid token cookie. Invalid/missing token redirects to `/login` (handled in `middleware.ts`).
- **R1.4** Auth logic in `lib/auth/index.ts` is a direct port — same `hashPassword`, `verifyPassword`, `createToken`, `verifyToken` functions, no algorithm changes.

### R2 — Health endpoint

- **R2.1** `GET /api/health` returns `{ status: "ok", db: "ok" }` with 200 when DB is reachable.
- **R2.2** Returns `{ status: "error", db: "unreachable" }` with 503 when DB is down.

### R3 — Dashboard pages

- **R3.1** `/dashboard` redirects to `/dashboard/overview`.
- **R3.2** Overview page displays: KPI cards (events today, active devs, PRs merged, deploy freq), activity chart (last 30 days), top events list, recent activity feed.
- **R3.3** Events page lists paginated events with filters (type, developer, date range).
- **R3.4** Developers page lists all developers with their stats.
- **R3.5** Changes page shows code change metrics.
- **R3.6** Skills page shows skill distribution.
- **R3.7** Activity page shows chronological activity feed.
- **R3.8** All pages are React Server Components fetching data server-side.
- **R3.9** Charts use Recharts (React-native, no canvas wiring).

### R4 — Navbar

- **R4.1** Two-tier layout: top row has brand logo + user dropdown (username, logout); bottom row has navigation links.
- **R4.2** Active route is highlighted with primary color underline.
- **R4.3** Navigation links scroll horizontally on narrow viewports.
- **R4.4** Navbar is a Server Component; user dropdown is a Client Component island.

### R5 — Admin pages

- **R5.1** `/dashboard/admin/users` lists all users with avatar, email, role badge, status badge, created date, last login.
- **R5.2** Create user form: username, email, password (min 8), role (member|admin). Uses Server Action.
- **R5.3** `/dashboard/admin/tokens` lists API tokens with name, prefix, expiry, last used.
- **R5.4** `/dashboard/admin/settings` shows system settings (app name, allowed origins, bootstrap admin toggle).
- **R5.5** Admin pages only accessible to users with `role: 'admin'` — checked server-side.

### R6 — REST API routes

- **R6.1** `POST /v1/events` batch ingest: accepts array of event objects, validates, inserts into DB, returns `{ inserted: N }`.
- **R6.2** `POST /v1/auth/signup` creates new user account (requires admin token or bootstrap mode).
- **R6.3** `POST /v1/auth/login` returns JWT-style token for API access.
- **R6.4** `DELETE /v1/auth/logout` invalidates token.
- **R6.5** `POST /v1/auth/token` creates a long-lived API token tied to a user.

### R7 — Docker

- **R7.1** Dockerfile uses multi-stage build: `node:20-alpine` builder runs `npm run build`, runtime stage runs `node .next/standalone/server.js`.
- **R7.2** `docker-compose.yml` has a single `cloud` service. PostgreSQL is external — `DATABASE_URL` is injected as env var.
- **R7.3** Health check: `wget -q -O- http://localhost:3000/api/health | grep -q '"status":"ok"'`.
- **R7.4** Non-root user (`baseline:10001`) in runtime image.
- **R7.5** `src/` directory is removed once Docker validation passes.

### R8 — Design system

- **R8.1** CSS custom properties from existing `globals.css` are preserved (`--primary`, `--background`, `--border`, etc.) for visual continuity.
- **R8.2** Dark mode is supported via `data-theme` attribute toggle.
- **R8.3** shadcn/ui CSS vars are mapped to the existing design tokens.

## Scenarios

### S1 — Happy path login
1. User visits `/dashboard/overview`
2. Middleware redirects to `/login`
3. User submits valid credentials
4. Server Action verifies token, sets cookie, redirects to `/dashboard/overview`
5. Page renders with data from DB

### S2 — Token expiry
1. User has an expired `token` cookie
2. Middleware detects invalid token, redirects to `/login`
3. User logs in again

### S3 — DB down
1. `GET /api/health` is called
2. DB ping fails
3. Returns `503 { status: "error", db: "unreachable" }`

### S4 — Admin creates user
1. Admin visits `/dashboard/admin/users`
2. Expands "Create new user" accordion
3. Fills form, submits
4. Server Action validates, hashes password, inserts user
5. Page revalidates and shows new user in table
