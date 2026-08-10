# Rate Limiting Specification

## Purpose

Define the behavior of in-memory sliding-window rate limiting applied to five write-heavy
API endpoints, and specify correct client-IP extraction from proxy headers.

## Requirements

### Requirement: Rate Limit Enforcement

The system MUST reject requests that exceed the configured per-endpoint threshold within
the sliding window. A rejected request MUST return HTTP 429 with body
`{ "error_class": "rate_limit", "error_code": "too_many_requests" }` and a
`Retry-After` header whose value is the integer number of seconds until the window resets
(ceiling of remaining milliseconds divided by 1000). No downstream handler code (bcrypt,
DB query) MUST execute after a 429 is returned.

Limits per endpoint:

| Endpoint | Key type | Limit | Window |
|---|---|---|---|
| POST /api/v1/auth/login | IP | 10 | 15 min |
| POST /api/v1/auth/signup | IP | 5 | 60 min |
| POST /api/v1/auth/token | IP | 10 | 15 min |
| POST /api/v1/events | userId | 300 | 1 min |
| POST /api/v1/events/batch | userId | 30 | 1 min |

#### Scenario: Request within limit is allowed

- GIVEN the rate limiter is enabled and a client has sent fewer requests than the limit within the window
- WHEN the client sends another request to that endpoint
- THEN the handler proceeds normally and returns a non-429 response

#### Scenario: Request at the limit threshold is rejected

- GIVEN a client has sent exactly N requests within the window (N = endpoint limit)
- WHEN the client sends request N+1 to the same endpoint
- THEN the system returns HTTP 429
- AND the body is `{ "error_class": "rate_limit", "error_code": "too_many_requests" }`
- AND a `Retry-After` header is present with a positive integer value in seconds

#### Scenario: Retry-After value is accurate

- GIVEN a client is rate-limited and the window resets in T milliseconds
- WHEN the 429 response is generated
- THEN `Retry-After` equals `ceil(T / 1000)`

#### Scenario: Counter resets after window expires

- GIVEN a client was rate-limited within the window
- WHEN the window duration has fully elapsed
- THEN the next request from that client is allowed through

#### Scenario: Auth endpoints use IP as the rate-limit key

- GIVEN two different authenticated users share the same source IP
- WHEN both send requests to POST /api/v1/auth/login
- THEN their requests count against a shared per-IP counter for that endpoint

#### Scenario: Event endpoints use userId as the rate-limit key

- GIVEN two users share the same source IP but have different bearer tokens
- WHEN both send requests to POST /api/v1/events
- THEN each user's requests count against their own per-userId counter independently

---

### Requirement: Kill Switch via RATE_LIMIT_ENABLED

The system MUST read a `RATE_LIMIT_ENABLED` environment variable at module load time.
When the variable is set to `"false"` (or is absent in a non-production context where
the implementation defaults to disabled), the rate limiter MUST allow every request
through without incrementing any counter. The default MUST be enabled (`true`) in
production and disabled (`false`) in test environments.

#### Scenario: Kill switch disabled bypasses all limits

- GIVEN `RATE_LIMIT_ENABLED` is set to `"false"`
- WHEN a client sends N+1 requests to any rate-limited endpoint
- THEN every request is allowed through with no 429 response
- AND no `Retry-After` header is present

#### Scenario: Kill switch enabled enforces limits

- GIVEN `RATE_LIMIT_ENABLED` is set to `"true"` (or defaults to enabled)
- WHEN a client exceeds the threshold for an endpoint
- THEN the system returns HTTP 429 as specified

---

### Requirement: Client IP Extraction

The system MUST extract the client IP address for rate-limit keying using the following
priority order:

1. `x-real-ip` header (set by Coolify's nginx; not client-controllable)
2. First value of `x-forwarded-for` header after splitting on `,` and trimming whitespace
3. `"unknown"` if neither header is present

The system MUST NOT use the raw `x-forwarded-for` string as a single key; it MUST split
on `,` and take the first element only.

#### Scenario: x-real-ip takes precedence over x-forwarded-for

- GIVEN a request arrives with both `x-real-ip: 1.2.3.4` and `x-forwarded-for: 5.6.7.8, 9.10.11.12`
- WHEN the IP extractor runs
- THEN the extracted IP is `"1.2.3.4"`

#### Scenario: First hop of x-forwarded-for is used when x-real-ip is absent

- GIVEN a request arrives with `x-forwarded-for: 5.6.7.8, 9.10.11.12` and no `x-real-ip`
- WHEN the IP extractor runs
- THEN the extracted IP is `"5.6.7.8"`

#### Scenario: Fallback to "unknown" when no proxy headers present

- GIVEN a request arrives with neither `x-real-ip` nor `x-forwarded-for`
- WHEN the IP extractor runs
- THEN the extracted IP is `"unknown"`

#### Scenario: All five route handlers use the corrected extractor

- GIVEN any of the five rate-limited endpoints receives a request behind a proxy
- WHEN the IP is needed for rate-limit keying or logging
- THEN the corrected extractor (split-and-trim) is used in all five handlers

---

### Requirement: Memory Safety via TTL Pruning

The in-memory store MUST prune expired entries to prevent unbounded Map growth.
The system MUST NOT grow the store indefinitely; expired entries MUST be removed
opportunistically on each access or via a low-frequency background sweep.
The single-instance assumption MUST be documented in the module header.

#### Scenario: Expired entries are removed on access

- GIVEN the store contains an entry whose window has expired
- WHEN a new request arrives for the same key
- THEN the old entry is discarded and a fresh counter is started

#### Scenario: Background sweep removes unreferenced expired entries

- GIVEN the store contains entries for keys that have not received traffic since their window expired
- WHEN the periodic pruning sweep runs
- THEN those stale entries are removed from the store

---

### Requirement: Skills List Endpoint Authentication

The system MUST protect `GET /api/v1/skills` using the same Bearer token validation and enrollment guard as the existing events endpoint. Requests without a valid token MUST return 401. Requests with a valid token but an unenrolled project MUST return 403. These guards MUST execute before any data access.

#### Scenario: Valid token, enrolled project — allowed

- GIVEN a valid Bearer token and an enrolled project slug in the query string
- WHEN `GET /api/v1/skills?project=<slug>` is called
- THEN the guard passes and skill data is returned

#### Scenario: Missing token — 401

- GIVEN no Authorization header
- WHEN `GET /api/v1/skills?project=<slug>` is called
- THEN the response is HTTP 401

#### Scenario: Valid token, unenrolled project — 403

- GIVEN a valid Bearer token and a project slug not in the enrollment table
- WHEN `GET /api/v1/skills?project=<slug>` is called
- THEN the response is HTTP 403

---

### Requirement: Skills Verify Endpoint Authentication

The system MUST protect `GET /api/v1/skills/:slug/verify` using the same Bearer token validation and enrollment guard as the skills list endpoint. Auth rules are identical.

#### Scenario: Valid token, enrolled project — allowed

- GIVEN a valid Bearer token and an enrolled project slug in the query string
- WHEN `GET /api/v1/skills/:slug/verify?project=<slug>` is called
- THEN the guard passes and verify data is returned

#### Scenario: Missing token — 401

- GIVEN no Authorization header
- WHEN `GET /api/v1/skills/:slug/verify?project=<slug>` is called
- THEN the response is HTTP 401
