import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect } from 'vitest'

vi.mock('./actions', () => ({
  enrollProjectAction: vi.fn(),
  disableProjectAction: vi.fn(),
  enableProjectAction: vi.fn(),
  deleteProjectAction: vi.fn(),
  updateProjectPolicyAction: vi.fn(),
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
    config: {},
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
        skills={[]}
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
        skills={[]}
        search=""
        page={1}
        total={1}
        totalPages={1}
      />,
    )

    expect(document.querySelector('input[type="hidden"][name="slug"][value="alpha"]')).toBeInTheDocument()
    expect(screen.queryByText('No projects found')).not.toBeInTheDocument()
  })

  it('opens a project policy aside and filters skills locally', async () => {
    const user = userEvent.setup()

    render(
      <ProjectsForm
        projects={[makeProject('alpha', 'Alpha Project')]}
        skills={[
          { slug: 'api-review', name: 'API review' },
          { slug: 'release-notes', name: 'Release notes' },
        ]}
        search=""
        page={1}
        total={1}
        totalPages={1}
      />,
    )

    expect(screen.queryByRole('heading', { name: 'Alpha Project' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Skills policy' }))

    expect(screen.getByRole('heading', { name: 'Alpha Project' })).toBeInTheDocument()
    expect(screen.getByText('Showing 2 of 2 skills')).toBeInTheDocument()

    await user.type(screen.getByRole('searchbox', { name: 'Filter skills by slug or name' }), 'release')

    expect(screen.getByText('release-notes')).toBeInTheDocument()
    expect(screen.queryByText('api-review')).not.toBeInTheDocument()
    expect(screen.getByText('Showing 1 of 2 skills')).toBeInTheDocument()
  })

  it('controls skill switches and disables or enables the full policy scope', async () => {
    const user = userEvent.setup()
    const project = makeProject('alpha')
    project.config = { skills: { disabled: ['api-review'] } }

    render(
      <ProjectsForm
        projects={[project]}
        skills={[
          { slug: 'api-review', name: 'API review' },
          { slug: 'release-notes', name: 'Release notes' },
        ]}
        search=""
        page={1}
        total={1}
        totalPages={1}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Skills policy' }))
    const selectAll = screen.getByRole('checkbox', { name: 'Disable all skills' })
    const switches = screen.getAllByRole('switch')

    expect((switches[0] as HTMLInputElement).checked).toBe(true)
    expect((selectAll as HTMLInputElement).indeterminate).toBe(true)

    await user.click(selectAll)
    expect(switches.every((switchControl) => (switchControl as HTMLInputElement).checked)).toBe(true)

    await user.click(selectAll)
    expect(switches.every((switchControl) => !(switchControl as HTMLInputElement).checked)).toBe(true)
  })
})
