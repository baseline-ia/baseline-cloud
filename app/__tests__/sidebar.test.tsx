/**
 * Sidebar component tests
 * Covers: isActive helper, analytics group, admin group gating,
 *         active link class, and ThemeToggle in sidebar footer.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks — must be declared before any component imports
// ---------------------------------------------------------------------------

// Mock next/link so it renders a plain <a> in tests
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

// Mock next/navigation (usePathname) — not directly used by the Server
// Component under test, but imported transitively
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/dashboard'),
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}));

// Mock ThemeToggle to keep the test environment free of localStorage/DOM side-effects
vi.mock('@/components/layout/theme-toggle', () => ({
  ThemeToggle: () => <button data-testid="theme-toggle">ThemeToggle</button>,
}));

// ---------------------------------------------------------------------------
// Import helpers and component AFTER mocks are registered
// ---------------------------------------------------------------------------
import { isActive } from '@/lib/nav-utils';
import { Sidebar } from '@/components/layout/sidebar';
import type { DashboardSession } from '@/lib/auth';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const baseSession: DashboardSession = {
  id: 'sess-1',
  userId: 'user-1',
  username: 'alice',
  role: 'member',
  expiresAt: new Date(Date.now() + 3_600_000),
};

const adminSession: DashboardSession = {
  ...baseSession,
  role: 'admin',
};

// ---------------------------------------------------------------------------
// isActive helper tests
// ---------------------------------------------------------------------------

describe('isActive', () => {
  it('returns true for exact /dashboard match', () => {
    expect(isActive('/dashboard', '/dashboard')).toBe(true);
  });

  it('returns false when /dashboard/skills is current and href is /dashboard', () => {
    expect(isActive('/dashboard', '/dashboard/skills')).toBe(false);
  });

  it('returns true via prefix match when currentPath starts with href', () => {
    expect(isActive('/dashboard/skills', '/dashboard/skills/detail')).toBe(true);
  });

  it('returns false when paths share no prefix relationship', () => {
    expect(isActive('/dashboard/events', '/dashboard/skills')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Sidebar component tests
// ---------------------------------------------------------------------------

describe('Sidebar — analytics group (non-admin)', () => {
  let container: HTMLElement;

  beforeEach(() => {
    ({ container } = render(
      <Sidebar session={baseSession} locale="en" currentPath="/dashboard" />,
    ));
  });

  it('renders the Analytics group header', () => {
    expect(screen.getByText(/analytics/i)).toBeInTheDocument();
  });

  it('renders exactly 6 analytics nav links (inside <nav>)', () => {
    // Only count links that are direct children of the <nav> sidebar groups
    const nav = container.querySelector('nav');
    const navLinks = nav ? Array.from(nav.querySelectorAll('a[href]')) : [];
    expect(navLinks).toHaveLength(6);
  });

  it('does NOT render the Admin group header', () => {
    expect(screen.queryByText(/^admin$/i)).not.toBeInTheDocument();
  });

  it('does NOT render any admin hrefs in the DOM', () => {
    const links = Array.from(container.querySelectorAll('a[href]'));
    const adminLinks = links.filter((l) =>
      l.getAttribute('href')?.includes('/admin'),
    );
    expect(adminLinks).toHaveLength(0);
  });
});

describe('Sidebar — admin group (admin user)', () => {
  let container: HTMLElement;

  beforeEach(() => {
    ({ container } = render(
      <Sidebar session={adminSession} locale="en" currentPath="/dashboard" />,
    ));
  });

  it('renders the Admin group header', () => {
    expect(screen.getByText(/^admin$/i)).toBeInTheDocument();
  });

  it('renders exactly 11 nav links (6 analytics + 5 admin) inside <nav>', () => {
    const nav = container.querySelector('nav');
    const navLinks = nav ? Array.from(nav.querySelectorAll('a[href]')) : [];
    expect(navLinks).toHaveLength(11);
  });

  it('renders all 5 admin links inside <nav>', () => {
    const nav = container.querySelector('nav');
    const navLinks = nav ? Array.from(nav.querySelectorAll('a[href]')) : [];
    const adminLinks = navLinks.filter((l) =>
      l.getAttribute('href')?.includes('/admin'),
    );
    expect(adminLinks).toHaveLength(5);
  });
});

describe('Sidebar — active link highlighting', () => {
  it('gives the active class to the matching link', () => {
    render(
      <Sidebar session={baseSession} locale="en" currentPath="/dashboard/skills" />,
    );
    const links = screen.getAllByRole('link');
    const activeLinks = links.filter((l) => l.classList.contains('active'));
    expect(activeLinks).toHaveLength(1);
    expect(activeLinks[0].getAttribute('href')).toBe('/dashboard/skills');
  });

  it('gives zero active classes when the path matches nothing', () => {
    render(
      <Sidebar session={baseSession} locale="en" currentPath="/dashboard/unknown" />,
    );
    const links = screen.getAllByRole('link');
    const activeLinks = links.filter((l) => l.classList.contains('active'));
    expect(activeLinks).toHaveLength(0);
  });
});

describe('Sidebar — ThemeToggle in footer', () => {
  it('renders ThemeToggle inside .sidebar-footer', () => {
    const { container } = render(
      <Sidebar session={baseSession} locale="en" currentPath="/dashboard" />,
    );
    const footer = container.querySelector('.sidebar-footer');
    expect(footer).not.toBeNull();
    expect(footer?.querySelector('[data-testid="theme-toggle"]')).not.toBeNull();
  });
});
