import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'

vi.mock('./actions', () => ({
  enrollProjectAction: vi.fn(),
  disableProjectAction: vi.fn(),
  enableProjectAction: vi.fn(),
  deleteProjectAction: vi.fn(),
}))

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return {
    ...actual,
    useActionState: vi.fn((_action: unknown, initialState: unknown) => [initialState, vi.fn(), false]),
  }
})

import { ProjectsForm } from './projects-form'
import type { Project } from '@/lib/db/schema'

function makeProject(slug: string, name = slug): Project {
  return {
    slug,
    name,
    enabled: true,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    createdByUserId: null,
    disabledAt: null,
    disabledByUserId: null,
  }
}

describe('ProjectsForm server-side list controls', () => {
  it('renders the server-provided page and preserves search in pagination links', () => {
    render(
      <ProjectsForm
        projects={[makeProject('api-gateway', 'API Gateway')]}
        search="api"
        page={2}
        total={51}
        totalPages={2}
      />,
    )

    expect(screen.getByText('api-gateway')).toBeInTheDocument()
    expect(screen.getByText('51 matching projects')).toBeInTheDocument()
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Prev' })).toHaveAttribute(
      'href',
      '/dashboard/admin/projects?q=api',
    )
    expect(screen.queryByRole('link', { name: 'Next' })).not.toBeInTheDocument()
  })

  it('keeps row action forms for the server-provided projects', () => {
    render(
      <ProjectsForm
        projects={[makeProject('alpha')]}
        search=""
        page={1}
        total={1}
        totalPages={1}
      />,
    )

    expect(document.querySelector('input[type="hidden"][name="slug"][value="alpha"]')).toBeInTheDocument()
    expect(screen.queryByText('No projects found')).not.toBeInTheDocument()
  })
})
