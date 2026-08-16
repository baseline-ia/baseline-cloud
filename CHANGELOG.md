# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

- Return `assigned_skills` from CLI project enrollment so the client can synchronize corporate skills automatically.
- Corporate skills are global to every project; project assignment controls and storage were removed, and migration `0003_black_mauler` drops the obsolete `project_skill_assignments` table.

## [0.4.0] - 2026-08-10

### Added

- **Corporate skills management and distribution.** Admins can create versioned SKILL.md files with SHA-256 tamper-evidence, assign them to projects, and serve them to the CLI via a Bearer-authenticated API. Includes an admin UI at `/dashboard/admin/skills` and two new endpoints: `GET /api/v1/skills` and `GET /api/v1/skills/:slug/verify`.
- **Project enrollment CLI endpoint.** A new `POST /api/v1/projects/enroll` endpoint allows the CLI to enroll projects programmatically. The login response now returns a `token` field to support the CLI auth flow.
- **Search and pagination on the admin projects list.** The projects admin page now includes a search bar (filters by slug or name) and 50-items-per-page pagination.

### Changed

- **Developer identity removed from public views.** Names and usernames no longer appear in public dashboard pages. The Top Developers leaderboard is replaced by Top Projects. The Developer column is removed from the Changes, Events, and Activity pages. The Developers page is now gated to admin-only access.
- **EventSchema extracted to a shared module.** `lib/events/schema.ts` now owns the event schema definition, making it reusable across API routes.

## [0.3.0] - 2026-08-09

### Added

- **Project enrollment allowlist for telemetry events.** Admins can now enroll specific projects that are permitted to send telemetry events. Requests from non-enrolled projects are rejected with a `403 Forbidden` response, giving operators explicit control over which projects contribute data.
- **In-memory rate limiting on auth and event endpoints.** All authentication and event ingestion routes are now protected by a configurable rate limiter, preventing abuse without requiring an external dependency.
- **Lucide icons across the UI.** The navbar, theme toggle, and page headers now use Lucide icons for a consistent visual language.

### Fixed

- **Activity page mouse event compatibility.** Replaced `onMouseEnter`/`onMouseLeave` handlers (invalid in React Server Components) with CSS hover, eliminating a runtime warning and ensuring the page renders correctly in RSC mode.
- **Auth and session API hardening.** The `401` login response now includes a human-readable reason. Email is no longer required during sign-up (username-only flow supported). Session lifecycle events are captured in the event schema.
- **Set-locale route corrected.** The locale-switching route was broken and is now functional.
- **HTTP-only deployment support.** A new `COOKIE_SECURE` environment variable allows the application to run correctly behind plain HTTP (e.g. a local or staging VPS) without forcing secure-only cookies.

### Changed

- **Dockerfile rebuilt as a 3-stage build with npm cache.** The image now uses BuildKit layer caching for `npm install`, significantly reducing rebuild times. The container port has changed from `3000` to `3007` to match the expected VPS-exposed port. Healthcheck management is delegated to the container platform (Coolify) rather than being baked into the image.
- **Replaced `bcrypt` with `bcryptjs`.** Eliminates native Alpine compilation (`node-gyp`) in Docker builds, making the image portable across architectures without build tools.
- **Switched from `npm ci` to `npm install` in Docker.** Avoids cross-platform lockfile mismatches when the lockfile was generated on a different OS or npm version.

## [0.2.0] - prior

### Added

- Phase 2 dashboard pages: overview, changes, developers, activity, skills, events.
- Phase 3 REST API routes: `/api/v1/events`, `/api/v1/auth/*`.
- Phase 4 admin pages: tokens, users, settings.
- Next.js 16 standalone build with Docker support.
- Middleware migrated to proxy pattern (Next.js 16.3.0 upgrade).

### Fixed

- CSS hover substituted for RSC-invalid mouse event handlers in `KpiCard`.
- Excluded `src/` from Next.js type checking to prevent spurious errors.

[Unreleased]: https://github.com/mikecobas/baseline-cloud/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/mikecobas/baseline-cloud/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/mikecobas/baseline-cloud/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/mikecobas/baseline-cloud/releases/tag/v0.2.0
