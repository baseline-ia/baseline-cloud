# Tasks: In-Memory Rate Limiting and IP Extraction

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 180–260 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | N/A |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | All lib files + config + route handlers + tests | Single PR | `npx vitest run` | Manual `curl` against local Next.js dev server behind proxy headers | Delete `lib/ip.ts`, `lib/rate-limit.ts`; revert `lib/config.ts` and the five route files |

---

## Phase 1: Foundation — Lib Modules and Config

- [x] 1.1 Create `lib/ip.ts`: export `extractIp(req: Request): string` implementing the three-priority header chain (`x-real-ip` → first-hop `x-forwarded-for` → `"unknown"`). Satisfy spec scenarios: x-real-ip precedence, first-hop split+trim, unknown fallback.
- [x] 1.2 Create `lib/rate-limit.ts`: export `RateLimitOptions`, `RateLimitResult`, `checkRateLimit(key, opts)` with module-scoped `Map<string, Bucket>`, lazy per-key TTL reset, opportunistic sweep guard (`SWEEP_INTERVAL_MS = 60_000`), and `rateLimitResponse(retryAfterMs)` helper. Export `__resetRateLimitStoreForTests` (not re-exported from an index barrel). Add single-replica assumption comment in module header.
- [x] 1.3 Modify `lib/config.ts`: add `RATE_LIMIT_ENABLED` to `ConfigSchema` as `.string().optional().transform(...)`, update `AppConfig` type to narrow it to `boolean`, and add post-parse override in `loadConfig` (`data.RATE_LIMIT_ENABLED = data.NODE_ENV !== 'test'` when unset). Satisfies spec requirement: kill switch defaults enabled in production, disabled in test.

> Tasks 1.1 and 1.2 are parallel. Task 1.3 depends only on knowing the existing config shape (already read). All three can be implemented in the same pass.

---

## Phase 2: Route Handler Wiring

Each route task follows the same two-line diff shape: `const ip = extractIp(req)` + `checkRateLimit(...)` guard before any bcrypt or DB call, and replaces any existing raw `x-forwarded-for` extraction for audit-log calls with `extractIp(req)`.

- [x] 2.1 Modify `app/api/v1/auth/login/route.ts`: import `extractIp` and `checkRateLimit`/`rateLimitResponse`; call `extractIp(req)` after Zod parse; call `checkRateLimit('auth:login:${ip}', { limit: 10, windowMs: 15 * 60_000 })`; early-return `rateLimitResponse(...)` on deny; pass corrected `ip` to existing audit-log call.
- [x] 2.2 Modify `app/api/v1/auth/signup/route.ts`: same pattern with key `auth:signup:${ip}`, limit 5, window 60 × 60_000.
- [x] 2.3 Modify `app/api/v1/auth/token/route.ts`: same pattern with key `auth:token:${ip}`, limit 10, window 15 × 60_000.
- [x] 2.4 Modify `app/api/v1/events/route.ts`: import `checkRateLimit`/`rateLimitResponse`; place check after bearer resolves to `userId` (existing path) and before insert; key `events:single:${userId}`, limit 300, window 60_000.
- [x] 2.5 Modify `app/api/v1/events/batch/route.ts`: same as 2.4 with key `events:batch:${userId}`, limit 30, window 60_000.

> Tasks 2.1–2.5 are all parallel once Phase 1 is complete.

---

## Phase 3: Infrastructure Documentation

- [x] 3.1 Modify `docker/docker-compose.yml`: add `RATE_LIMIT_ENABLED` env var entry to the `cloud` service's `environment` block with a comment noting `true` enables, `false` disables (defaults to `true` in production, `false` in test).

---

## Phase 4: Testing

All tests use `__resetRateLimitStoreForTests()` in `beforeEach`. Rate-limit enforcement tests must set `RATE_LIMIT_ENABLED=true` explicitly (overrides the test-env default of `false`).

- [x] 4.1 RED→GREEN: Write unit tests for `lib/ip.ts` covering: (a) `x-real-ip` takes precedence over `x-forwarded-for`, (b) first-hop of `x-forwarded-for` is used when `x-real-ip` is absent, (c) fallback returns `"unknown"` when neither header is present. All pass.
- [x] 4.2 RED→GREEN: Write unit tests for `checkRateLimit` in `lib/rate-limit.ts` covering: (a) request within limit is allowed, (b) request N+1 is rejected with `allowed: false`, (c) `retryAfterMs` is positive and accurate, (d) counter resets after window expires, (e) kill switch `RATE_LIMIT_ENABLED=false` bypasses all limits, (f) distinct keys do not share counters, (g) expired entries are discarded on next access. All pass.
- [x] 4.3 RED→GREEN: Write unit tests for `rateLimitResponse` covering: (a) HTTP 429 status, (b) body is `{ error_class: 'rate_limit', error_code: 'too_many_requests' }`, (c) `Retry-After` header equals `Math.ceil(retryAfterMs / 1000)`. All pass.
- [ ] 4.4 RED: Integration tests for five route handlers — deferred (requires Next.js test harness; no runner was installed; lib-level unit tests provide full algorithmic coverage).
- [x] 4.5 GREEN: All lib unit tests (18/18) pass.
- [x] 4.6 REFACTOR: Removed all dead `req.headers.get('x-forwarded-for')` call sites in login, signup, token, events, and batch routes; replaced with `extractIp(req)`. `__resetRateLimitStoreForTests` is not exported from any barrel.
