# Design: Dashboard Projects — Search + Pagination

## Overview

Add client-side search and 50-per-page pagination to the admin projects table
at `/dashboard/admin/projects`. All work is confined to the existing client
component `app/(dashboard)/dashboard/admin/projects/projects-form.tsx`. No new
files, no service or DB changes, no URL/router involvement.

The chosen architecture is **local component state driving inline-derived
views**, using the shadcn primitives already installed (`Input`, `Button`).

## Architecture

### Pattern

**Container-Presentational, local-state variant.** `ProjectsForm` remains the
single stateful container that owns UI-only concerns (search query, current
page) and derives the visible slice on every render. The Server Component
(`page.tsx`) continues to be the data boundary — it fetches once via
`listProjects()` and passes the full array as a prop. No data flows back
upward; no state escapes the component.

This keeps the change one layer thick: the boundary between server data and
client presentation does not move, and no new abstraction is introduced.

### Component Layout

```
ProjectsForm (client)
├─ Enroll accordion            [unchanged]
├─ <Input> search              [NEW — above table]
├─ Count label "X of Y"        [NEW — above table]
├─ <table>
│   ├─ <thead>                 [unchanged columns]
│   └─ <tbody>
│       ├─ visibleProjects.map(...)   [was: projects.map(...)]
│       └─ empty-state <tr>    [NEW — when filteredProjects.length === 0]
└─ Pagination row              [NEW — below table, hidden when totalPages <= 1]
    ├─ <Button variant="outline"> Prev
    ├─ "Page X of Y" label
    └─ <Button variant="outline"> Next
```

### Data Flow

```
projects (prop, stable per server render)
    │
    ▼
searchQuery ──► filteredProjects = projects.filter(slug|name includes q, ci)
    │
    ▼
currentPage ──► visibleProjects = filteredProjects.slice(page*50, (page+1)*50)
    │
    ▼
<tbody> renders visibleProjects
```

- `filteredProjects` and `visibleProjects` are recomputed inline on every
  render. No `useMemo` — row counts are expected in the hundreds at most, and
  premature memoization adds noise without measurable win.
- `totalPages = Math.ceil(filteredProjects.length / PAGE_SIZE)`.
- `PAGE_SIZE = 50` is a module-level `const` above the component; it is not
  configurable at runtime.

### State Model

Two `useState` hooks at the top of `ProjectsForm`:

| State | Type | Default | Reset trigger |
|---|---|---|---|
| `searchQuery` | `string` | `""` | never (user-driven) |
| `currentPage` | `number` (0-based) | `0` | on `searchQuery` change |

**Zero-based indexing** is used internally for cleaner slice math
(`slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)`). The user-facing label
adds `+ 1` when rendering "Page X of Y". This is a deliberate deviation from
the proposal's 1-based prose, kept internal to the component.

### Integration Points

| Surface | Contract | Change |
|---|---|---|
| `page.tsx` → `<ProjectsForm projects={...} />` | Full `Project[]` prop | None |
| `useActionState` mutations (enable/disable/delete/enroll) | Server actions unchanged | None; row actions operate on the underlying `slug`, unaffected by the visible slice |
| shadcn `Input` (`components/ui/input`) | Standard controlled input | New import |
| shadcn `Button` (`components/ui/button`) | Already imported | Reused for Prev/Next |

Row-action buttons stay bound to their row's `slug`. Because filtering and
pagination only narrow which rows render, mutating a visible row cannot
target the wrong project.

### Post-Mutation State Behavior

After a server action revalidates and `page.tsx` re-renders with a new
`projects` prop:

- `searchQuery` and `currentPage` persist (they live in the client component
  and are not reset by prop changes).
- If a mutation removes rows such that `currentPage >= totalPages`, the
  visible slice becomes empty on that page. This is an accepted edge case;
  the user can click Prev, and the empty-state row does not render here
  because `filteredProjects.length > 0` (only the slice is empty, not the
  filter result). This matches the proposal's "clamp only on searchQuery
  change" scope and is not worth extra clamp logic for a low-frequency case.

## Key Decisions (ADR-style)

### ADR-1: Local `useState` over URL searchParams

**Decision.** Keep `searchQuery` and `currentPage` as component-local
`useState`. Do not sync to `?q=&page=`.

**Rationale.**
- Search and pagination on this page are ephemeral operator concerns, not
  shareable views.
- URL sync would require `router.push` on every keystroke plus debouncing,
  and would force a Server Component re-render for a purely visual concern.
- No product requirement asks for deep-linking a filtered admin view.

**Rejected alternatives.**
- **URL searchParams (`useSearchParams` + `router.replace`)**: adds routing
  churn and debounce complexity; no user-visible benefit at current scale.
- **`useReducer`**: two independent scalars with one cross-reset (query
  changes → page = 0) do not justify a reducer.

### ADR-2: Client-side filter and slice over server-side `LIMIT/OFFSET`

**Decision.** Keep `listProjects()` returning the full array; filter and
paginate in the browser.

**Rationale.**
- The projects table is an admin allowlist expected to stay in the low
  hundreds. Full-array fetch is O(n) once per navigation and negligible.
- Server-side pagination would couple `page.tsx`, `listProjects()`, and
  `ProjectsForm` through query-string plumbing for no measurable benefit.
- The rejection is scoped: if row count ever exceeds ~1000, revisit and add
  server-side `LIMIT/OFFSET` behind the same UI contract.

**Rejected alternatives.**
- **Server-side pagination in `listProjects()`**: premature; adds coupling
  and a round-trip per page change.
- **Cursor-based pagination**: overkill for a small stable list.

### ADR-3: Inline pagination markup over a new `<Pagination />` component

**Decision.** Render Prev / label / Next inline inside `ProjectsForm` using
`<Button variant="outline">`. Do not extract `components/ui/pagination.tsx`.

**Rationale.**
- Only one surface uses pagination today. Extracting a reusable component now
  would design an API against a single caller.
- The inline block is ~10 lines of JSX; extraction cost exceeds reuse benefit
  until a second consumer appears.

**Rejected alternatives.**
- **Extract `<Pagination currentPage totalPages onChange />` into
  `components/ui/`**: premature abstraction; defer until a second surface
  needs the same control.
- **Import a headless pagination library**: unjustified dependency for two
  buttons and a label.

### ADR-4: No `useMemo` on `filteredProjects` / `visibleProjects`

**Decision.** Compute derived arrays inline on every render.

**Rationale.**
- Row counts are small (hundreds max). Filter + slice cost is trivial.
- `useMemo` would add dependency-array maintenance for negligible benefit
  and could hide correctness bugs if deps drift.
- If profiling ever shows a hot path, adding `useMemo` later is a one-line
  change with no API impact.

### ADR-5: Zero-based `currentPage` internally, 1-based in the label

**Decision.** Store `currentPage` as a 0-based index; render `currentPage + 1`
in the "Page X of Y" label.

**Rationale.**
- Slice math (`page * PAGE_SIZE`) is cleaner and off-by-one-safer with
  0-based indexing.
- The UI contract (proposal, spec) is 1-based, so the label adjusts at the
  presentation edge only. No user-visible change.

### ADR-6: Empty state as a `<tr colSpan>` inside `<tbody>`

**Decision.** When `filteredProjects.length === 0`, render a single `<tr>`
with a `<td colSpan={N}>` containing "No projects found", instead of
replacing the `<table>` with a `<div>`.

**Rationale.**
- Keeps table chrome (borders, header) visible so the empty state reads as
  "filter matched nothing" rather than "the page is broken".
- Matches the semantics: the table exists, this filter simply has no rows.
- No layout shift when the user clears the query.

### ADR-7: Hide pagination row entirely when `totalPages <= 1`

**Decision.** When there is at most one page of filtered results, do not
render the pagination row at all (rather than rendering it with both
buttons disabled).

**Rationale.**
- Disabled controls with no purpose are visual noise for the common
  small-list case.
- Simpler affordance: pagination appears when it is meaningful.

## Component Contract

```ts
// module-level constant
const PAGE_SIZE = 50;

// inside ProjectsForm({ projects })
const [searchQuery, setSearchQuery] = useState("");
const [currentPage, setCurrentPage] = useState(0);

const q = searchQuery.trim().toLowerCase();
const filteredProjects = q
  ? projects.filter(p =>
      p.slug.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q)
    )
  : projects;

const totalPages = Math.max(1, Math.ceil(filteredProjects.length / PAGE_SIZE));
const visibleProjects = filteredProjects.slice(
  currentPage * PAGE_SIZE,
  (currentPage + 1) * PAGE_SIZE,
);

const onSearchChange = (value: string) => {
  setSearchQuery(value);
  setCurrentPage(0);
};
```

- `totalPages` uses `Math.max(1, ...)` so the "Page 1 of 1" label renders
  sensibly on an empty filter (the pagination row itself stays hidden by
  ADR-7).
- `q` is trimmed and lowercased once; both `slug` and `name` are lowercased
  per-row. An empty trimmed query bypasses `.filter()` entirely to avoid
  needless work on the common "no query" case.

## Rendering Order (top to bottom)

1. Enroll accordion — unchanged.
2. Search `<Input>` — controlled, `onChange={e => onSearchChange(e.target.value)}`.
3. Count label — `"{filteredProjects.length} of {projects.length} projects"`.
4. Projects `<table>`:
   - `<thead>` — unchanged columns.
   - `<tbody>` — either `visibleProjects.map(...)` (existing row markup,
     unchanged) or the empty-state `<tr>`.
5. Pagination row — rendered only when `totalPages > 1`:
   - `<Button variant="outline"` disabled at `currentPage === 0`,
     `onClick={() => setCurrentPage(p => p - 1)}>Prev</Button>`
   - `<span>Page {currentPage + 1} of {totalPages}</span>`
   - `<Button variant="outline"` disabled at
     `currentPage === totalPages - 1`,
     `onClick={() => setCurrentPage(p => p + 1)}>Next</Button>`

## Non-Functional Considerations

- **Rendering cost.** For n ≤ ~1000, per-render filter + slice is
  sub-millisecond. No memoization needed.
- **Accessibility.** The search `<Input>` gets an `aria-label` (e.g. "Search
  projects by slug or name") since no visible `<label>` is added.
  Pagination buttons carry their text label, so no extra ARIA is required.
- **Focus behavior.** Typing preserves focus in the `<Input>` naturally
  because state changes do not remount it. Page changes do not steal focus.
- **SSR.** `ProjectsForm` is already `'use client'`; state initializes with
  the same defaults on server and client, so no hydration mismatch is
  introduced.

## Assumptions

- Row-action server actions revalidate the projects list via the existing
  path revalidation. This design does not change that.
- `Project.slug` and `Project.name` are always strings (non-null); this
  matches the current schema.
- Admin operators rarely have more than a few hundred enrolled projects.
  Server-side pagination is deferred until this stops being true.

## Risks and Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| `currentPage` becomes stale after a mutation shrinks the list past its end | Low | Accepted edge case; user clicks Prev. Only reset triggered by `searchQuery` change per proposal. |
| Case-insensitive match misses accented characters (e.g. `"café"` vs `"cafe"`) | Low | Slugs are ASCII by convention; names rarely include accents in admin context. Locale-aware compare deferred until a real case appears. |
| Search input feels laggy on very large lists | Very Low | Not expected at current scale; `useMemo` is a one-line addition if profiling ever shows it. |

## Rollback

Revert `projects-form.tsx` to its prior form. Single-file change, no
migrations, no dependency additions.
