# Delta for project-enrollment

## MODIFIED Requirements

### Requirement: Admin Enrollment UI

The system MUST provide an admin-only UI at `/dashboard/admin/projects` for
managing the project allowlist. Access MUST be gated to sessions with
`role === 'admin'`. Non-admin requests to this route MUST be redirected or
shown an authorization error.

The UI MUST include a search input above the projects table that filters
visible rows by `slug` or `name` using a case-insensitive substring match.
The table MUST render at most 50 rows per page. When the search query changes,
the current page MUST reset to page 1. A filtered result set of zero rows
MUST display an explicit empty-state message. A count label MUST display the
number of filtered rows relative to the total (e.g. "3 of 120 projects").
Pagination controls MUST show the current page indicator, a Prev button
(disabled on the first page), and a Next button (disabled on the last page).

(Previously: no search or pagination — all enrolled projects were listed in a
single unpaginated table with a plain total count.)

#### Scenario: Admin views the project list

- GIVEN one or more projects are enrolled
- WHEN an admin navigates to `/dashboard/admin/projects`
- THEN all enrolled projects are listed with their slug, display name, and enabled status

#### Scenario: Empty enrollment list

- GIVEN no projects are enrolled
- WHEN an admin navigates to `/dashboard/admin/projects`
- THEN the page renders without error and shows an empty-state message

#### Scenario: Non-admin cannot access the admin projects page

- GIVEN a session with `role !== 'admin'`
- WHEN the user navigates to `/dashboard/admin/projects`
- THEN the system returns an authorization error or redirects away

#### Scenario: Search filters rows by slug substring

- GIVEN 10 projects are enrolled, 3 of whose slugs contain `"api"`
- WHEN an admin types `"api"` into the search input
- THEN only the 3 matching rows are visible in the table
- AND the count label reads "3 of 10 projects"

#### Scenario: Search filters rows by name substring (case-insensitive)

- GIVEN a project with name `"Backend Service"` is enrolled
- WHEN an admin types `"backend"` (lowercase) into the search input
- THEN that project row is visible in the table

#### Scenario: Search query resets pagination to page 1

- GIVEN 60 projects are enrolled and the admin is on page 2
- WHEN the admin types a character into the search input
- THEN the current page resets to page 1

#### Scenario: Zero-match search shows empty state

- GIVEN projects are enrolled but none match the query `"zzznotfound"`
- WHEN an admin types `"zzznotfound"` into the search input
- THEN no project rows are rendered
- AND an explicit "No projects found" message is displayed

#### Scenario: Page size is capped at 50 rows

- GIVEN 120 projects are enrolled and no search query is active
- WHEN an admin views the first page
- THEN exactly 50 rows are rendered
- AND the pagination indicator shows "Page 1 of 3"

#### Scenario: Prev button disabled on first page

- GIVEN the admin is on page 1
- WHEN the admin views the pagination controls
- THEN the Prev button is disabled

#### Scenario: Next button disabled on last page

- GIVEN the admin is on the last page
- WHEN the admin views the pagination controls
- THEN the Next button is disabled

#### Scenario: Advancing to the next page

- GIVEN 60 projects are enrolled, no search query, and the admin is on page 1
- WHEN the admin clicks the Next button
- THEN rows 51–60 are rendered
- AND the pagination indicator shows "Page 2 of 2"

#### Scenario: Row actions remain functional after searching

- GIVEN the admin has filtered the table to show project `"alpha"`
- WHEN the admin clicks the disable action for `"alpha"`
- THEN the disable action executes normally and `"alpha"` is disabled

#### Scenario: Enroll accordion is unaffected by search and pagination state

- GIVEN the admin has typed a search query and navigated to page 2
- WHEN the admin opens the enroll accordion above the table
- THEN the accordion renders and functions normally
- AND submitting the enroll form does not clear the search query or page state
