'use client'

import { useActionState, useState } from 'react'
import type { Project } from '@/lib/db/schema'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  enrollProjectAction,
  disableProjectAction,
  enableProjectAction,
  deleteProjectAction,
} from './actions'

const PAGE_SIZE = 50

interface ProjectsFormProps {
  projects: Project[]
}

const inputStyle: React.CSSProperties = {
  height: '36px',
  padding: '0 0.75rem',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--cl-radius-sm)',
  fontSize: '0.9375rem',
  color: 'var(--text)',
  background: 'var(--bg-subtle)',
  outline: 'none',
  width: '100%',
}

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--cl-radius)',
  padding: '1.25rem 1.5rem',
  boxShadow: 'var(--shadow-sm)',
}

function statusBadge(enabled: boolean) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.125rem 0.5rem',
        borderRadius: '999px',
        fontSize: '0.75rem',
        fontWeight: 600,
        background: enabled ? 'var(--success-soft)' : 'var(--danger-soft)',
        color: enabled ? 'var(--success)' : 'var(--danger)',
      }}
    >
      {enabled ? 'Enabled' : 'Disabled'}
    </span>
  )
}

function EnrollForm() {
  const [state, action, pending] = useActionState(enrollProjectAction, {})

  return (
    <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
      <details>
        <summary
          style={{
            cursor: 'pointer',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: 'var(--cl-primary)',
            listStyle: 'none',
          }}
        >
          <span
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              background: 'color-mix(in srgb, var(--cl-primary) 12%, transparent)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1rem',
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            +
          </span>
          Enroll new project
        </summary>

        <form
          action={action}
          style={{
            marginTop: '1.25rem',
            paddingTop: '1.25rem',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <label
                htmlFor="enroll-slug"
                style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)' }}
              >
                Slug
              </label>
              <input
                id="enroll-slug"
                name="slug"
                type="text"
                placeholder="e.g. my-project"
                required
                style={inputStyle}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <label
                htmlFor="enroll-name"
                style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)' }}
              >
                Name
              </label>
              <input
                id="enroll-name"
                name="name"
                type="text"
                placeholder="e.g. My Project"
                required
                style={inputStyle}
              />
            </div>
          </div>

          {state.error && (
            <p
              style={{
                margin: 0,
                padding: '0.5rem 0.75rem',
                background: 'var(--danger-soft)',
                color: 'var(--danger)',
                borderRadius: 'var(--cl-radius-sm)',
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            >
              {state.error}
            </p>
          )}

          {state.success && (
            <p
              style={{
                margin: 0,
                padding: '0.5rem 0.75rem',
                background: 'var(--success-soft)',
                color: 'var(--success)',
                borderRadius: 'var(--cl-radius-sm)',
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            >
              Project enrolled successfully.
            </p>
          )}

          <div>
            <button
              type="submit"
              disabled={pending}
              style={{
                height: '36px',
                padding: '0 1.25rem',
                background: pending
                  ? 'color-mix(in srgb, var(--cl-primary) 60%, transparent)'
                  : 'var(--cl-primary)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--cl-radius-sm)',
                fontWeight: 600,
                fontSize: '0.9375rem',
                cursor: pending ? 'not-allowed' : 'pointer',
              }}
            >
              {pending ? 'Enrolling…' : 'Enroll Project'}
            </button>
          </div>
        </form>
      </details>
    </div>
  )
}

function ProjectRow({ project }: { project: Project }) {
  const [disableState, disableAction, disablePending] = useActionState(disableProjectAction, {})
  const [enableState, enableAction, enablePending] = useActionState(enableProjectAction, {})
  const [deleteState, deleteAction, deletePending] = useActionState(deleteProjectAction, {})

  const rowError = disableState.error ?? enableState.error ?? deleteState.error

  return (
    <>
      <tr
        style={{
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <td style={{ padding: '0.75rem 1rem', fontSize: '0.9375rem' }}>
          <code
            style={{
              fontFamily: 'monospace',
              fontSize: '0.875rem',
              background: 'var(--bg-subtle)',
              padding: '0.125rem 0.375rem',
              borderRadius: '4px',
              color: 'var(--text)',
            }}
          >
            {project.slug}
          </code>
        </td>
        <td style={{ padding: '0.75rem 1rem', fontSize: '0.9375rem', color: 'var(--text)' }}>
          {project.name}
        </td>
        <td style={{ padding: '0.75rem 1rem' }}>
          {statusBadge(project.enabled)}
        </td>
        <td
          style={{
            padding: '0.75rem 1rem',
            fontSize: '0.875rem',
            color: 'var(--text-muted)',
            whiteSpace: 'nowrap',
          }}
        >
          {new Date(project.createdAt).toLocaleDateString()}
        </td>
        <td style={{ padding: '0.75rem 1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {project.enabled ? (
              <form action={disableAction}>
                <input type="hidden" name="slug" value={project.slug} />
                <button
                  type="submit"
                  disabled={disablePending}
                  style={{
                    padding: '0.25rem 0.625rem',
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    color: 'var(--text-muted)',
                    background: 'var(--bg-subtle)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--cl-radius-sm)',
                    cursor: disablePending ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap',
                    opacity: disablePending ? 0.6 : 1,
                  }}
                >
                  {disablePending ? 'Disabling…' : 'Disable'}
                </button>
              </form>
            ) : (
              <form action={enableAction}>
                <input type="hidden" name="slug" value={project.slug} />
                <button
                  type="submit"
                  disabled={enablePending}
                  style={{
                    padding: '0.25rem 0.625rem',
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    color: 'var(--success)',
                    background: 'var(--success-soft)',
                    border: '1px solid color-mix(in srgb, var(--success) 20%, transparent)',
                    borderRadius: 'var(--cl-radius-sm)',
                    cursor: enablePending ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap',
                    opacity: enablePending ? 0.6 : 1,
                  }}
                >
                  {enablePending ? 'Enabling…' : 'Enable'}
                </button>
              </form>
            )}

            <form action={deleteAction}>
              <input type="hidden" name="slug" value={project.slug} />
              <button
                type="submit"
                disabled={deletePending}
                style={{
                  padding: '0.25rem 0.625rem',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  color: 'var(--danger)',
                  background: 'var(--danger-soft)',
                  border: '1px solid color-mix(in srgb, var(--danger) 20%, transparent)',
                  borderRadius: 'var(--cl-radius-sm)',
                  cursor: deletePending ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                  opacity: deletePending ? 0.6 : 1,
                }}
              >
                {deletePending ? 'Deleting…' : 'Delete'}
              </button>
            </form>
          </div>

          {rowError && (
            <p
              style={{
                margin: '0.375rem 0 0',
                fontSize: '0.8125rem',
                color: 'var(--danger)',
                fontWeight: 500,
              }}
            >
              {rowError}
            </p>
          )}
        </td>
      </tr>
    </>
  )
}

export function ProjectsForm({ projects }: ProjectsFormProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(0)

  const q = searchQuery.trim().toLowerCase()
  const filteredProjects = q
    ? projects.filter(
        (p) => p.slug.toLowerCase().includes(q) || p.name.toLowerCase().includes(q),
      )
    : projects

  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / PAGE_SIZE))
  const visibleProjects = filteredProjects.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE,
  )

  function onSearchChange(value: string) {
    setSearchQuery(value)
    setCurrentPage(0)
  }

  return (
    <div>
      <EnrollForm />

      <div style={{ marginBottom: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <Input
          type="text"
          aria-label="Search projects by slug or name"
          placeholder="Search by slug or name…"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <p
          style={{
            margin: 0,
            fontSize: '0.875rem',
            color: 'var(--text-muted)',
          }}
        >
          {filteredProjects.length} of {projects.length} projects
        </p>
      </div>

      <div
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--cl-radius)',
          boxShadow: 'var(--shadow-sm)',
          overflow: 'hidden',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr
              style={{
                borderBottom: '1px solid var(--border-color)',
                background: 'var(--bg-subtle)',
              }}
            >
              <th
                style={{
                  padding: '0.625rem 1rem',
                  textAlign: 'left',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  letterSpacing: '0.02em',
                }}
              >
                Slug
              </th>
              <th
                style={{
                  padding: '0.625rem 1rem',
                  textAlign: 'left',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  letterSpacing: '0.02em',
                }}
              >
                Name
              </th>
              <th
                style={{
                  padding: '0.625rem 1rem',
                  textAlign: 'left',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  letterSpacing: '0.02em',
                }}
              >
                Status
              </th>
              <th
                style={{
                  padding: '0.625rem 1rem',
                  textAlign: 'left',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  letterSpacing: '0.02em',
                }}
              >
                Enrolled
              </th>
              <th
                style={{
                  padding: '0.625rem 1rem',
                  textAlign: 'left',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  letterSpacing: '0.02em',
                }}
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredProjects.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  style={{
                    textAlign: 'center',
                    padding: '3rem',
                    color: 'var(--text-muted)',
                    fontSize: '0.9375rem',
                  }}
                >
                  No projects found
                </td>
              </tr>
            ) : (
              visibleProjects.map((project) => (
                <ProjectRow key={project.slug} project={project} />
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginTop: '0.75rem',
            justifyContent: 'center',
          }}
        >
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === 0}
            onClick={() => setCurrentPage((p) => p - 1)}
          >
            Prev
          </Button>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Page {currentPage + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === totalPages - 1}
            onClick={() => setCurrentPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
