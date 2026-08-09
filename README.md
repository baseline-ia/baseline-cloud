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
- 🗂️ **Project enrollment**: admins control which projects are allowed to send telemetry. Non-enrolled projects receive `403 project_not_enrolled`.
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

## Deployment

baseline-cloud ships two deployment paths. Pick whichever fits your infrastructure.

| | Docker Compose | Dockerfile |
|---|---|---|
| **Best for** | VPS, bare metal, self-hosted | PaaS: Coolify, Railway, Render, AWS App Runner |
| **Database** | Bundled (Postgres container) | External managed database |
| **Effort** | One command | Configure build + env vars in UI |

---

### Option A — Docker Compose (VPS / self-hosted)

Everything runs in a single `docker compose up`: the app and a Postgres container with a persistent volume.

**Prerequisites**: Docker 24+ and Docker Compose V2 on your server.

#### 1. Clone and configure

```bash
git clone https://github.com/your-org/baseline-cloud.git
cd baseline-cloud
cp .env.example .env
```

Edit `.env` with your values:

```bash
POSTGRES_USER=baseline
POSTGRES_PASSWORD=$(openssl rand -hex 32)   # run this and paste the output
POSTGRES_DB=baseline_cloud
DATABASE_URL=postgres://baseline:<POSTGRES_PASSWORD>@postgres:5432/baseline_cloud

JWT_SECRET=<output of: openssl rand -base64 48>
TOKEN_PEPPER=<output of: openssl rand -base64 48>  # must differ from JWT_SECRET

BOOTSTRAP_ADMIN=true
ALLOWED_ORIGINS=https://your-domain.com
COOKIE_SECURE=true
```

#### 2. Start

```bash
docker compose -f docker/docker-compose.yml up -d
```

Postgres starts first and the app waits for it to be healthy. Check status:

```bash
docker compose -f docker/docker-compose.yml ps
```

#### 3. Run migrations

```bash
docker compose -f docker/docker-compose.yml exec cloud \
  npx tsx lib/db/migrate.ts
```

#### 4. Create the first admin

```bash
curl -X POST http://localhost:3007/api/v1/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","email":"admin@yourcompany.com","password":"your-strong-password"}'
# Save the returned token.raw — the CLI uses it to authenticate.
```

#### 5. Disable bootstrap mode

Edit `.env` → set `BOOTSTRAP_ADMIN=false`, then:

```bash
docker compose -f docker/docker-compose.yml restart cloud
```

#### Backups

```bash
docker exec baseline-cloud-postgres \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > backup.sql
```

---

### Option B — Dockerfile (PaaS platforms)

The app is built from `docker/Dockerfile` (multi-stage, Node 20 Alpine). You provide an external PostgreSQL database and set environment variables in your platform's UI.

**Supported platforms**: Coolify, Railway, Render, AWS App Runner, CapRover, Dokku, and any platform that can build and run a Dockerfile.

#### Environment variables

Set these in your platform's environment configuration:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | `postgres://user:pass@host:5432/dbname` |
| `JWT_SECRET` | `openssl rand -base64 48` |
| `TOKEN_PEPPER` | `openssl rand -base64 48` (different from JWT_SECRET) |
| `BOOTSTRAP_ADMIN` | `true` for first deploy, then `false` |
| `ALLOWED_ORIGINS` | Comma-separated browser origins, or leave empty |
| `COOKIE_SECURE` | `true` behind HTTPS (default); `false` for plain HTTP |
| `RATE_LIMIT_ENABLED` | `true` (default) |

#### Platform-specific settings

<details>
<summary><strong>Coolify</strong></summary>

1. Create a **PostgreSQL** database resource. Copy its internal connection string as `DATABASE_URL`.
2. Create a new **Application** from the GitHub repo:

| Field | Value |
| --- | --- |
| Build Pack | `Dockerfile` |
| Base Directory | `/` |
| Dockerfile Location | `/docker/Dockerfile` |
| Port | `3007` |

3. Add the environment variables above and deploy.

</details>

<details>
<summary><strong>Railway</strong></summary>

1. New project → **Deploy from GitHub repo**.
2. Railway auto-detects the Dockerfile.
3. Add a **PostgreSQL** plugin — Railway injects `DATABASE_URL` automatically.
4. Add the remaining environment variables in the **Variables** tab.
5. Set the port to `3007` under **Settings → Networking**.

</details>

<details>
<summary><strong>Render</strong></summary>

1. New **Web Service** → connect the GitHub repo.
2. Render auto-detects the Dockerfile. Set **Port** to `3007`.
3. Create a **PostgreSQL** database and copy the external connection string as `DATABASE_URL`.
4. Add the remaining environment variables under **Environment**.

</details>

<details>
<summary><strong>AWS App Runner</strong></summary>

1. Push the image to ECR:
   ```bash
   docker build -f docker/Dockerfile -t baseline-cloud .
   docker tag baseline-cloud:latest <account>.dkr.ecr.<region>.amazonaws.com/baseline-cloud:latest
   docker push <account>.dkr.ecr.<region>.amazonaws.com/baseline-cloud:latest
   ```
2. Create an **App Runner** service from the ECR image. Set port `3007`.
3. Create an **RDS PostgreSQL** instance. Use the connection string as `DATABASE_URL`.
4. Add the environment variables under **Configuration → Environment variables**.

</details>

#### After deploying (all platforms)

**Run migrations** against the production database:

```bash
DATABASE_URL="your-production-database-url" npm run db:migrate
```

> Re-run after every deploy that includes schema changes (`lib/db/migrations/` was modified).

**Create the first admin:**

```bash
curl -X POST https://your-domain/api/v1/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","email":"admin@yourcompany.com","password":"your-strong-password"}'
# Save token.raw — the CLI uses it to authenticate.
```

Then set `BOOTSTRAP_ADMIN=false` and redeploy.

---

### After any deployment — enroll your projects

Before the CLI can send events, an admin must enroll each project:

**Dashboard → Admin → Projects → Add project**

Non-enrolled projects receive `403 project_not_enrolled`. The CLI should handle this silently (treat it as a no-op).

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
| `GET` | `/dashboard/admin/projects` | Project enrollment (admin) |

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

**0.3.0** — Project enrollment allowlist, improved Dockerfile (3-stage build), Coolify Dockerfile deployment.

**0.2.0** — Migrated from Fastify + Eta to Next.js 16 App Router + React 19 + shadcn/ui. Postgres-only.
