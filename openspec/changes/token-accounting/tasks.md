---
title: "token-accounting"
status: in-progress
---
# Tasks: Token Accounting by Date Range

## Phase 1: Service Layer

- [ ] T1: Create `lib/services/credits.ts` with `getCreditUsage(filters)` function
- [ ] T2: Implement byDay, byDeveloper, byProject parallel queries
- [ ] T3: Compute summary (totalCredits, totalSessions, dailyAverage, topProject, topDeveloper)

## Phase 2: API Endpoint

- [ ] T4: Create `app/api/v1/metrics/credits/route.ts` with GET handler
- [ ] T5: Add Zod validation for query params (from, to required; project, username optional)
- [ ] T6: Wire auth (resolveBearerToken) and return JSON response

## Phase 3: Dashboard Page

- [ ] T7: Create `app/(dashboard)/dashboard/credits/page.tsx` (RSC)
- [ ] T8: Create `app/(dashboard)/dashboard/credits/date-range-picker.tsx` (client component)
- [ ] T9: Create `app/(dashboard)/dashboard/credits/credits-charts.tsx` (client component with Recharts)
- [ ] T10: Add KPI cards for summary data

## Phase 4: Navigation

- [ ] T11: Add "Credits" link to sidebar (icon, labels en/es)

## Phase 5: Verification

- [ ] T12: Verify page loads without errors on localhost
- [ ] T13: Verify API endpoint returns correct data
