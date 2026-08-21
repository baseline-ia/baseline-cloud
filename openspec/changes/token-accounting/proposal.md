---
title: "token-accounting"
type: feature
---
# Proposal: Token Accounting by Date Range

## Why

The dashboard currently tracks events and ROI but has no view that aggregates **credit/token consumption** over time. Users need to understand how many credits they spend per day, per project, and per developer within a chosen date range — for budgeting, auditing, and cost control.

## What changes

- New API endpoint `GET /api/v1/metrics/credits` that returns credit usage aggregated by day, developer, and project for a given date range.
- New service function `getCreditUsage(from, to, filters?)` in `lib/services/metrics.ts` that queries `session.credits` events from the `events` table.
- New dashboard page `/dashboard/credits` with:
  - Date range picker (from/to).
  - Summary cards: total credits, daily average, top project, top developer.
  - Line chart: credits per day.
  - Table: credits grouped by developer and project.

## Out of scope

- Billing integration or payment processing.
- Setting credit budgets or alerts (future work).
- Modifying how the CLI reports `session.credits` events.

## Impact

- New files: ~4 (API route, service function additions, dashboard page, components).
- Modified files: ~2 (sidebar nav, metrics service).
- Risk: Low — read-only aggregation on existing data, no schema changes.

## Success criteria

- [ ] `GET /api/v1/metrics/credits?from=2025-01-01&to=2025-01-31` returns correct JSON aggregation.
- [ ] Dashboard page shows credit usage with working date range filter.
- [ ] Data matches what `baseline-cloud kiro scan` reports.
- [ ] Page loads in <2s with 10k+ events.

## Time estimate (for ROI)

~4h manual baseline, expecting ~1.5h with AI assist.

## Follow-ups

- Credit budget alerts per project.
- Export to CSV.
- Compare credit usage month-over-month.
