---
name: sdd-security
description: "Trigger: security audit, owasp, vulnerabilidades, seguridad, security scan, sdd-security. Audit code changes against OWASP Top 10 2021. Fits between sdd-apply and sdd-verify as a security gate."
license: Apache-2.0
metadata:
  author: amsintegra
  version: "1.0"
---

## Activation Contract

Run when the user explicitly requests a security audit, OWASP scan, or vulnerability check. Can be invoked:

- **Standalone**: `/sdd-security` on any files or the current working tree.
- **SDD-integrated**: after `sdd-apply`, before `sdd-verify`. Reads the active SDD change to scope the audit to only changed files.
- **On specific files**: `/sdd-security src/api/auth.ts src/controllers/`.

Never run automatically — always require an explicit user trigger.

## Model Selection

Security auditing requires maximum reasoning depth. Use this exact priority order for Kiro:

| Priority | Model | Use when |
|----------|-------|----------|
| 1 | **Claude Opus 5** or **GPT 5.6 Sol** | Top tier — deepest reasoning, 1M context for large codebases |
| 2 | Claude Opus 4.8 / 4.7 / 4.6 / 4.5 | No top-tier model available |
| 3 | Claude Sonnet 5 | No Opus variant available |
| ❌ | Auto, GPT 5.6 Terra/Luna, Haiku, DeepSeek, MiniMax, GLM, Qwen | Never — security audit requires reliable, high-depth reasoning |

Announce the model in the report header: `Model: [model name]`.

## Hard Rules

- Audit only what changed in this SDD change (or the explicit scope). Do not audit the whole codebase unless the user asks.
- Never fix vulnerabilities automatically. Report and classify only; the user decides whether to fix before verify.
- A CRITICAL vulnerability blocks `sdd-archive`. State this explicitly in the report.
- Do not flag theoretical risks that require attacker-controlled infrastructure not present in the codebase.
- When flagging an issue, always cite the exact file, line range, and the OWASP category ID.
- If a finding is already mitigated by a framework or middleware, mark it MITIGATED and explain how.

## OWASP Top 10 — 2021 Checklist

Run each category against the changed files in order:

### A01 — Broken Access Control
- Missing authorization checks on endpoints or actions.
- Horizontal privilege escalation (user A can access user B's data).
- CORS misconfiguration allowing untrusted origins.
- Directory traversal via unsanitized path parameters.
- JWT/session tokens not validated or verified.

### A02 — Cryptographic Failures
- Sensitive data (PII, passwords, tokens) transmitted or stored in plaintext.
- Weak or deprecated algorithms (MD5, SHA1, DES, RC4).
- Hard-coded secrets, API keys, or credentials in source code.
- Missing HTTPS enforcement.
- Insufficient key length or entropy.

### A03 — Injection
- SQL injection via string concatenation or unparameterized queries.
- NoSQL injection (MongoDB `$where`, dynamic operators).
- Command injection via `exec`, `spawn`, `eval` with user input.
- XSS — reflected, stored, or DOM-based.
- Template injection (server-side or client-side).
- LDAP, XML, or XPath injection.

### A04 — Insecure Design
- Business logic flaws (e.g., skippable payment steps, rate limits bypassable).
- Missing threat model for sensitive flows (auth, payment, admin).
- No input validation at trust boundaries.
- Sensitive operations without confirmation or re-authentication.

### A05 — Security Misconfiguration
- Debug mode or stack traces exposed in production paths.
- Default credentials or configurations not overridden.
- Unnecessary features, ports, or services enabled.
- Missing or misconfigured security headers (CSP, HSTS, X-Frame-Options).
- Overly permissive file permissions or environment variables exposed.

### A06 — Vulnerable and Outdated Components
- New `package.json` dependencies added without known-vulnerability check.
- Dependencies pinned to versions with published CVEs.
- Use of abandoned or unmaintained packages.
- Note: flag for human verification — do not block on this alone without CVE evidence.

### A07 — Identification and Authentication Failures
- Weak password policies or no brute-force protection.
- Session tokens not invalidated on logout.
- Predictable or reused session identifiers.
- Missing MFA for high-privilege actions.
- Insecure "forgot password" or account recovery flows.

### A08 — Software and Data Integrity Failures
- Deserialization of untrusted data without validation.
- Unsigned or unverified software updates / plugin loading.
- CI/CD pipeline steps pulling from unverified external sources.
- Missing integrity checks on downloaded resources (no SRI for CDN assets).

### A09 — Security Logging and Monitoring Failures
- Authentication events (success/failure) not logged.
- Sensitive operations (admin actions, data exports) without audit trail.
- Logs containing PII or secrets.
- No alerting path for suspicious patterns.

### A10 — Server-Side Request Forgery (SSRF)
- User-controlled URLs passed to HTTP clients (`fetch`, `axios`, `curl`) without allowlist validation.
- Internal metadata endpoints reachable via user input (AWS IMDSv1, GCP metadata).
- Redirects to internal services following user-supplied URLs.

## Execution Steps

### Step 1 — Determine Scope

**SDD-integrated mode**: read the active SDD change artifacts to get the list of changed files.
```bash
git diff --name-only HEAD~1  # or the merge base of the current change branch
```

**Standalone mode**: use files passed by the user, or default to:
```bash
git diff --name-only --cached  # staged changes
```

Report: "Auditing N files for OWASP Top 10 compliance."

### Step 2 — Read Files

Read each in-scope file fully. Pay attention to:
- Entry points (controllers, route handlers, API endpoints).
- Auth and session handling.
- Database or external service calls.
- File I/O and process execution.
- Configuration and environment variable usage.

### Step 3 — Audit Each OWASP Category

For each category A01–A10:
1. Scan for patterns and anti-patterns in the changed code.
2. Classify each finding:
   - **CRITICAL** — exploitable without special conditions; blocks archive.
   - **WARNING** — exploitable under specific conditions; should be fixed before merge.
   - **INFO** — best-practice gap, low exploitability; document and move on.
   - **MITIGATED** — risk exists in pattern but is neutralized by observed control.
3. For each finding, record: file, line range, category, severity, evidence, and recommendation.

### Step 4 — Dependency Scan (A06)

Check `package.json` diff for new or changed dependencies:
```bash
git diff HEAD~1 -- package.json
```
Flag any package added or upgraded. Note: full CVE check requires `npm audit` — instruct the user to run it if not already in CI.

### Step 5 — Produce Security Report

```
## Security Report — {change or scope}

Scope: N files audited
Model: [model used]

### Findings

| ID | File | Lines | OWASP | Severity | Summary |
|----|------|-------|-------|----------|---------|
| S-01 | src/api/users.ts | 42-48 | A01 | CRITICAL | Missing auth check on DELETE /users/:id |
| S-02 | src/utils/db.ts | 17 | A03 | WARNING | String concatenation in SQL query |
| S-03 | src/config/env.ts | 5 | A02 | INFO | Secret read from env but not validated for length |

### Detail

#### S-01 · CRITICAL · A01 Broken Access Control
**File**: src/api/users.ts:42–48
**Evidence**:
  router.delete('/users/:id', async (req, res) => {
    await db.deleteUser(req.params.id)  // no auth middleware
  })
**Risk**: Any unauthenticated caller can delete any user.
**Fix**: Add `requireAuth` middleware and verify the caller owns the resource.

...

### Summary

| Severity  | Count | Blocks Archive |
|-----------|-------|----------------|
| CRITICAL  | 1     | ✅ Yes          |
| WARNING   | 1     | ❌ No (advised) |
| INFO      | 1     | ❌ No           |
| MITIGATED | 0     | —               |

**Verdict**: ⛔ SECURITY FAIL — 1 critical issue must be resolved before sdd-verify.

### Next Steps
1. Fix S-01 before running sdd-verify.
2. Review S-02 and apply parameterized queries.
3. Run `npm audit` to check for CVEs in new dependencies.
4. Re-run `/sdd-security` after fixes to confirm resolution.
```

### Step 6 — Persist Artifact (SDD-integrated mode)

If running inside an SDD change, save the security report as a named artifact:
- **engram**: save as `sdd/{change-name}/security-report`, type `architecture`.
- **openspec**: write to `openspec/changes/{change-name}/security-report.md`.
- **none/standalone**: return inline only.

## Decision Gates

| Condition | Action |
|-----------|--------|
| No files in scope | Ask the user to specify a target. |
| CRITICAL found | State explicitly: "Archive is blocked until this is resolved." |
| Only INFO findings | Verdict: SECURITY PASS — note findings for review. |
| A06 new dependency | Flag and instruct `npm audit`; do not auto-block without CVE. |
| Framework handles risk | Mark MITIGATED; explain the control. |
| Re-run after fixes | Compare against previous report; confirm resolved findings are gone. |

## Integration with SDD Verify

When `sdd-verify` runs, it checks for a `security-report` artifact:
- If present and PASS → include in verify report as ✅ Security gate passed.
- If present and FAIL (CRITICAL) → verify verdict is FAIL regardless of other checks.
- If absent → verify records WARNING: "Security audit not run for this change."

## Output Contract

Return `## Security Report — {scope}` with: model used, files audited, findings table, per-finding detail, summary table, verdict, and next steps.
