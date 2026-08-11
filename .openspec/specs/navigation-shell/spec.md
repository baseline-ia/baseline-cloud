# navigation-shell Specification

## Purpose

Defines the behavior of the dashboard chrome that renders a grouped left sidebar (Analytics + Admin), owns the sidebar width contract, hosts the theme toggle, and provides the two-column layout shell for all `(dashboard)` routes.

This is a net-new capability; no prior spec exists for the top navbar it replaces.

---

## Requirements

### Requirement: Sidebar Group Rendering

The sidebar MUST render exactly two labeled groups: **Analytics** and **Admin**.

Analytics MUST contain: Overview, Changes, Skills, Events, Developers, Activity (6 links, in order).

Admin MUST contain: Tokens, Users, Settings, Projects, Skills (admin) (5 links, in order).

Each group MUST display its label as a visible section header above its links.

#### Scenario: Analytics group rendered for any authenticated user

- GIVEN an authenticated user visits any `(dashboard)` route
- WHEN the sidebar mounts
- THEN the Analytics group header and its 6 links are visible

#### Scenario: Admin group hidden for non-admin users

- GIVEN an authenticated user whose role is NOT admin
- WHEN the sidebar mounts
- THEN the Admin group and its header are NOT rendered in the DOM

#### Scenario: Admin group rendered for admin users

- GIVEN an authenticated user whose role IS admin
- WHEN the sidebar mounts
- THEN the Admin group header and its 5 links are visible below the Analytics group

---

### Requirement: Active Link Highlighting

The sidebar MUST visually highlight the link whose `href` matches the current pathname.

Exactly one link MUST be highlighted at a time; no link is highlighted when the current route matches none.

#### Scenario: Current route link is highlighted

- GIVEN the user is on `/overview`
- WHEN the sidebar renders
- THEN the Overview link shows the active accent style and no other link does

#### Scenario: No link highlighted on unknown route

- GIVEN the user navigates to a route not in the sidebar's link list
- WHEN the sidebar renders
- THEN no sidebar link carries the active accent style

---

### Requirement: Two-Column Dashboard Shell Layout

The dashboard shell MUST use a CSS grid with two columns: `var(--sidebar-width) 1fr`.

`--sidebar-width` MUST be defined as `240px` in `globals.css`.

The `<main>` region MUST occupy the remaining horizontal space without overlapping the sidebar and without producing horizontal scroll at viewport widths ≥ 1280px.

The sidebar MUST be sticky (top: 0, height: 100vh) and scroll independently from `<main>`.

#### Scenario: Main content does not overlap the sidebar

- GIVEN a viewport width of 1280px
- WHEN a dashboard page renders
- THEN the main content left edge begins at exactly 240px from the viewport left edge

#### Scenario: No horizontal scroll on 1280px viewport

- GIVEN a viewport width of 1280px and sidebar visible
- WHEN any dashboard page renders
- THEN the document does not produce a horizontal scrollbar

#### Scenario: Sidebar stays fixed while main content scrolls

- GIVEN a dashboard page with content taller than the viewport
- WHEN the user scrolls down
- THEN the sidebar remains fixed in the viewport and does not scroll out of view

---

### Requirement: Mobile Hamburger Toggle

On viewports narrower than `768px` the sidebar MUST be hidden by default.

A hamburger button MUST be visible in the top-left corner of the mobile layout.

Activating the hamburger MUST reveal the sidebar as an overlay; activating it again MUST hide it.

#### Scenario: Sidebar hidden on mobile by default

- GIVEN a viewport width of 375px
- WHEN a dashboard page loads
- THEN the sidebar is not visible and does not occupy horizontal space

#### Scenario: Hamburger reveals sidebar

- GIVEN a viewport width of 375px and the sidebar is hidden
- WHEN the user taps the hamburger button
- THEN the sidebar slides into view as an overlay above the main content

#### Scenario: Hamburger dismisses sidebar

- GIVEN a viewport width of 375px and the sidebar is open
- WHEN the user taps the hamburger button again
- THEN the sidebar is hidden and the main content is fully visible

---

### Requirement: Theme Toggle in Sidebar Footer

The `<ThemeToggle>` component MUST be rendered inside a footer slot at the bottom of the sidebar.

The theme toggle MUST remain accessible and functional regardless of scroll position.

#### Scenario: Theme toggle is visible in sidebar footer

- GIVEN the sidebar is open (desktop or mobile)
- WHEN the user views the bottom of the sidebar
- THEN the `<ThemeToggle>` is present and interactive

#### Scenario: Theme toggle functions correctly from sidebar

- GIVEN the sidebar is open
- WHEN the user activates the theme toggle
- THEN the dashboard switches between light and dark mode using the existing token system

---

### Requirement: CSS Cleanup — Navbar Styles Removed

The `.navbar` CSS block (previously at `globals.css` lines 130–236) MUST be fully removed.

No `.navbar` selectors MUST remain in `globals.css` after this change is applied.

A new `.sidebar` and `.dashboard-shell` block MUST replace the removed block, covering: fixed positioning, vertical link stack, group headers, active-link highlight, hover state, and theme-toggle placement.

#### Scenario: No navbar selectors survive in globals.css

- GIVEN the change is applied
- WHEN `globals.css` is inspected
- THEN no selector matching `.navbar` exists in the file

#### Scenario: Sidebar and shell selectors present in globals.css

- GIVEN the change is applied
- WHEN `globals.css` is inspected
- THEN `.sidebar`, `.dashboard-shell`, and `--sidebar-width` are all defined

---

### Requirement: Dark-Mode Parity

The sidebar MUST render correctly in both light and dark themes using the existing CSS token system.

Group headers MUST use the `muted-foreground` token. Active link MUST use the accent token. Hover states MUST use the existing hover token.

No new color values MUST be hard-coded outside the token system.

#### Scenario: Dark mode sidebar renders without contrast regression

- GIVEN the user activates dark mode
- WHEN a dashboard page renders
- THEN sidebar group headers, link labels, active state, and hover states all pass visual contrast using existing tokens

#### Scenario: Light mode sidebar renders correctly

- GIVEN the user activates light mode
- WHEN a dashboard page renders
- THEN sidebar group headers, link labels, active state, and hover states render using the corresponding light-mode token values

---

### Requirement: All Existing Routes Preserved

All 11 existing dashboard links MUST remain navigable after this change.

Route paths, icons, and link labels MUST be identical to those in the prior navbar.

#### Scenario: All 11 links navigate to their respective routes

- GIVEN the sidebar is rendered for an admin user
- WHEN the user clicks each of the 11 links in turn
- THEN the browser navigates to the correct route for each link with no 404 errors

#### Scenario: Non-admin user can access all 6 Analytics links

- GIVEN the sidebar is rendered for a non-admin user
- WHEN the user clicks each of the 6 Analytics links
- THEN the browser navigates to the correct route for each link
