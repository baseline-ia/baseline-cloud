---
capability: credit-usage
status: draft
---
# Credit Usage Accounting

## Overview

Aggregate and display credit/token consumption from `session.credits` and `session.tokens` events, filterable by date range, developer, and project.

## Data Model (existing — no schema changes)

Events table already stores:
- `event_type`: `"session.credits"` or `"session.tokens"`
- `payload` (JSONB):
  - **session.credits**: `{ sessionId, workspaceId, credits, turnsProcessed, title, tool }`
  - **session.tokens**: `{ sessionId, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, totalTokens }`
- `username`: who generated the session
- `project`: which project
- `occurred_at`: when

## Requirements

### REQ-1: API endpoint for credit aggregation

The system must expose `GET /api/v1/metrics/credits` that returns credit usage data.

**Inputs (query params):**
| Param | Type | Required | Default |
|-------|------|----------|---------|
| `from` | ISO date (YYYY-MM-DD) | yes | — |
| `to` | ISO date (YYYY-MM-DD) | yes | — |
| `project` | string | no | all projects |
| `username` | string | no | all developers |

**Output (JSON):**
```json
{
  "summary": {
    "totalCredits": 189.28,
    "totalSessions": 12,
    "dailyAverage": 6.1,
    "topProject": "baseline-cloud",
    "topDeveloper": "mikecobas"
  },
  "byDay": [
    { "date": "2025-08-01", "credits": 23.5, "sessions": 3 }
  ],
  "byDeveloper": [
    { "username": "mikecobas", "credits": 150.0, "sessions": 10 }
  ],
  "byProject": [
    { "project": "baseline-cloud", "credits": 120.0, "sessions": 8 }
  ]
}
```

### REQ-2: Service layer aggregation

A function `getCreditUsage(from, to, filters?)` in `lib/services/metrics.ts` that:
- Queries events where `event_type = 'session.credits'`.
- Aggregates `payload->>'credits'` cast to numeric.
- Groups by day (`to_char(occurred_at, 'YYYY-MM-DD')`), by `username`, and by `project`.
- Applies optional filters for `project` and `username`.

### REQ-3: Dashboard page

A new page at `/dashboard/credits` accessible to authenticated users that:
- Shows a date range selector (default: last 30 days).
- Displays summary cards (total credits, sessions, daily avg, top project, top developer).
- Shows a line chart of credits per day (using Recharts, already in deps).
- Shows a table of usage by developer with sortable columns.

### REQ-4: Sidebar navigation

Add a "Credits" link to the dashboard sidebar/nav between the existing items.

---

## Scenarios

### Scenario 1: Basic credit query

```
Given events exist:
  | username   | project        | event_type      | payload.credits | occurred_at |
  | mikecobas  | baseline-cloud | session.credits | 10.5            | 2025-08-01  |
  | mikecobas  | baseline-cloud | session.credits | 5.0             | 2025-08-02  |
  | johndoe    | other-project  | session.credits | 3.2             | 2025-08-01  |
When GET /api/v1/metrics/credits?from=2025-08-01&to=2025-08-02
Then response.summary.totalCredits = 18.7
And response.byDay has 2 entries
And response.byDeveloper has 2 entries (mikecobas=15.5, johndoe=3.2)
And response.byProject has 2 entries (baseline-cloud=15.5, other-project=3.2)
```

### Scenario 2: Filter by project

```
Given the same events as Scenario 1
When GET /api/v1/metrics/credits?from=2025-08-01&to=2025-08-02&project=baseline-cloud
Then response.summary.totalCredits = 15.5
And response.byDeveloper has 1 entry (mikecobas=15.5)
And response.byProject has 1 entry (baseline-cloud=15.5)
```

### Scenario 3: Filter by username

```
Given the same events as Scenario 1
When GET /api/v1/metrics/credits?from=2025-08-01&to=2025-08-02&username=johndoe
Then response.summary.totalCredits = 3.2
And response.byProject has 1 entry (other-project=3.2)
```

### Scenario 4: Empty range

```
Given no session.credits events exist between 2025-01-01 and 2025-01-31
When GET /api/v1/metrics/credits?from=2025-01-01&to=2025-01-31
Then response.summary.totalCredits = 0
And response.byDay is empty
And response.byDeveloper is empty
```

### Scenario 5: Missing required params

```
When GET /api/v1/metrics/credits (no from/to)
Then response status = 400
And error_code = "invalid_input"
```

### Scenario 6: Dashboard renders with data

```
Given the user is logged into the dashboard
And session.credits events exist for the last 30 days
When they navigate to /dashboard/credits
Then they see summary cards with totals
And they see a line chart with daily data points
And they see a table with developer breakdown
```

### Scenario 7: Dashboard handles no data gracefully

```
Given the user is logged into the dashboard
And no session.credits events exist
When they navigate to /dashboard/credits
Then they see an empty state message
And summary cards show 0
```
