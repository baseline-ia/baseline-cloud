# dashboard-privacy Specification

## Purpose

Defines what the dashboard MUST and MUST NOT expose about developer identity
in non-admin views. Admin surfaces are explicitly excluded from these
constraints.

---

## Requirements

### Requirement: Top Projects Card Replaces Top Developers Leaderboard

The Overview page MUST display a "Top Projects" card sourced from
`getRoiSummary().byProject`. Each row MUST render the project slug, change
count, and time saved. The "Top Developers" leaderboard MUST NOT appear.
No developer name, username, or avatar MAY be present in the card.

#### Scenario: Overview renders Top Projects rows

- GIVEN an authenticated non-admin user is on the Overview page
- WHEN the page loads and `getRoiSummary().byProject` returns one or more entries
- THEN a "Top Projects" card is visible
- AND each row shows project slug, change count, and time saved
- AND no developer name or username is visible anywhere in the card

#### Scenario: Overview shows empty state when byProject is empty

- GIVEN an authenticated user is on the Overview page
- WHEN `getRoiSummary().byProject` returns an empty array
- THEN the "Top Projects" card renders the same empty-state pattern previously used by the removed leaderboard
- AND no error is thrown

#### Scenario: Top Developers leaderboard is absent

- GIVEN any authenticated user is on the Overview page
- WHEN the page renders
- THEN no table or card with a "Top Developers" heading exists in the DOM

---

### Requirement: Changes Table Has No Developer Column

The Changes page table MUST NOT contain a Developer column (header or cell).
All other columns (change name, work type, project, date, etc.) MUST remain.

#### Scenario: Changes table column set

- GIVEN an authenticated non-admin user navigates to the Changes page
- WHEN the changes table renders
- THEN no "Developer" column header is present
- AND no avatar initial or username is rendered in any table row

#### Scenario: Changes table retains project-level identity columns

- GIVEN an authenticated user is on the Changes page
- WHEN at least one change row exists
- THEN every row still shows change name and work type

---

### Requirement: Events Table Has No Developer Column

The Events page table MUST NOT contain a Developer column (header or cell).
All other columns MUST remain.

#### Scenario: Events table column set

- GIVEN an authenticated user navigates to the Events page
- WHEN the events table renders
- THEN no "Developer" column header is present
- AND no per-row username or avatar is visible

#### Scenario: Events table retains non-identity columns

- GIVEN the Events page renders with at least one event
- WHEN the user inspects the table
- THEN all columns except Developer are still present and populated

---

### Requirement: Activity Feed Shows No Username Attribution

Each row in the Activity feed MUST show event type and timestamp only.
No username element (e.g., `<code>{username}</code>`) MAY appear in any row.
The action verb and target MUST remain so rows are still coherent events.

#### Scenario: Activity row renders without username

- GIVEN an authenticated user is on the Activity page
- WHEN the activity feed renders with one or more events
- THEN each row displays the event type and timestamp
- AND no username or user-identifying element is present in any row

#### Scenario: Activity row still communicates event intent

- GIVEN the Activity page has a feed entry for a code change event
- WHEN the user reads that row
- THEN the action verb and target are visible without username attribution

---

### Requirement: Developers Page Is Admin-Only

Non-admin authenticated users who request `/dashboard/developers` MUST be
redirected to `/dashboard`. Admin users MUST access the page normally
with no redirect.

#### Scenario: Non-admin user is redirected

- GIVEN a user with a non-admin session role
- WHEN the user navigates to `/dashboard/developers`
- THEN the server redirects to `/dashboard`
- AND the Developers page content is never rendered

#### Scenario: Admin user accesses Developers page normally

- GIVEN a user with an admin session role
- WHEN the user navigates to `/dashboard/developers`
- THEN the Developers page renders fully with all developer identity data
- AND no redirect occurs

---

### Requirement: Admin Pages Retain Full Developer Identity

Pages under `/dashboard/admin/**` MUST continue to display complete developer
identity data (names, usernames, avatars) and MUST NOT be affected by the
privacy constraints above.

#### Scenario: Admin page shows full identity

- GIVEN a user with an admin session role
- WHEN the user views any page under `/dashboard/admin/**`
- THEN developer names, usernames, and identity fields are visible

---

### Requirement: Navbar Session-User Display Is Unaffected

The logged-in user's own identity (name, avatar) in the top navigation bar
MUST remain visible regardless of session role. This requirement is
explicitly out of scope for the privacy constraints above.

#### Scenario: Navbar shows own identity

- GIVEN any authenticated user
- WHEN the user views any dashboard page
- THEN the user's own name or avatar in the navbar is visible and unchanged
