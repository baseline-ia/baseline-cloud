# Proposal: Dashboard Privacy — Remove Developer Identity from Non-Admin Views

## Intent

The dashboard currently surfaces per-developer attribution (usernames, avatars,
"Top Developers" leaderboard) across public-facing views: Overview, Changes,
Events, and Activity. This exposes individual productivity signals to any
authenticated user, invites internal ranking/comparison dynamics, and mixes
per-person data into pages whose purpose is project-level health. The Developers
page itself is reachable by any authenticated user, not just admins.

This change removes per-developer identity from the four public dashboard pages,
gates the Developers page to admin sessions only, and shifts the Overview's
ranking widget from "Top Developers" to "Top Projects" using data already
returned by `getRoiSummary().byProject`. Admin surfaces keep full identity so
operators retain the visibility they need.

## Scope

### In Scope

- Overview: replace the "Top Developers" ranked table with a "Top Projects"
  breakdown driven by existing `getRoiSummary().byProject` data (no service
  change).
- Changes table: remove the `Developer` column (avatar initial + username).
- Events table: remove the `Developer` column.
- Activity feed: remove the per-row username `<code>` element.
- Developers page: add an admin-only guard that redirects non-admin sessions
  to `/dashboard`, following the pattern used in
  `app/(dashboard)/dashboard/admin/*/page.tsx`.

### Out of Scope

- Anonymizing usernames (hashing / pseudonym display) — an alternative that
  keeps ranking mechanics; explicitly rejected in favor of full removal from
  public views.
- Admin pages under `app/(dashboard)/dashboard/admin/**` — admins keep full
  developer identity.
- Navbar session-user display — a user seeing their own name is low
  invasiveness.
- `auditLog` table exposure — not yet surfaced in the UI; no change here.
- DB schema, ORM queries, or service-layer changes (`lib/services/**`,
  `lib/db/**`) — this is a display-layer change only.
- Nav/sidebar link visibility for the Developers entry — route-level guard is
  sufficient for this slice; link hiding is later refinement.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- None. This change is a display-layer refactor across four dashboard pages
  plus an admin-role redirect guard on one page. It does not modify any
  behavior described by the existing `project-enrollment` or `security-api`
  specs, and no dashboard-visibility capability spec exists today. If future
  work introduces a `dashboard-visibility` capability, this change becomes a
  natural anchor for it; for now, requirements live only at the code/UX level.

## Approach

Four display removals plus one route guard, all in `app/(dashboard)/dashboard/`:

1. **Overview** (`overview/page.tsx` ~lines 175–272): delete the "Top
   Developers" `Card` (`#`, `Developer`, `Changes`, `Time Saved`). Add a
   "Top Projects" `Card` that maps `roiSummary.byProject`, sorted by
   `timeSavedHours` (or existing sort key), rendering project name plus its
   changes count and time-saved total. Reuse the current table markup and
   Tailwind classes for visual continuity.
2. **Changes** (`changes/page.tsx` ~lines 221–242): remove the `Developer`
   `<th>` and the corresponding `<td>` (avatar initial + username span).
   Keep change name + work-type as the row identity — they already carry the
   project-level signal.
3. **Events** (`events/page.tsx` ~lines 124–131): remove the `Developer`
   column header and cell.
4. **Activity** (`activity/page.tsx` ~lines 120–130): remove the
   `<code>{username}</code>` element from each feed row. Keep the action verb
   and target so the row still reads as a coherent event.
5. **Developers** (`developers/page.tsx`): add
   `if (session.role !== 'admin') redirect('/dashboard')` at the top of the
   Server Component, mirroring the guard in `admin/projects/page.tsx` and
   sibling admin routes.

Rejected alternatives: (a) anonymize usernames with a hash — keeps the
comparison surface and adds implementation cost for no product win when the
decision is to de-emphasize per-person signals; (b) hide columns via a
role-based conditional in the same table — leaves developer-identity code
paths live in shared components and complicates future audits of what is
visible to whom.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `app/(dashboard)/dashboard/overview/page.tsx` | Modified | Remove "Top Developers" card; add "Top Projects" card from `getRoiSummary().byProject` |
| `app/(dashboard)/dashboard/changes/page.tsx` | Modified | Remove `Developer` column (header + cell) |
| `app/(dashboard)/dashboard/events/page.tsx` | Modified | Remove `Developer` column (header + cell) |
| `app/(dashboard)/dashboard/activity/page.tsx` | Modified | Remove per-row username element |
| `app/(dashboard)/dashboard/developers/page.tsx` | Modified | Add admin-only redirect guard |
| `lib/services/**` | Unchanged | No service changes; existing ROI data is sufficient |
| `lib/db/**` | Unchanged | No schema or query changes |
| `app/(dashboard)/dashboard/admin/**` | Unchanged | Admin views retain full identity |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Non-admin users lose the ability to attribute activity to a person and cannot self-diagnose "who did that change" | Med | Intentional product decision — admin views retain full identity; direct admins to `dashboard/developers` when the question arises |
| Developers nav/sidebar link stays visible to non-admins and 404-feels-broken on click | Med | Route guard redirects to `/dashboard` (not 404); follow-up work can hide the nav item based on role |
| "Top Projects" widget looks empty if `byProject` is empty for a workspace | Low | Render the same empty-state pattern the removed "Top Developers" table used |
| Snapshot / integration tests reference removed columns and username elements | Med | Update tests alongside the display change; run `pnpm test` and dashboard e2e (if present) before merge |
| Overview layout breaks because the removed card and the new one differ in row height | Low | Reuse Card/Table markup; visually verify at `md` and `lg` breakpoints |

## Rollback Plan

1. Revert the five modified page files to their prior form — the change is
   confined to those files.
2. No DB, service, migration, or API rollback needed.
3. If the admin-only guard causes an outage on `/dashboard/developers`,
   revert `developers/page.tsx` alone; the other four page changes are
   independent.

## Dependencies

- None external. `getRoiSummary().byProject` already returns the shape needed
  for the "Top Projects" card. The admin-guard pattern already exists in
  `app/(dashboard)/dashboard/admin/*/page.tsx`.

## Success Criteria

- [ ] Overview page no longer renders any "Top Developers" table; a "Top
      Projects" card renders in its place with rows sourced from
      `getRoiSummary().byProject`.
- [ ] Changes, Events, and Activity pages contain no username, avatar
      initial, or per-developer column in any row.
- [ ] Non-admin sessions requesting `/dashboard/developers` are redirected
      to `/dashboard`; admin sessions render the page unchanged.
- [ ] Admin pages under `/dashboard/admin/**` still display full developer
      identity.
- [ ] No changes to `lib/services/**`, `lib/db/**`, or any API route.
- [ ] Build and existing test suite pass with the display changes applied.
