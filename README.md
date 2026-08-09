# baseline-cloud

Self-hosted telemetry dashboard for the [`baseline`](https://github.com/amsintegra/ams-base-ai) CLI. The CLI sends events (installs, doctor runs, openspec activity, engram updates) to your self-hosted instance, and the dashboard surfaces per-developer and per-project metrics.

**This is the public, server-only release.** It does NOT contain the `@baseline-ia/baseline-cloud-client` addon (the npm package that the CLI installs to send events). The addon lives in a separate workspace in the team's internal monorepo; install it from npm after `baseline login` and the CLI will auto-discover it.

**Stack**: TypeScript · Next.js 16 (App Router) · React 19 · Drizzle ORM · **PostgreSQL 16** · shadcn/ui · Tailwind CSS · Recharts · Docker.

## Features

- 🔐 **Username + password auth** (bcryptjs); bearer tokens for the CLI; signed cookies for the dashboard.
- 📊 **Event ingest** at `POST /api/v1/events` with Zod-validated payloads, fire-and-forget from the CLI.
- 📈 **Dashboard** with overview, event browser, per-developer stats, per-project activity, and activity feed.
- 💰 **Per-change ROI**: estimate time at planning time (`--estimate small|medium|large|xlarge|240|4h`); cloud computes actual time (open→close) and shows time saved vs. estimate.
- 👥 **Admin panel** for user management, token issuance/revocation, and time-baseline configuration.
- 🔒 **Audit log** for signups, logins, token issuance/revocation, settings changes.
- 🐳 **Single-command deploy** with `docker compose up -d` (Postgres + cloud service, healthchecks, persistent volume).

## Quick start (development)

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env
# Edit .env: set JWT_SECRET and TOKEN_PEPPER to 32+ char strings

# 3. Start postgres
docker compose -f docker/docker-compose.yml up -d postgres

# 4. Run migrations (one-time, then on every schema change)
npm run db:migrate

# 5. Start the dev server
npm run dev
# → http://localhost:3000

# 6. Create the first admin
curl -X POST http://localhost:3000/api/v1/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","email":"admin@yourcompany.com","password":"correct-horse-battery-staple"}'
# → returns { user, token: { raw: "...", ... } }
# Save token.raw — it's how the CLI authenticates.
```

## Quick start (full Docker deployment)

```bash
# 1. Generate secrets
export POSTGRES_USER=your_postgres_user
export POSTGRES_PASSWORD=$(openssl rand -hex 32)
export POSTGRES_DB=baseline_cloud
export DATABASE_URL="postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}"
export JWT_SECRET=$(openssl rand -base64 48)
export TOKEN_PEPPER=$(openssl rand -base64 48)

# 2. (optional) First signup mode
export BOOTSTRAP_ADMIN=true

# 3. Deploy postgres + cloud in one shot
docker compose -f docker/docker-compose.yml up -d

# 4. Wait for cloud healthcheck to pass (~30s)
docker compose -f docker/docker-compose.yml ps

# 5. Sign up the first admin
curl -X POST http://localhost:3007/api/v1/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","email":"admin@yourcompany.com","password":"correct-horse-battery-staple"}'

# 6. After the first admin exists, disable bootstrap mode
export BOOTSTRAP_ADMIN=false
docker compose -f docker/docker-compose.yml restart cloud
```

## Database

- **Postgres 16+** (via the `postgres:16-alpine` Docker image)
- Schema managed with Drizzle migrations in `lib/db/migrations/`
- Generate a new migration after schema changes: `npm run db:generate`
- Apply pending migrations: `npm run db:migrate` (also runs on server start in production)
- Connection: `DATABASE_URL=postgres://user:pass@host:5432/dbname`; in Compose, use the internal service name `postgres`.

The persistent volume `baseline-cloud-postgres-data` survives container restarts. To back up:

```bash
docker exec baseline-cloud-postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > backup.sql
```

## Coolify deployment

Set the Compose file path to `docker/docker-compose.yml`, then add these variables in **Environment Variables**:

| Variable | Value |
| --- | --- |
| `POSTGRES_USER` | A new database username |
| `POSTGRES_PASSWORD` | A new database password |
| `POSTGRES_DB` | The database name, e.g. `baseline_cloud` |
| `DATABASE_URL` | `postgres://<POSTGRES_USER>:<POSTGRES_PASSWORD>@postgres:5432/<POSTGRES_DB>` |
| `JWT_SECRET` | Random value from `openssl rand -base64 48` |
| `TOKEN_PEPPER` | Different random value from `openssl rand -base64 48` |
| `BOOTSTRAP_ADMIN` | `true` for the first signup, then `false` |
| `ALLOWED_ORIGINS` | Comma-separated browser origins, or empty |
| `COOKIE_SECURE` | `false` when serving over plain HTTP; omit or set `true` when behind HTTPS |

## CLI integration

Configure the [`baseline`](https://github.com/amsintegra/ams-base-ai) CLI to point at your instance:

```bash
# One-time per dev machine:
baseline login
# Prompts for server URL + token (the raw token from signup or admin panel).
# Stores in ~/.baseline/cloud.json.

# Or via env var (for CI):
export BASELINE_CLOUD_URL=https://baseline-cloud.yourcompany.com
export BASELINE_CLOUD_TOKEN=raw-token-here
```

**Opt-out**: `BASELINE_TELEMETRY=0` env var or `--no-telemetry` flag.

## Event types

| Event | When | Data |
| --- | --- | --- |
| `cli.install` | First time `baseline install` runs | os, node version, tools detected |
| `cli.update` | After `baseline update` | from→to version, success/fail |
| `cli.doctor` | After `baseline doctor` | checks passed/failed counts |
| `cli.status` | After `baseline status` | per-tool status snapshot |
| `cli.mcp` | After `baseline mcp <provider>` | provider, count configured |
| `cli.onboard` | After `baseline onboard` | level, duration_ms |
| `cli.login` / `cli.logout` | Login / logout | server URL, auth method |
| `openspec.open` | When a new OpenSpec change opens | change name, type |
| `openspec.update` | When a change artifact updates | change name, artifact, op |
| `change.open` | When a change is opened | changeName, workType, title, estimateMin?, estimateBucket? |
| `change.close` | When a change is archived | changeName, workType, totalCommits, durationMs, verdict, estimateMin? |
| `change.commit` | From the post-commit git hook | sha, message, filesChanged, linesAdded/Removed, changeName? |
| `skill.installed` | From `baseline install` | skillName, tool |
| `skill.used` | (Future) | skillName, tool, context |
| `engram.setup` | When Engram is configured | engram version, mode |
| `engram.update` | When Engram updates | from→to version |

## Per-change ROI

The dev sets the time estimate at planning time:

```bash
baseline openspec new add-railway-deploy --type feature --estimate large
# Bucket: large = 480 minutes
# Or: --estimate 240, --estimate 4h, --estimate 4h30m
# Or no estimate: ROI uses the admin default for that work type
```

When the change is closed, the dashboard shows:
- **Actual time**: open→close duration
- **Baseline**: from the estimate or from the admin default
- **Time saved**: `max(0, baseline - actual)`
- **ROI%**: `saved / baseline`

The admin configures per-type baselines in **Dashboard → Admin → Settings** (defaults: feature=480min, migration=360min, new-project=240min, chore=60min, fix=180min, refactor=300min, docs=120min).

## API

### Public (no auth)

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| `POST` | `/api/v1/auth/signup` | `{username, email, password}` | `{user, token}` |
| `POST` | `/api/v1/auth/login` | `{username, password}` | `{user, tokens[]}` |
| `GET` | `/api/health` | — | `{status, service, env}` |

### Bearer-token (CLI)

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| `POST` | `/api/v1/auth/token` | `{name, password}` | `{id, raw, prefix, name}` |
| `POST` | `/api/v1/auth/logout` | — | `{ok}` |
| `POST` | `/api/v1/events` | `{event_type, project, payload, occurred_at?}` | `{ok, id}` |
| `POST` | `/api/v1/events/batch` | `{events: [...]}` | `{ok, ids}` |

### Dashboard (session cookie)

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/login` | Login page |
| `DELETE` | `/api/auth/logout` | Clears session cookie |
| `GET` | `/dashboard/overview` | KPI cards + charts |
| `GET` | `/dashboard/changes` | ROI table |
| `GET` | `/dashboard/developers` | Developer stats |
| `GET` | `/dashboard/activity` | Activity feed |
| `GET` | `/dashboard/skills` | Skill adoption |
| `GET` | `/dashboard/events` | Raw event browser |
| `GET` | `/dashboard/admin/tokens` | Token management (admin) |
| `GET` | `/dashboard/admin/users` | User management (admin) |
| `GET` | `/dashboard/admin/settings` | Time baselines (admin) |

## Architecture

```
┌─────────────────┐  bearer   ┌──────────────────────┐
│  baseline CLI   ├──────────►│   baseline-cloud     │
│  (each dev's    │  events   │   Next.js 16 App     │
│   machine)      │           │   Router + Postgres   │
└─────────────────┘           │   shadcn/ui + React  │
                              └──────────────────────┘
                                         ▲
                                browser  │
                                session  │
                                cookie   │
                                         │
                              ┌──────────┴──────────┐
                              │   Devs & admins     │
                              │   (the user's       │
                              │    browser)         │
                              └─────────────────────┘
```

## Development

```bash
npm run dev          # Next.js dev server (http://localhost:3000)
npm run build        # Production build
npm run lint         # ESLint
npm run db:generate  # Generate a new migration after schema changes
npm run db:migrate   # Apply pending migrations
npm run db:seed      # Seed demo data (dev only)
```

## Project status

**0.2.0** — Migrated from Fastify + Eta to Next.js 16 App Router + React 19 + shadcn/ui. Postgres-only.
