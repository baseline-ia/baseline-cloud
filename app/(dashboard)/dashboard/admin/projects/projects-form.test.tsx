/**
 * Tests for ProjectsForm — search + pagination feature
 * Spec: dashboard-projects-search-pagination
 *
 * These tests verify the client-side search and pagination behavior added to
 * the admin projects list. Server actions are mocked; only UI behavior is tested.
 */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock server actions — they use 'use server' and cannot run in jsdom
vi.mock('./actions', () => ({
  enrollProjectAction: vi.fn(),
  disableProjectAction: vi.fn(),
  enableProjectAction: vi.fn(),
  deleteProjectAction: vi.fn(),
}));

// Mock useActionState — React 19 API; provide a minimal stub for form-action hooks
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useActionState: vi.fn((_action: unknown, initialState: unknown) => [initialState, vi.fn(), false]),
  };
});

import { ProjectsForm } from './projects-form';
import type { Project } from '@/lib/db/schema';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProject(i: number, overrides: Partial<Project> = {}): Project {
  return {
    slug: `project-${i}`,
    name: `Project ${i}`,
    enabled: true,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    createdByUserId: null,
    disabledAt: null,
    disabledByUserId: null,
    ...overrides,
  };
}

function makeProjects(count: number, overrides: Partial<Project> = {}): Project[] {
  return Array.from({ length: count }, (_, i) => makeProject(i + 1, overrides));
}

/** Returns only the data rows in tbody (excludes any empty-state row) */
function getDataRows(): HTMLElement[] {
  const tbody = document.querySelector('tbody');
  if (!tbody) return [];
  const rows = Array.from(tbody.querySelectorAll('tr'));
  // Exclude the empty-state row (contains "No projects found")
  return rows.filter((row) => !row.textContent?.includes('No projects found'));
}

/** Gets the search input by its aria-label (unique in the DOM after implementation) */
function getSearchInput(): HTMLElement {
  return screen.getByRole('textbox', { name: /search projects/i });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProjectsForm — search + pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── 2.1 Count label ───────────────────────────────────────────────────────

  describe('count label', () => {
    it('shows "X of Y projects" with no search query (X === Y)', () => {
      const projects = makeProjects(20);
      render(<ProjectsForm projects={projects} />);
      expect(screen.getByText('20 of 20 projects')).toBeInTheDocument();
    });

    it('shows "3 of 10 projects" after filtering to 3 matching results', async () => {
      // 3 projects whose slugs contain "api", 7 others
      const apiProjects = [
        makeProject(1, { slug: 'api-gateway', name: 'API Gateway' }),
        makeProject(2, { slug: 'api-users', name: 'Users API' }),
        makeProject(3, { slug: 'api-billing', name: 'Billing API' }),
      ];
      const others = Array.from({ length: 7 }, (_, i) => makeProject(i + 10));
      const projects = [...apiProjects, ...others];

      render(<ProjectsForm projects={projects} />);
      const input = getSearchInput();
      await userEvent.type(input, 'api');

      expect(screen.getByText('3 of 10 projects')).toBeInTheDocument();
    });
  });

  // ─── 2.2 Search by slug ────────────────────────────────────────────────────

  describe('search by slug substring (case-insensitive)', () => {
    it('shows only matching rows when searching by slug', async () => {
      const apiProjects = [
        makeProject(1, { slug: 'api-gateway', name: 'Gateway' }),
        makeProject(2, { slug: 'api-users', name: 'Users' }),
        makeProject(3, { slug: 'api-billing', name: 'Billing' }),
      ];
      const others = Array.from({ length: 7 }, (_, i) => makeProject(i + 10));
      const projects = [...apiProjects, ...others];

      render(<ProjectsForm projects={projects} />);
      const input = getSearchInput();
      await userEvent.type(input, 'api');

      const rows = getDataRows();
      expect(rows).toHaveLength(3);
      expect(screen.getByText('api-gateway')).toBeInTheDocument();
      expect(screen.getByText('api-users')).toBeInTheDocument();
      expect(screen.getByText('api-billing')).toBeInTheDocument();
    });

    it('uppercase search query still matches lowercase slug', async () => {
      const projects = [
        makeProject(1, { slug: 'api-gateway', name: 'Gateway' }),
        makeProject(2, { slug: 'other-service', name: 'Other' }),
      ];

      render(<ProjectsForm projects={projects} />);
      const input = getSearchInput();
      await userEvent.type(input, 'API');

      const rows = getDataRows();
      expect(rows).toHaveLength(1);
    });
  });

  // ─── 2.3 Search by name (case-insensitive) ─────────────────────────────────

  describe('search by name substring (case-insensitive)', () => {
    it('finds a project by lowercase search against a mixed-case name', async () => {
      const projects = [
        makeProject(1, { slug: 'backend', name: 'Backend Service' }),
        makeProject(2, { slug: 'frontend', name: 'Frontend App' }),
      ];

      render(<ProjectsForm projects={projects} />);
      const input = getSearchInput();
      await userEvent.type(input, 'backend');

      const rows = getDataRows();
      expect(rows).toHaveLength(1);
      expect(screen.getByText('Backend Service')).toBeInTheDocument();
    });

    it('case-insensitive: uppercase search finds a mixed-case name', async () => {
      const projects = [
        makeProject(1, { slug: 'backend', name: 'Backend Service' }),
        makeProject(2, { slug: 'frontend', name: 'Frontend App' }),
      ];

      render(<ProjectsForm projects={projects} />);
      const input = getSearchInput();
      await userEvent.type(input, 'BACKEND');

      const rows = getDataRows();
      expect(rows).toHaveLength(1);
    });
  });

  // ─── 2.4 Search resets to page 1 ───────────────────────────────────────────

  describe('search query resets pagination to page 1', () => {
    it('navigating to page 2 then typing resets to page 1', async () => {
      const projects = makeProjects(60);
      render(<ProjectsForm projects={projects} />);

      const nextBtn = screen.getByRole('button', { name: /next/i });
      await userEvent.click(nextBtn);
      expect(screen.getByText(/page 2/i)).toBeInTheDocument();

      const input = getSearchInput();
      await userEvent.type(input, 'p');
      expect(screen.getByText(/page 1/i)).toBeInTheDocument();
    });
  });

  // ─── 2.5 Zero-match empty state ────────────────────────────────────────────

  describe('zero-match search shows empty state', () => {
    it('shows "No projects found" and no data rows when nothing matches', async () => {
      const projects = makeProjects(5);
      render(<ProjectsForm projects={projects} />);

      const input = getSearchInput();
      await userEvent.type(input, 'zzznotfound');

      expect(screen.getByText('No projects found')).toBeInTheDocument();
      expect(getDataRows()).toHaveLength(0);
    });
  });

  // ─── 2.6 Page cap at 50 rows ───────────────────────────────────────────────

  describe('page size is capped at 50 rows', () => {
    it('renders exactly 50 rows on page 1 when 120 projects exist', () => {
      const projects = makeProjects(120);
      render(<ProjectsForm projects={projects} />);

      const rows = getDataRows();
      expect(rows).toHaveLength(50);
    });

    it('shows "Page 1 of 3" label for 120 projects', () => {
      const projects = makeProjects(120);
      render(<ProjectsForm projects={projects} />);
      expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    });
  });

  // ─── 2.7 Prev disabled on page 1 ───────────────────────────────────────────

  describe('Prev button disabled on first page', () => {
    it('Prev is disabled and Next is enabled on page 1 with 60 projects', () => {
      const projects = makeProjects(60);
      render(<ProjectsForm projects={projects} />);

      const prevBtn = screen.getByRole('button', { name: /prev/i });
      const nextBtn = screen.getByRole('button', { name: /next/i });

      expect(prevBtn).toBeDisabled();
      expect(nextBtn).not.toBeDisabled();
    });
  });

  // ─── 2.8 Next disabled on last page ────────────────────────────────────────

  describe('Next button disabled on last page', () => {
    it('Next is disabled after clicking Next with 60 projects (2 pages)', async () => {
      const projects = makeProjects(60);
      render(<ProjectsForm projects={projects} />);

      const nextBtn = screen.getByRole('button', { name: /next/i });
      await userEvent.click(nextBtn);

      expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
      expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
    });
  });

  // ─── 2.9 Advancing to next page ────────────────────────────────────────────

  describe('advancing to the next page', () => {
    it('renders rows 51–60 on page 2 and shows "Page 2 of 2"', async () => {
      const projects = makeProjects(60);
      render(<ProjectsForm projects={projects} />);

      const nextBtn = screen.getByRole('button', { name: /next/i });
      await userEvent.click(nextBtn);

      expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();

      const rows = getDataRows();
      expect(rows).toHaveLength(10); // rows 51–60

      // Verify the last 10 project slugs are rendered
      for (let i = 51; i <= 60; i++) {
        expect(screen.getByText(`project-${i}`)).toBeInTheDocument();
      }
    });
  });

  // ─── 2.10 Pagination hidden for ≤ 50 rows ──────────────────────────────────

  describe('pagination controls hidden when totalPages <= 1', () => {
    it('no Prev/Next buttons when 10 projects (fits on one page)', () => {
      const projects = makeProjects(10);
      render(<ProjectsForm projects={projects} />);

      expect(screen.queryByRole('button', { name: /prev/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /next/i })).not.toBeInTheDocument();
    });

    it('no Prev/Next buttons when exactly 50 projects', () => {
      const projects = makeProjects(50);
      render(<ProjectsForm projects={projects} />);

      expect(screen.queryByRole('button', { name: /prev/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /next/i })).not.toBeInTheDocument();
    });

    it('Prev/Next buttons appear when 51 projects exist', () => {
      const projects = makeProjects(51);
      render(<ProjectsForm projects={projects} />);

      expect(screen.getByRole('button', { name: /prev/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
    });
  });

  // ─── 2.11 Row actions remain functional after search ───────────────────────

  describe('row actions remain functional after search', () => {
    it('the Disable form for "alpha" contains slug="alpha" after filtering', async () => {
      const projects = [
        makeProject(1, { slug: 'alpha', name: 'Alpha', enabled: true }),
        makeProject(2, { slug: 'beta', name: 'Beta', enabled: true }),
        makeProject(3, { slug: 'gamma', name: 'Gamma', enabled: true }),
      ];

      render(<ProjectsForm projects={projects} />);

      const input = getSearchInput();
      await userEvent.type(input, 'alpha');

      // Only one row should be visible after filtering
      const rows = getDataRows();
      expect(rows).toHaveLength(1);

      // The Disable button form should have the correct hidden slug input
      const slugInput = document.querySelector<HTMLInputElement>(
        'input[type="hidden"][name="slug"][value="alpha"]',
      );
      expect(slugInput).toBeInTheDocument();
    });
  });
});
