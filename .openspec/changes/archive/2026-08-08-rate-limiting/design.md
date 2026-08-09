---
id: rate-limiting
title: Technical design — in-memory rate limiting and IP extraction
status: draft
created: 2026-08-08
related:
  - .openspec/changes/rate-limiting/proposal.md
  - .openspec/changes/rate-limiting/spec.md
---

## 1. Overview

Introduce a single Node-runtime, in-process rate-limiting module (`lib/rate-limit.ts`)
consumed inline by five write-heavy Next.js route handlers. The module is a pure
function over a module-scoped `Map`; there is no middleware, no library, no external
store. A small IP-extraction helper (`lib/ip.ts`) is added so both the limiter and
existing audit-log call sites see a corrected client IP.

Runtime target: Node.js (all five affected routes already run on Node — none opt
into the Edge runtime). Deployment topology is a single Coolify replica; this is a
documented assumption in the module header and a known limit for future horizontal
scaling.

## 2. Module layout

```
lib/
  rate-limit.ts   # new — sliding-window limiter + response helper
  ip.ts           # new — proxy-header-aware client IP extractor
  config.ts       # edited — add RATE_LIMIT_ENABLED with test-aware default
```

Route handlers touched (call sites only, no restructuring):

```
app/api/v1/auth/login/route.ts
app/api/v1/auth/signup/route.ts
app/api/v1/auth/token/route.ts
app/api/v1/events/route.ts
app/api/v1/events/batch/route.ts
```

Rationale for two files (not one):
- `extractIp` is reused by audit-log call sites that do not care about rate
  limiting; keeping it in `lib/ip.ts` avoids pulling the whole limiter module
  into every handler that only wants an IP string.
- `lib/rate-limit.ts` imports `extractIp` when convenient but does not require
  callers to hand it in — the limiter is keyed by an opaque `string`, so it stays
  agnostic (auth routes pass an IP, event routes pass a userId).

## 3. `lib/rate-limit.ts` — data structures and function signatures

### 3.1 Types

```ts
export interface RateLimitOptions {
  /** Max allowed requests within windowMs. */
  limit: number;
  /** Sliding-window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  /** true when the caller MAY proceed; false when the caller MUST return 429. */
  allowed: boolean;
  /** Milliseconds until the current window resets. 0 when allowed. */
  retryAfterMs: number;
}

interface Bucket {
  count: number;
  /** Absolute epoch ms at which this bucket expires and resets. */
  resetAt: number;
}
```

### 3.2 Module state

```ts
// Single-process in-memory store. This module assumes exactly one Node
// instance; if the deployment ever scales horizontally, limits multiply
// by replica count and this module must be replaced with a shared store
// (Redis, Upstash, etc.).
const store = new Map<string, Bucket>();

// Opportunistic full sweep guard — bounds worst-case pathological growth
// when the same key never re-appears. Cheap: an integer compare per check.
let lastSweepAt = 0;
const SWEEP_INTERVAL_MS = 60_000;
```

### 3.3 Public API

```ts
export function checkRateLimit(
  key: string,
  opts: RateLimitOptions,
): RateLimitResult;

/** Convenience: builds the exact NextResponse the spec requires. */
export function rateLimitResponse(retryAfterMs: number): NextResponse;

/** Test-only: wipe the store between test cases. NOT exported from index. */
export function __resetRateLimitStoreForTests(): void;
```

### 3.4 Algorithm (fixed window with lazy TTL reset)

Despite the proposal calling this a "sliding window," the storage shape is a
**fixed-window counter with lazy reset** — the simplest correct implementation
for these limits and identical in observable behavior for our thresholds. Each
key holds one bucket; when the bucket expires, the next request starts a fresh
window. This is what the spec's "counter resets after window expires" scenario
describes.

```
checkRateLimit(key, { limit, windowMs }):
  if !RATE_LIMIT_ENABLED:
    return { allowed: true, retryAfterMs: 0 }

  now = Date.now()

  # Opportunistic full sweep at most once per SWEEP_INTERVAL_MS.
  if now - lastSweepAt >= SWEEP_INTERVAL_MS:
    for (k, b) of store:
      if b.resetAt <= now: store.delete(k)
    lastSweepAt = now

  bucket = store.get(key)

  # Lazy per-key reset — the primary GC path.
  if !bucket or bucket.resetAt <= now:
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, retryAfterMs: 0 }

  if bucket.count >= limit:
    return { allowed: false, retryAfterMs: bucket.resetAt - now }

  bucket.count += 1
  return { allowed: true, retryAfterMs: 0 }
```

Notes:
- The check itself increments the counter on allowed requests. Handlers therefore
  MUST call `checkRateLimit` exactly once per request, at the top of the handler
  path they intend to protect.
- The `count >= limit` comparison uses `>=` so that the Nth allowed request
  consumes the last slot and the (N+1)th is rejected, matching the spec's
  "Request at the limit threshold is rejected" scenario (which really means
  "the N+1th request is rejected").
- `RATE_LIMIT_ENABLED` is read at module load time from `config`, mirroring how
  the rest of the codebase treats `config` values (`isTest`, `isProd`, etc.).

### 3.5 Key convention

Callers namespace their keys with an endpoint prefix so the same identifier
(e.g. `"1.2.3.4"`) does not collide across endpoints:

```ts
checkRateLimit(`auth:login:${ip}`,      { limit: 10, windowMs: 15 * 60_000 });
checkRateLimit(`auth:signup:${ip}`,     { limit: 5,  windowMs: 60 * 60_000 });
checkRateLimit(`auth:token:${ip}`,      { limit: 10, windowMs: 15 * 60_000 });
checkRateLimit(`events:single:${uid}`,  { limit: 300, windowMs: 60_000 });
checkRateLimit(`events:batch:${uid}`,   { limit: 30,  windowMs: 60_000 });
```

Prefixes are call-site concerns, not module ones — the module treats the whole
string as opaque. This keeps the module free of endpoint enumeration and lets
tests use short synthetic keys.

### 3.6 429 response helper

```ts
export function rateLimitResponse(retryAfterMs: number): NextResponse {
  const retryAfterSec = Math.ceil(retryAfterMs / 1000);
  return NextResponse.json(
    { error_class: 'rate_limit', error_code: 'too_many_requests' },
    { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
  );
}
```

Justification for extracting a helper (vs. inlining in each handler):
- The body shape and header name are contract surface. Five copies drift; one
  copy does not.
- Keeps the handler diffs to two lines each (`extractIp` + `checkRateLimit` +
  early `return rateLimitResponse(...)`).

## 4. `lib/ip.ts` — client IP extraction

```ts
/**
 * Extract the client IP for rate-limit keying and audit logs.
 *
 * Priority:
 *   1. `x-real-ip`                        — set by Coolify's nginx directly;
 *                                            not client-forgeable at that hop.
 *   2. first entry of `x-forwarded-for`   — split on `,`, trim.
 *   3. "unknown"                          — no proxy headers present.
 *
 * NEVER uses the raw `x-forwarded-for` string as a key: behind a chain of
 * proxies that string is `client, proxy1, proxy2` and treating it whole both
 * misidentifies the client and lets an untrusted client trivially spoof by
 * prepending values.
 */
export function extractIp(req: Request): string {
  const realIp = req.headers.get('x-real-ip');
  if (realIp && realIp.trim().length > 0) return realIp.trim();

  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }

  return 'unknown';
}
```

The parameter type is the DOM/Fetch `Request` (a superset of `NextRequest`),
so audit-log helpers that receive a plain `Request` can call it too.

## 5. Config change (`lib/config.ts`)

Add one field to the schema. The test-environment default is expressed as a
**post-parse override** rather than a Zod refinement, because `NODE_ENV` is a
sibling field parsed in the same object and Zod's `.default()` cannot reference
other fields cleanly.

### 5.1 Schema addition

```ts
RATE_LIMIT_ENABLED: z
  .string()
  .optional()
  .transform((s) => (s == null ? undefined : s.toLowerCase() !== 'false')),
```

Semantics: `undefined` if the env var is unset, `boolean` if set. The final
default is resolved in `loadConfig` (below) so the resolution can consult
`NODE_ENV`.

### 5.2 Default resolution in `loadConfig`

```ts
function loadConfig(): AppConfig {
  const parsed = ConfigSchema.safeParse(process.env);
  if (!parsed.success) { /* ...unchanged error path... */ }

  const data = parsed.data;
  // Test defaults OFF; every other environment defaults ON.
  // An explicit RATE_LIMIT_ENABLED env value always wins.
  if (data.RATE_LIMIT_ENABLED === undefined) {
    data.RATE_LIMIT_ENABLED = data.NODE_ENV !== 'test';
  }
  return data;
}
```

### 5.3 Type shape after change

```ts
export type AppConfig = z.infer<typeof ConfigSchema> & {
  RATE_LIMIT_ENABLED: boolean; // narrowed from boolean | undefined
};
```

Alternatives considered and rejected:

| Option | Why rejected |
|---|---|
| Two-pass Zod (`.superRefine` reading `NODE_ENV`) | Zod refinements can't overwrite a value, only add issues — awkward for defaults. |
| `RATE_LIMIT_ENABLED` default `'true'` at schema level, with `isTest` overriding at limiter call site | Splits the truth across two files; someone reading `config` sees `true` in tests, someone reading the limiter sees false. Config is the single source. |
| Separate `RATE_LIMIT_ENABLED_TEST` env | Two envs for one boolean; not worth the cognitive tax. |

The chosen shape keeps `config.RATE_LIMIT_ENABLED` as the sole truth and honors
the spec's "default MUST be enabled in production and disabled in test."

## 6. Call patterns per handler

All five handlers follow the same shape. The check is placed:
- **Auth routes**: immediately after `req.json()` and Zod parse succeed, and
  **before** any DB read or `verifyPassword`/bcrypt call. This is the whole
  point — bcrypt at cost 12 is what we're protecting.
- **Event routes**: immediately after the bearer token resolves to a `userId`
  (so the key is user-scoped) but before any event insert.

### 6.1 Auth routes (login, signup, token) — canonical diff shape

Current (login):
```ts
const { username, password } = parsed.data;
const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? undefined;
const userRows = await db.select().from(users)... // DB + bcrypt below
```

New:
```ts
import { extractIp } from '@/lib/ip';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

const { username, password } = parsed.data;
const ip = extractIp(req);

const rl = checkRateLimit(`auth:login:${ip}`, { limit: 10, windowMs: 15 * 60_000 });
if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

const userRows = await db.select().from(users)... // unchanged
// ...existing audit-log calls now pass the corrected `ip`
```

Per-endpoint deltas beyond that template:

| Handler | Key template | Limit | Window |
|---|---|---|---|
| `auth/login`  | `auth:login:${ip}`  | 10 | 15 * 60_000 |
| `auth/signup` | `auth:signup:${ip}` | 5  | 60 * 60_000 |
| `auth/token`  | `auth:token:${ip}`  | 10 | 15 * 60_000 |

### 6.2 Event routes — key is authenticated userId

The existing handlers resolve the bearer token first; the rate-limit check goes
immediately after that resolution and before the insert transaction.

Sketch (events single):
```ts
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

const userId = await resolveBearer(req); // existing helper
if (!userId) return unauthorized();       // existing path

const rl = checkRateLimit(`events:single:${userId}`, { limit: 300, windowMs: 60_000 });
if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

// ...existing validate + insert
```

Sketch (events batch):
```ts
const rl = checkRateLimit(`events:batch:${userId}`, { limit: 30, windowMs: 60_000 });
if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);
```

Rationale for keying event routes by userId, not IP:
- Bearer is already resolved by the time we'd check anything meaningful; using
  it costs nothing extra.
- IP-keying would collateral-damage tenants sharing NATs or Coolify's edge.
- A leaked bearer token is the abuse vector we actually care about, and it is
  scoped exactly to a userId.

### 6.3 Audit-log corollary fix

Every handler that currently reads `req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip')`
for its `writeAudit` call switches to `extractIp(req)`. This is the "same IP everywhere"
guarantee the spec's "all five route handlers use the corrected extractor" scenario asks for.
No other audit-log fields change.

## 7. Ordering guarantees

1. **Zod validation first, then rate-limit.** Malformed JSON should still 400,
   not 429. This matches the spec (429 is about "exceeded the configured threshold,"
   not about malformed input) and avoids masking client bugs behind throttling.
2. **Rate-limit before bcrypt/DB.** Non-negotiable — this is the security goal.
3. **Rate-limit before audit-log for the request itself.** A throttled request
   does not write an audit row; it is a pre-auth reject. (Failed logins that pass
   the throttle still audit as they do today.)
4. **Event routes: bearer resolution first, then rate-limit.** Without a userId
   there is no key; a missing/invalid bearer returns 401 before we ever consult
   the limiter.

## 8. Test strategy hooks (design-only; test authoring is out of scope here)

- Export `__resetRateLimitStoreForTests` from `lib/rate-limit.ts` so unit tests
  can wipe the module-level `Map` between cases without reloading the module.
- Tests either set `RATE_LIMIT_ENABLED=true` explicitly (overriding the test
  default) or exercise the disabled path directly.
- `Date.now()` is used verbatim (no injectable clock) — tests use vitest's
  `vi.useFakeTimers()` / `vi.advanceTimersByTime()` to move the window.

## 9. ADR-style decisions

### ADR-1 — Fixed-window counter with lazy TTL reset (not true sliding window)

- **Decision**: Store one `{count, resetAt}` per key; reset on next request after
  `resetAt`. Do not track individual request timestamps.
- **Rationale**: For our thresholds (5–300 per window), the difference between
  fixed-window and true sliding-window is at most one burst of `limit` requests
  at a window boundary. The extra memory (list of timestamps per key) and CPU
  (per-request cull) do not buy meaningful security. Simpler code, smaller footprint.
- **Rejected alternative**: Token bucket — nicer burst semantics but requires
  fractional refill math and a `lastRefillAt` field; overkill for the stated goal
  of "return 429 before bcrypt runs."
- **Rejected alternative**: True sliding window with per-request timestamps —
  correct but O(limit) memory per key and O(limit) per check; not justified.

### ADR-2 — In-process `Map`, no external store

- **Decision**: Module-scoped `Map<string, Bucket>` in `lib/rate-limit.ts`.
- **Rationale**: Zero deps, zero infra, matches current single-replica Coolify
  deployment. Proposal explicitly rules out Redis.
- **Consequence**: Multi-instance scaling multiplies effective limits by replica
  count; documented in the module header. The `checkRateLimit` signature is
  the exact one a Redis-backed impl would use later, so migration is a same-file
  swap.

### ADR-3 — Lazy TTL pruning + opportunistic sweep (no `setInterval`)

- **Decision**: Delete expired bucket on next access to its key; additionally do
  a full `Map` sweep at most once per 60s, gated by a `lastSweepAt` check inside
  `checkRateLimit`.
- **Rationale**: `setInterval` in a Next.js route module keeps the event loop
  alive and interacts badly with hot reload and serverless-style shutdown. A
  per-call sweep guard is free when idle and bounds worst-case memory when a
  large set of one-shot keys (e.g., scanners spraying random tokens) is
  accumulated.
- **Rejected alternative**: `setInterval(() => sweep(), 60_000)` — simpler code
  but introduces a background timer that must be cleaned up in test teardown
  and complicates HMR.
- **Rejected alternative**: `lru-cache` with a fixed max size — a good future
  upgrade path, but adds a dep for a problem we do not yet observe.

### ADR-4 — `RATE_LIMIT_ENABLED` default resolved in `loadConfig`, not at the schema

- **Decision**: Schema returns `boolean | undefined`; `loadConfig` fills in
  `NODE_ENV === 'test' ? false : true` when unset.
- **Rationale**: Zod defaults cannot see sibling fields. Encoding the test-off
  behavior at the config layer keeps `config.RATE_LIMIT_ENABLED` as the single
  source of truth so the limiter never has to consult `isTest` at call time.
- **Rejected alternative**: Default `'true'` in Zod and short-circuit inside
  `checkRateLimit` with `if (isTest) return { allowed: true, ... }` — splits the
  truth and makes the value read from `config` misleading in tests.

### ADR-5 — Separate `lib/ip.ts` module

- **Decision**: `extractIp` lives in its own file, not inside `lib/rate-limit.ts`.
- **Rationale**: Audit-log call sites want the corrected IP without importing
  the limiter. Tree-shaking is not a factor at the server, but coupling is —
  a handler that never rate-limits should not import the limiter to log an IP.
- **Rejected alternative**: Colocate in `lib/rate-limit.ts` and re-export —
  cheaper today, but any future limiter change (e.g., pulling in `lru-cache`)
  would drag that dep into every handler that only wants an IP string.

### ADR-6 — Key namespacing at the call site, not inside the module

- **Decision**: Callers build keys like `auth:login:${ip}`; the module accepts
  an opaque `string`.
- **Rationale**: Keeps the module free of an endpoint enum, avoids a second
  file to update every time a new endpoint gets a limit, and makes tests trivial
  (`checkRateLimit('t1', ...)`).
- **Consequence**: A typo in a prefix silently creates a new counter. Mitigated
  by extracting the five key builders as `const KEY_LOGIN = (ip) => ...` in the
  handler files or a small shared constants module if drift becomes a real risk.

## 10. Risks and follow-ups (unresolved / assumption-flagged)

- **`x-real-ip` presence**: assumed set by Coolify's nginx. Needs one manual
  staging verification (`curl` through the edge, dump headers) before rollout.
  If absent, the fallback to first-hop `x-forwarded-for` still works; behavior
  degrades only in the priority order, not in correctness.
- **Multi-instance scaling**: this design is single-replica-correct only. Any
  future horizontal scaling requires replacing the `Map` with a shared store;
  the `checkRateLimit` signature is stable across that migration.
- **No pre-Node throttle**: request parse and JSON body read still happen before
  the limiter runs. Acceptable — the cost we protect is bcrypt and DB, and both
  come after. If this ever proves inadequate, the fix is a `middleware.ts` at
  the Node runtime (not Edge, which cannot share the Map).
- **Counter loss on restart**: acceptable per proposal; attackers get at most
  one extra window's budget across a deploy. Audit logs still capture attempts.
- **Key-prefix drift**: see ADR-6. If a sixth endpoint is added without a
  matching prefix constant, it is possible to accidentally share a counter with
  another endpoint. Convention + code review is the current mitigation; extract
  to a `KEYS` module if a real bug ever occurs.
