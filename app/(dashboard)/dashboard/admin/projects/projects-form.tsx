'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import type { Project } from '@/lib/db/schema'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  enrollProjectAction,
  disableProjectAction,
  enableProjectAction,
  deleteProjectAction,
  updateProjectPolicyAction,
} from './actions'

type SkillSummary = { slug: string; name: string }

interface ProjectsFormProps {
  projects: Project[]
  skills: SkillSummary[]
  search: string
  page: number
  total: number
  totalPages: number
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

function SkillPolicyForm({
  projectSlug,
  disabledSlugs,
  skills,
}: {
  projectSlug: string
  disabledSlugs: string[]
  skills: SkillSummary[]
}) {
  const [state, action, pending] = useActionState(updateProjectPolicyAction, {})
  const [draftDisabled, setDraftDisabled] = useState(() => new Set(disabledSlugs))
  const [skillSearch, setSkillSearch] = useState('')
  const selectAllRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDraftDisabled(new Set(disabledSlugs))
    setSkillSearch('')
  }, [projectSlug, disabledSlugs.join('\0')])

  const normalizedSearch = skillSearch.trim().toLowerCase()
  const visibleSkills = skills.filter(
    (skill) =>
      !normalizedSearch ||
      skill.slug.toLowerCase().includes(normalizedSearch) ||
      skill.name.toLowerCase().includes(normalizedSearch),
  )
  const visibleSkillSlugs = new Set(visibleSkills.map((skill) => skill.slug))
  const disabledCount = skills.filter((skill) => draftDisabled.has(skill.slug)).length
  const allDisabled = skills.length > 0 && disabledCount === skills.length
  const partiallyDisabled = disabledCount > 0 && !allDisabled

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = partiallyDisabled
  }, [partiallyDisabled])

  function toggleSkill(slug: string) {
    setDraftDisabled((current) => {
      const next = new Set(current)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return next
    })
  }

  function toggleAllSkills() {
    setDraftDisabled(allDisabled ? new Set() : new Set(skills.map((skill) => skill.slug)))
  }

  return (
    <form action={action}>
      <input type="hidden" name="slug" value={projectSlug} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {skills.length === 0 ? (
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            No skills configured yet.
          </p>
        ) : (
          <>
            <input
              type="search"
              value={skillSearch}
              onChange={(event) => setSkillSearch(event.target.value)}
              placeholder="Filter by slug or name…"
              aria-label="Filter skills by slug or name"
              style={inputStyle}
            />
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.625rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <input
                ref={selectAllRef}
                type="checkbox"
                checked={allDisabled}
                onChange={toggleAllSkills}
                aria-label="Disable all skills"
              />
              Disable all
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 400 }}>
                {disabledCount} of {skills.length} disabled
              </span>
            </label>
            <p style={{ margin: '-0.5rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Showing {visibleSkills.length} of {skills.length} skills
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {visibleSkills.length === 0 ? (
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  No skills match this filter.
                </p>
              ) : (
                visibleSkills.map((skill) => {
                  const isDisabled = draftDisabled.has(skill.slug)
                  return (
                    <div
                      key={skill.slug}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                        padding: '0.625rem 0.75rem',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--cl-radius-sm)',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ minWidth: 0 }}>
                        <code
                          style={{
                            fontSize: '0.8125rem',
                            background: 'var(--bg-subtle)',
                            padding: '0.1rem 0.3rem',
                            borderRadius: '3px',
                          }}
                        >
                          {skill.slug}
                        </code>{' '}
                        <span style={{ color: 'var(--text-muted)' }}>{skill.name}</span>
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', flexShrink: 0 }}>
                        <Switch
                          checked={isDisabled}
                          onCheckedChange={() => toggleSkill(skill.slug)}
                          aria-label={`Disable ${skill.name}`}
                        />
                        {isDisabled && <input type="hidden" name="disabled_skill" value={skill.slug} />}
                        <span style={{ color: isDisabled ? 'var(--danger)' : 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>
                          {isDisabled ? 'Disabled' : 'Enabled'}
                        </span>
                      </span>
                    </div>
                  )
                })
              )}
            </div>
            {[...draftDisabled]
              .filter((slug) => !visibleSkillSlugs.has(slug))
              .map((slug) => <input key={slug} type="hidden" name="disabled_skill" value={slug} />)}
          </>
        )}
      </div>

      {state.error && (
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.8125rem', color: 'var(--danger)', fontWeight: 500 }}>
          {state.error}
        </p>
      )}
      {state.success && (
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.8125rem', color: 'var(--success)', fontWeight: 500 }}>
          Policy saved.
        </p>
      )}

      {skills.length > 0 && (
        <button
          type="submit"
          disabled={pending}
          style={{
            marginTop: '0.75rem',
            height: '30px',
            padding: '0 1rem',
            background: pending
              ? 'color-mix(in srgb, var(--cl-primary) 60%, transparent)'
              : 'var(--cl-primary)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--cl-radius-sm)',
            fontWeight: 600,
            fontSize: '0.8125rem',
            cursor: pending ? 'not-allowed' : 'pointer',
          }}
        >
          {pending ? 'Saving…' : 'Save Policy'}
        </button>
      )}
    </form>
  )
}

function SkillPolicyAside({ project, skills, onClose }: { project: Project; skills: SkillSummary[]; onClose: () => void }) {
  const disabledSlugs = (project.config as { skills?: { disabled?: string[] } })?.skills?.disabled ?? []

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <>
      <button
        type="button"
        aria-label="Close skills policy"
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 20, border: 0, background: 'rgba(15, 23, 42, 0.35)', cursor: 'default' }}
      />
      <aside
        aria-labelledby="skills-policy-title"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 21,
          width: 'min(100%, 30rem)',
          maxWidth: '100vw',
          overflowY: 'auto',
          padding: '1.5rem',
          background: 'var(--bg-elevated)',
          borderLeft: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-lg, -8px 0 24px rgba(15, 23, 42, 0.12))',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Project policy
            </p>
            <h2 id="skills-policy-title" style={{ margin: '0.25rem 0 0', fontSize: '1.25rem', color: 'var(--text)' }}>
              {project.name}
            </h2>
            <code style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{project.slug}</code>
          </div>
          <button type="button" onClick={onClose} aria-label="Close skills policy" style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--cl-radius-sm)', background: 'var(--bg-subtle)', color: 'var(--text)', fontSize: '1.25rem', lineHeight: 1, width: '32px', height: '32px', cursor: 'pointer' }}>
            ×
          </button>
        </div>
        <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--bg-subtle)', borderRadius: 'var(--cl-radius-sm)', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          <strong style={{ color: 'var(--text)' }}>{disabledSlugs.length}</strong> of {skills.length} skills disabled
        </div>
        <SkillPolicyForm key={project.slug} projectSlug={project.slug} disabledSlugs={disabledSlugs} skills={skills} />
      </aside>
    </>
  )
}

function ProjectRow({ project, skills, onOpenPolicy }: { project: Project; skills: SkillSummary[]; onOpenPolicy: (projectSlug: string) => void }) {
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => onOpenPolicy(project.slug)}
                style={{ padding: '0.25rem 0.625rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--cl-primary)', background: 'color-mix(in srgb, var(--cl-primary) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--cl-primary) 22%, transparent)', borderRadius: 'var(--cl-radius-sm)', cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                Skills policy
              </button>
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

export function ProjectsForm({ projects, skills, search, page, total, totalPages }: ProjectsFormProps) {
  const [selectedProjectSlug, setSelectedProjectSlug] = useState<string | null>(null)
  function projectListHref(nextPage: number) {
    const params = new URLSearchParams()
    if (search) params.set('q', search)
    if (nextPage > 1) params.set('page', String(nextPage))
    const query = params.toString()
    return `/dashboard/admin/projects${query ? `?${query}` : ''}`
  }

  return (
    <div>
      <EnrollForm />

      <div style={{ marginBottom: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <form method="get" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <Input
            type="search"
            name="q"
            aria-label="Search projects by slug or name"
            placeholder="Search by slug or name…"
            defaultValue={search}
          />
          <input type="hidden" name="page" value="1" />
          <button type="submit" style={{ height: '36px', padding: '0 1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--cl-radius-sm)', background: 'var(--bg-subtle)', color: 'var(--text)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Search
          </button>
        </form>
        <p
          style={{
            margin: 0,
            fontSize: '0.875rem',
            color: 'var(--text-muted)',
          }}
        >
          {search ? `${total} matching projects` : `${total} projects`}
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
            {projects.length === 0 ? (
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
              projects.map((project) => (
                <ProjectRow key={project.slug} project={project} skills={skills} onOpenPolicy={setSelectedProjectSlug} />
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedProjectSlug && (() => {
        const selectedProject = projects.find((project) => project.slug === selectedProjectSlug)
        return selectedProject ? (
          <SkillPolicyAside
            key={selectedProject.slug}
            project={selectedProject}
            skills={skills}
            onClose={() => setSelectedProjectSlug(null)}
          />
        ) : null
      })()}

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
            {page > 1 && <a href={projectListHref(page - 1)} style={{ color: 'var(--cl-primary)', textDecoration: 'none' }}>Prev</a>}
            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Page {page} of {totalPages}
            </span>
            {page < totalPages && <a href={projectListHref(page + 1)} style={{ color: 'var(--cl-primary)', textDecoration: 'none' }}>Next</a>}
        </div>
      )}
    </div>
  )
}
