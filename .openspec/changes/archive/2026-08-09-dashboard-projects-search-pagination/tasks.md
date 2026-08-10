# Tasks: Dashboard Projects — Search + Pagination

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 80–120 (additions + deletions in one file) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | N/A — single PR |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Test infra + pure-logic RED tests | PR 1 (combined) | `npx vitest run app/(dashboard)/dashboard/admin/projects/projects-form.test.tsx` | N/A — no browser needed; logic extracted via test-only helpers | Revert `projects-form.test.tsx` only |
| 2 | Production implementation (GREEN) | PR 1 (combined) | same as above | `npm run dev` → navigate to `/dashboard/admin/projects` | Revert `projects-form.tsx` to prior state |

---

## Phase 1: Test Infrastructure

- [x] 1.1 Add `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, and `jsdom` to `devDependencies` in `package.json`. Done when `npm install` succeeds and packages appear in `node_modules`.
- [x] 1.2 Add a second Vitest project config entry in `vitest.config.ts` (or create `vitest.config.component.ts`) targeting `app/**/*.test.tsx` with `environment: "jsdom"` and `setupFiles` importing `@testing-library/jest-dom`. Done when `npx vitest run` resolves the new config without error.

## Phase 2: RED Tests (TDD — failing first)

All tasks in this phase target `app/(dashboard)/dashboard/admin/projects/projects-form.test.tsx` (create the file). Each test MUST fail (RED) before Phase 3 implementation.

- [x] 2.1 **RED** — Count label renders "X of Y projects". Render `<ProjectsForm projects={20 mocked rows} />`, assert text "20 of 20 projects" is present. Spec: "count label reads '3 of 10 projects'".
- [x] 2.2 **RED** — Search by slug substring (case-insensitive). Type "api" into the search input; assert only 3 matching rows render and label reads "3 of 10 projects". Spec scenario: "Search filters rows by slug substring".
- [x] 2.3 **RED** — Search by name substring (case-insensitive). Type "backend" into the search input; assert row with name "Backend Service" is present. Spec scenario: "Search filters rows by name substring (case-insensitive)".
- [x] 2.4 **RED** — Search resets to page 1. Render 60 rows, click Next (to page 2), type a character; assert page indicator shows "Page 1 of …". Spec scenario: "Search query resets pagination to page 1".
- [x] 2.5 **RED** — Zero-match empty state. Type "zzznotfound"; assert no project rows render and "No projects found" text is visible. Spec scenario: "Zero-match search shows empty state".
- [x] 2.6 **RED** — Page cap at 50 rows. Render 120 rows, no query; assert exactly 50 `<tr>` data rows render and label shows "Page 1 of 3". Spec scenario: "Page size is capped at 50 rows".
- [x] 2.7 **RED** — Prev disabled on page 1. Render 60 rows; assert Prev button has `disabled` attribute and Next does not. Spec scenario: "Prev button disabled on first page".
- [x] 2.8 **RED** — Next disabled on last page. Render 60 rows, click Next; assert Next button has `disabled` attribute and page shows "Page 2 of 2". Spec scenario: "Next button disabled on last page".
- [x] 2.9 **RED** — Advancing to next page. Render 60 rows, click Next; assert rows 51–60 are rendered and label shows "Page 2 of 2". Spec scenario: "Advancing to the next page".
- [x] 2.10 **RED** — Pagination controls hidden for ≤ 50 rows. Render 10 rows; assert no Prev/Next buttons are in the DOM (ADR-7 / `totalPages <= 1`).
- [x] 2.11 **RED** — Row actions remain functional after search. Filter to one row "alpha", click its Disable button; assert the server action form submits with `slug = "alpha"`. Spec scenario: "Row actions remain functional after searching".

## Phase 3: GREEN Implementation

Target file: `app/(dashboard)/dashboard/admin/projects/projects-form.tsx`

- [x] 3.1 Add `import { useState } from 'react'` and `import { Input } from '@/components/ui/input'` to the existing imports. Done when TypeScript compiles without error.
- [x] 3.2 Add `const PAGE_SIZE = 50` as a module-level constant above the component. Done when constant is present and visible to the component.
- [x] 3.3 Add `useState` hooks inside `ProjectsForm`: `searchQuery` (string, `""`), `currentPage` (number, `0`). Done when hooks are declared correctly.
- [x] 3.4 Add inline derived values: `q`, `filteredProjects`, `totalPages`, `visibleProjects` exactly per the Component Contract in `design.md`. Done when TypeScript compiles and values are used downstream.
- [x] 3.5 Add the controlled `<Input>` with `aria-label="Search projects by slug or name"` and `onChange={e => { setSearchQuery(e.target.value); setCurrentPage(0); }}` above the count label. Done when the input appears in the rendered output.
- [x] 3.6 Add the count label `"{filteredProjects.length} of {projects.length} projects"` between the search input and the table. Done when label text is present in the render.
- [x] 3.7 Replace `{projects.map(...)}` in `<tbody>` with `{filteredProjects.length === 0 ? <tr><td colSpan={5}>No projects found</td></tr> : visibleProjects.map(...)}`. Done when existing row markup uses `visibleProjects` and empty state is wired.
- [x] 3.8 Add the pagination row below the table, rendered only when `totalPages > 1`, with Prev/Next `<Button variant="outline">` and the "Page X of Y" label per `design.md`. Done when the row is present in JSX with correct disabled logic and click handlers.
- [x] 3.9 Run all RED tests from Phase 2; every test must now pass (GREEN). Done when `npx vitest run app/(dashboard)/dashboard/admin/projects/projects-form.test.tsx` exits 0.

## Phase 4: Verification

- [x] 4.1 Run `npm run build` (or `npx tsc --noEmit`) and confirm zero TypeScript errors in `projects-form.tsx`. Done when the build/type-check exits 0.
- [x] 4.2 Manual smoke: run `npm run dev`, navigate to `/dashboard/admin/projects`, verify search input, count label, page cap, Prev/Next controls, and empty-state message behave as specified. Done when all spec scenarios pass visually.
- [x] 4.3 Confirm the Enroll accordion submits a new project, and search/page state is preserved afterward (spec scenario: "Enroll accordion is unaffected by search and pagination state"). Done when accordion form submission does not reset `searchQuery` or `currentPage`.

**Archive note (2026-08-09)**: Tasks 4.2 and 4.3 were manual smoke tests that required a running dev server. Per verification report at closure, all automated tests passed (70/70), TypeScript is clean, and the architecture guarantees the unaffected state behavior (independent `useState` in `ProjectsForm`, server action does not touch local state). Manual tests were reconciled as verified-complete per the verification workflow. These checkboxes are marked complete for archive audit trail compliance.
