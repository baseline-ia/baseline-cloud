---
title: "token-accounting"
status: draft
---
# Design: Token Accounting by Date Range

## Architecture Decision

Follow the existing server-component pattern: the dashboard page is an **async RSC** that calls a service function directly (no client-side fetch for initial load). The date range filter will use search params + a client component for the picker that navigates via `router.push`.

The API endpoint (`/api/v1/metrics/credits`) exists for external consumers (CLI, CI tools) and shares the same service function.

## File Layout

```
lib/services/credits.ts                         # NEW — service layer
app/api/v1/metrics/credits/route.ts             # NEW — public API endpoint
app/(dashboard)/dashboard/credits/page.tsx      # NEW — dashboard page (RSC)
app/(dashboard)/dashboard/credits/credits-charts.tsx  # NEW — client component (Recharts)
app/(dashboard)/dashboard/credits/date-range-picker.tsx  # NEW — client component
components/layout/sidebar.tsx                   # MODIFY — add "Credits" nav item
```

## Service Layer: `lib/services/credits.ts`

### Function signature

```typescript
interface CreditUsageFilters {
  from: Date;
  to: Date;
  project?: string;
  username?: string;
}

interface CreditUsageResult {
  summary: {
    totalCredits: number;
    totalSessions: number;
    dailyAverage: number;
    topProject: string | null;
    topDeveloper: string | null;
  };
  byDay: Array<{ date: string; credits: number; sessions: number }>;
  byDeveloper: Array<{ username: string; credits: number; sessions: number }>;
  byProject: Array<{ project: string; credits: number; sessions: number }>;
}

export async function getCreditUsage(filters: CreditUsageFilters): Promise<CreditUsageResult>
```

### Query strategy

Three aggregation queries run in parallel:
1. **byDay**: `GROUP BY to_char(occurred_at, 'YYYY-MM-DD')` → also used to compute summary.
2. **byDeveloper**: `GROUP BY username`.
3. **byProject**: `GROUP BY project`.

All queries:
- Filter `event_type = 'session.credits'`.
- Filter `occurred_at BETWEEN from AND to` (inclusive, to = end of day).
- Cast `payload->>'credits'` to numeric and SUM.
- COUNT for sessions.
- Apply optional `project` and `username` filters.

Summary fields are computed from the byDay array:
- `totalCredits` = sum of all byDay credits.
- `totalSessions` = sum of all byDay sessions.
- `dailyAverage` = totalCredits / number of days in range.
- `topProject` / `topDeveloper` = max by credits.

### Performance notes

- Existing index `events_type_idx` on `event_type` will be used.
- Existing index `events_occurred_at_idx` on `occurred_at` helps range scans.
- For large datasets (>100k events), consider a composite index `(event_type, occurred_at)` — deferred to a follow-up if needed.

## API Endpoint: `app/api/v1/metrics/credits/route.ts`

- **Auth**: Bearer token required (same as other `/api/v1` routes).
- **Method**: GET.
- **Validation**: Zod schema for query params — `from` and `to` required (ISO date format), `project` and `username` optional.
- **Response**: JSON matching `CreditUsageResult`.

## Dashboard Page: `app/(dashboard)/dashboard/credits/page.tsx`

- **Server component** (async RSC).
- Reads `searchParams` for `from` and `to` (defaults to last 30 days if not provided).
- Calls `getCreditUsage()` directly.
- Renders:
  - `<DateRangePicker>` (client component) — two date inputs, navigates on change.
  - KPI cards (reuse `<KpiCard>` from `components/dashboard/kpi-card.tsx`).
  - `<CreditsCharts>` (client component) — Recharts `<LineChart>` for daily credits + a `<BarChart>` for by-developer.

### Client components

1. **`DateRangePicker`**: Two `<input type="date">` fields. On change, calls `router.push` with updated search params. No state management needed beyond local inputs.

2. **`CreditsCharts`**: Receives `byDay` and `byDeveloper` as props (serializable). Renders:
   - Line chart: X=date, Y=credits.
   - Bar chart: X=developer, Y=credits.
   - Uses `recharts` (already installed).

## Sidebar Modification

Add to `NAV_GROUPS[0].links` (analytics group) after "Changes & ROI":

```typescript
{ href: '/dashboard/credits', label: 'nav.credits', key: 'credits' }
```

Add labels:
- `en`: `'nav.credits': 'Credits'`
- `es`: `'nav.credits': 'Créditos'`

Add icon:
- `credits: <Coins size={15} />` (from `lucide-react`)

## Testing Strategy

- **Unit test** (`lib/__tests__/credits.test.ts`): Mock Drizzle query results, verify `getCreditUsage` returns correct aggregations and handles empty data.
- **Integration** (optional, if DB available): Seed `session.credits` events, verify end-to-end.
- **Component test** (`app/(dashboard)/dashboard/credits/credits-charts.test.tsx`): Verify charts render without crashing given sample data.

## Decisions Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Server-side data fetch (RSC), not client-side | Matches existing pages (overview, changes). Simpler. |
| 2 | Separate client component for charts | Recharts needs `'use client'`. Minimize client bundle. |
| 3 | Search params for date range, not state | Shareable URLs, browser back works, SSR-friendly. |
| 4 | No new DB table or migration | `session.credits` events already stored in `events` table. Pure read-only aggregation. |
| 5 | Reuse `KpiCard` component | Consistent design language, less code. |
