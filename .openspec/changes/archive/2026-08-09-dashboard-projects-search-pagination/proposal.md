# Proposal: Dashboard Projects — Search + Pagination

## Intent

The admin projects list at `/dashboard/admin/projects` currently renders every
enrolled project row in a single unpaginated table. As the enrollment allowlist
grows, admins have no way to find a specific project by name or slug, and the
DOM grows unbounded on every page load. This change adds a case-insensitive
search bar (matching `slug` and `name`) and paginates the visible rows at 50
per page, so admins can locate and act on any project in constant screen space.

## Scope

### In Scope

- Search input above the projects table that filters visible rows on `slug`
  and `name` (case-insensitive substring match).
- Client-side pagination at 50 rows per page, with a minimal inline pagination
  control (Prev / page indicator / Next) built from the existing shadcn
  `Button` component.
- Pagination resets to page 1 whenever the search query changes so the visible
  window always starts from the top of the filtered result set.
- Empty-state copy when the search query matches zero rows.
- All state (`searchQuery`, `currentPage`) lives inside `ProjectsForm` as
  `useState`; no URL, server, or DB involvement.

### Out of Scope

- URL-based pagination or search (`?q=&page=`) — not needed at current scale
  and adds routing/debounce complexity for no product win.
- Server-side filtering or `LIMIT/OFFSET` in `listProjects()` — the projects
  table stays a small admin allowlist, so fetching all rows and slicing on
  the client is acceptable.
- A reusable `<Pagination />` component in `components/ui/` — inline UI keeps
  the change surface minimal; extraction can happen later when a second page
  needs the same control.
- Column sorting, filtering by `enabled`/`disabled` state, or bulk actions.
- Changes to the enroll form, row actions (rename / disable / enable), or
  audit behavior.
- Changes to `page.tsx`, `lib/services/projects.ts`, or the DB schema.

## Capabilities

### Modified Capabilities

- `project-enrollment`: the admin management UI gains client-side search and
  50-per-page pagination over the existing enrollment list. Enrollment
  semantics, audit trail, and allowlist enforcement are unchanged.

## Approach

Add two pieces of local state to `ProjectsForm`:

- `searchQuery: string` — bound to a new shadcn `<Input>` rendered above the
  table.
- `currentPage: number` — 1-based index of the active page.

Derive `filteredProjects` from `projects` by lowercase substring match on
`slug` and `name`. Derive `pagedProjects = filteredProjects.slice((currentPage
- 1) * 50, currentPage * 50)`. Render `pagedProjects` in the existing table
loop. Below the table, render an inline pagination row (Prev button, "Page X
of Y", Next button) using the existing `Button` component, disabled at the
respective ends. When `searchQuery` changes, reset `currentPage` to 1.

No changes to `page.tsx`, `listProjects()`, the service layer, or the DB. All
work is confined to `app/(dashboard)/dashboard/admin/projects/projects-form.tsx`.

Rejected: (a) URL searchParams pagination — would require `router.push` on
every keystroke plus debouncing, and forces a Server Component re-render for
what is a purely visual concern; (b) server-side `LIMIT/OFFSET` in
`listProjects()` — unnecessary at this scale and creates coupling between
service, page, and form for no product benefit; (c) extracting a shared
`<Pagination />` component — premature until a second surface needs the same
control.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `app/(dashboard)/dashboard/admin/projects/projects-form.tsx` | Modified | Add `searchQuery` + `currentPage` state, search `<Input>`, filtered + paginated row rendering, inline pagination controls |
| `app/(dashboard)/dashboard/admin/projects/page.tsx` | Unchanged | Continues to call `listProjects()` and pass the full array |
| `lib/services/projects.ts` | Unchanged | `listProjects()` behavior unchanged |
| `lib/db/schema.ts` | Unchanged | No schema changes |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `listProjects()` still fetches every row on each page load | Low | Acceptable at expected admin-allowlist scale (hundreds, not thousands); revisit with server-side pagination if the row count grows materially |
| Filter and slice run on every render | Low | Row count is small; `useMemo` on `filteredProjects` and `pagedProjects` keeps re-renders cheap if needed |
| Pagination state desyncs from filtered length (e.g. user on page 5, then searches down to 2 pages) | Med | Reset `currentPage` to 1 on every `searchQuery` change; also clamp `currentPage` to `max(1, totalPages)` on render |
| Empty search result feels broken without feedback | Low | Explicit empty-state row / message inside the table when `filteredProjects.length === 0` |

## Rollback Plan

1. Revert `projects-form.tsx` to its prior form — the file is the sole
   surface of the change.
2. No DB, service, or route rollback needed.

## Dependencies

- None external. Uses existing shadcn `Input` and `Button` components.

## Success Criteria

- [ ] A search input appears above the projects table on
      `/dashboard/admin/projects`.
- [ ] Typing in the search input filters visible rows to those whose `slug`
      or `name` contains the query (case-insensitive).
- [ ] The table renders at most 50 rows at once.
- [ ] Prev / Next controls advance the visible window; both disable at the
      respective ends; the current page and total page count are visible.
- [ ] Changing the search query resets the view to page 1.
- [ ] A zero-match search shows an explicit empty-state message rather than
      an empty table.
- [ ] No changes to `page.tsx`, `lib/services/projects.ts`, or the DB schema.
