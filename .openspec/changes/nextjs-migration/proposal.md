---
id: nextjs-migration
title: Replace Fastify+Eta with Next.js 15
status: approved
created: 2026-08-08
---

## Intent

Replace the current Fastify + Eta SSR stack with Next.js 15 (App Router) + React 19 + shadcn/ui. The current stack has no component ecosystem, poor DX for interactive UI, and no path to modern patterns (Server Components, Server Actions, streaming).

## Problem

- Fastify/Eta templates are string-interpolated HTML — no component reuse, no TypeScript safety in templates, no interactive islands without raw JS.
- Adding UI libraries (Mantine, Ant Design, etc.) is impossible without a React runtime.
- Chart.js integration is manual canvas wiring with no React lifecycle.
- The two-tier navbar and KPI redesigns hit the ceiling of what's feasible with Eta.

## Scope

**In scope:**
- Full replacement of `src/` (Fastify server + Eta templates) with Next.js App Router
- Port DB schema, auth logic, i18n, and metrics service unchanged into `lib/`
- Rebuild all UI pages as React Server Components + shadcn/ui
- Swap Chart.js for Recharts (React-native charting)
- Update Docker (Dockerfile + docker-compose.yml) for Next.js build

**Out of scope:**
- DB schema changes
- API contract changes (same `/v1/*` routes)
- Auth algorithm changes (same HMAC token logic)

## Approach

Keep the existing `src/` directory as reference until Phase 4 Docker validation is complete. Work in a git worktree (`worktree-agent-a467615e3ff8150ed`) until ready to merge.

Phases:
1. Foundation — config files, lib/ ports, app skeleton, login, health API ✅
2. Dashboard pages — Server Components for overview, events, developers, changes, skills, activity
3. API routes — `/v1/events`, `/v1/auth/*` batch endpoints
4. Admin pages — users CRUD, tokens, settings with shadcn/ui forms
5. Docker — Next.js Dockerfile + docker-compose update, remove src/

## Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Next.js 15 App Router | SSR + RSC + Server Actions, large ecosystem |
| UI library | shadcn/ui | Unstyled Radix primitives, copy-into-repo model, full control |
| Styling | Tailwind CSS v3 | shadcn requirement, utility-first |
| Charts | Recharts | React-native, no canvas wiring needed |
| DB client | postgres.js (unchanged) | Already battle-tested in this repo |
| Auth | Same HMAC token logic | No migration risk |
| Fonts | Inter + JetBrains Mono | Matches existing design system |
