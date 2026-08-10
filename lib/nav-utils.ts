/**
 * Navigation utility helpers.
 * Extracted from components/layout/navbar.tsx so they can be tested in
 * isolation and shared between the Sidebar server component and any future
 * navigation consumers.
 */

/**
 * Determines whether a nav-link `href` should be considered active given
 * the current pathname.
 *
 * Rules:
 *  - `/dashboard` (the exact root) matches only when currentPath is
 *    exactly `/dashboard` or `/dashboard/` — prevents every child route
 *    from also being marked active.
 *  - All other hrefs use a prefix match: active when currentPath starts
 *    with href.
 */
export function isActive(href: string, currentPath: string): boolean {
  if (href === '/dashboard') {
    return currentPath === '/dashboard' || currentPath === '/dashboard/';
  }
  return currentPath.startsWith(href);
}
