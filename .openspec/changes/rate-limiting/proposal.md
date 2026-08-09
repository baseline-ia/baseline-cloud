---
id: rate-limiting
title: Add in-memory rate limiting to auth and event endpoints
status: draft
created: 2026-08-08
---

## Intent

Add per-endpoint rate limiting to the five write-heavy public API endpoints in baseline-cloud (`login`, `signup`, `token`, `events`, `events/batch`) using an in-memory sliding-window limiter, and fix a latent `x-forwarded-for` IP-extraction bug in the same pass. Success means brute-force and telemetry-flood attempts return `429` with a `Retry-After` header before reaching bcrypt or the database, without introducing any new runtime dependency or infrastructure component.

## Problem

- `POST /api/v1/auth/login` and `POST /api/v1/auth/token` both run bcrypt at 12 rounds (~300ms each). An attacker can currently issue unlimited parallel attempts and either (a) crack credentials or (b) saturate CPU. There is no throttle at any layer.
- `POST /api/v1/auth/signup` has no cap on account creation — spam and enumeration are unbounded (only gated by `BOOTSTRAP_ADMIN` for the very first user).
- `POST /api/v1/events` and `POST /api/v1/events/batch` accept authenticated writes with no per-user volume cap; a single leaked bearer token can generate arbitrary DB load, and `batch` compounds that at up to 100 events per transaction.
- `x-forwarded-for` is currently read as a whole string (`req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip')`). Behind Coolify's nginx this value is a comma-separated list (`client, proxy1, proxy2`); the current code treats the whole list as a single "IP", which both misidentifies the client and is trivially spoofable by an untrusted client prepending values.
- There is no `middleware.ts` and no rate-limiting library in the tree; nothing intercepts requests today.

## Scope

**In scope:**
- New module `lib/rate-limit.ts` — sliding-window limiter backed by a module-level `Map<string, { count: number; resetAt: number }>` with TTL-based pruning.
- Inline `checkRateLimit(...)` call at the top of five route handlers:
  - `app/api/v1/auth/login/route.ts` — key by IP, 10 per 15 min
  - `app/api/v1/auth/signup/route.ts` — key by IP, 5 per 60 min
  - `app/api/v1/auth/token/route.ts` — key by IP, 10 per 15 min
  - `app/api/v1/events/route.ts` — key by authenticated userId, 300 per 1 min
  - `app/api/v1/events/batch/route.ts` — key by authenticated userId, 30 per 1 min
- `lib/config.ts` — add `RATE_LIMIT_ENABLED` boolean (default `true`) as a kill switch for dev/test.
- Fix IP extraction: split `x-forwarded-for` on `,` and take/trim the first entry; prefer `x-real-ip` as the primary source (nginx sets it directly and it is not client-controlled).
- 429 response contract: JSON body `{ error_class: "rate_limit", error_code: "too_many_requests" }` plus a `Retry-After: <seconds>` header.
- Document the single-instance assumption in the module header.

**Out of scope:**
- Distributed rate limiting (no Redis in the stack; not adding one).
- A `middleware.ts` edge-runtime layer (edge isolation makes an in-memory Map useless for aggregation).
- Third-party dependencies (`lru-cache`, `@upstash/ratelimit`, etc.).
- Rate limiting on read endpoints (`GET /api/v1/*`) — not part of the identified abuse surface today.
- Env-driven overrides of individual limit numbers (limits are hardcoded initially; only the master switch is env-controlled).
- Per-tenant / per-org quotas or billing-tier limits.
- Login lockout, CAPTCHA, or account-level blocking — this proposal is throttling only.
- Changes to `lib/auth/`, DB schema, or the audit-log format.

## Approach

Implement Option A from the exploration: a shared `lib/rate-limit.ts` module exposing a pure `checkRateLimit(key, limit, windowMs)` function that returns `{ limited: boolean; retryAfter: number }`. The module owns a single `Map` keyed by `"<endpoint>:<ip|userId>"` and prunes expired entries on access (opportunistic TTL cleanup on each check, plus a low-frequency sweep to bound worst-case memory).

Each route handler calls `checkRateLimit` as its first substantive step — for auth endpoints, before bcrypt or any DB access; for event endpoints, immediately after the bearer token resolves the `userId` (so the key can be user-scoped rather than IP-scoped, avoiding NAT collateral damage). When limited, the handler returns `429` with the documented body shape and `Retry-After` header and does no further work.

The IP-extraction fix lives in a small helper in the same module (or `lib/http/ip.ts` — decided in design phase) and is used both by the auth handlers' rate-limit keys and by any existing audit-log call sites that read the client IP, so all readers see the corrected value at once.

### Key decisions (from exploration, carried forward)

| Decision | Choice | Rationale |
|---|---|---|
| Storage | Node `Map` + `Date.now()` TTL | Zero deps, single-process is the deployment reality today |
| Runtime | Node (route handler) | Edge/middleware can't share state without Redis |
| Auth key | Client IP (via fixed extractor) | Pre-auth endpoints have no user identity yet |
| Event key | Authenticated `userId` | Bearer already resolved; avoids penalizing shared NATs |
| Kill switch | `RATE_LIMIT_ENABLED` env (default on) | Needed for tests and local dev without env plumbing per test |
| 429 body | `{ error_class, error_code }` | Matches existing error envelope conventions in the API |
| `Retry-After` | Seconds until window reset | Standard HTTP semantics; ceil of remaining ms |
| IP source | `x-real-ip` first, then first hop of `x-forwarded-for`, then `"unknown"` | Coolify's nginx sets `x-real-ip` directly; not client-forgeable |

### Risks and open questions

- **Memory growth**: unbounded unique keys could grow the Map indefinitely. Mitigation: TTL pruning on access + a periodic sweep. If this proves insufficient in practice, `lru-cache` (Option C) is a drop-in upgrade behind the same `checkRateLimit` signature.
- **Multi-instance drift**: if Coolify ever scales the cloud service beyond one replica, per-instance limits multiply by replica count. Documented as a single-instance assumption; revisit only when horizontal scaling is on the roadmap.
- **`x-real-ip` availability**: assumed set by Coolify's nginx. Needs a one-shot validation in staging (curl + header inspection) before rollout. If absent, fall back to `x-forwarded-for` first-hop, which is what the exploration already handles.
- **Process restart wipes counters**: acceptable — attackers gain at most one window's worth of attempts across a restart, and audit logs still capture the failed attempts for forensics.
- **No pre-bcrypt protection at the network edge**: the handler runs Node code before `checkRateLimit` executes (route parsing, body parse). This is fine — the expensive step (bcrypt, DB) is what we're protecting, and it comes after the check.
