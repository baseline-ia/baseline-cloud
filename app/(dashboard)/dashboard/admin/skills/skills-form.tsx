'use client'

import Link from 'next/link'
import type { CorporateSkill } from '@/lib/db/schema'

// ============================================================================
// Types
// ============================================================================

export interface SkillWithLatestVersion extends CorporateSkill {
  latestVersion: number | null
}

interface SkillsFormProps {
  initialSkills: SkillWithLatestVersion[]
  search: string
  page: number
  total: number
  totalPages: number
}

// ============================================================================
// SkillRow
// ============================================================================

function SkillRow({ skill }: { skill: SkillWithLatestVersion }) {
  return (
    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
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
          {skill.slug}
        </code>
      </td>
      <td style={{ padding: '0.75rem 1rem', fontSize: '0.9375rem', color: 'var(--text)' }}>
        {skill.name}
      </td>
      <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>
        {skill.latestVersion != null ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0.125rem 0.5rem',
              borderRadius: '999px',
              fontSize: '0.75rem',
              fontWeight: 600,
              background: 'color-mix(in srgb, var(--cl-primary) 10%, transparent)',
              color: 'var(--cl-primary)',
            }}
          >
            v{skill.latestVersion}
          </span>
        ) : (
          <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.875rem' }}>
            No versions
          </span>
        )}
      </td>
      <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>
        {skill.tool ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0.125rem 0.5rem',
              borderRadius: '999px',
              fontSize: '0.75rem',
              fontWeight: 600,
              background: 'var(--bg-subtle)',
              color: 'var(--text-muted)',
              border: '1px solid var(--border-color)',
            }}
          >
            {skill.tool}
          </span>
        ) : (
          <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>—</span>
        )}
      </td>
      <td style={{ padding: '0.75rem 1rem' }}>
        <Link
          href={`/dashboard/admin/skills/${skill.slug}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            padding: '0.25rem 0.75rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            color: 'var(--cl-primary)',
            background: 'color-mix(in srgb, var(--cl-primary) 8%, transparent)',
            border: '1px solid color-mix(in srgb, var(--cl-primary) 20%, transparent)',
            borderRadius: 'var(--cl-radius-sm)',
            textDecoration: 'none',
          }}
        >
          Manage →
        </Link>
      </td>
    </tr>
  )
}

// ============================================================================
// SkillsForm (main export)
// ============================================================================

export function SkillsForm({ initialSkills, search, page, total, totalPages }: SkillsFormProps) {
  function skillListHref(nextPage: number) {
    const params = new URLSearchParams()
    if (search) params.set('q', search)
    if (nextPage > 1) params.set('page', String(nextPage))
    const query = params.toString()
    return `/dashboard/admin/skills${query ? `?${query}` : ''}`
  }

  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--cl-radius)',
        boxShadow: 'var(--shadow-sm)',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '1.25rem 1.5rem 0' }}>
        <form method="get" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', paddingBottom: '1rem' }}>
          <label htmlFor="skill-search" style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)' }}>
            Search
          </label>
          <input
            id="skill-search"
            name="q"
            type="search"
            defaultValue={search}
            placeholder="Slug, name, description, or tool"
            aria-label="Search skills"
            style={{ height: '36px', padding: '0 0.75rem', border: '1px solid var(--border-color)', borderRadius: 'var(--cl-radius-sm)', fontSize: '0.9375rem', color: 'var(--text)', background: 'var(--bg-subtle)', width: 'min(100%, 360px)' }}
          />
          <input type="hidden" name="page" value="1" />
          <button type="submit" style={{ height: '36px', padding: '0 1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--cl-radius-sm)', background: 'var(--bg-subtle)', color: 'var(--text)', fontWeight: 600, cursor: 'pointer' }}>
            Search
          </button>
        </form>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr
            style={{
              borderBottom: '1px solid var(--border-color)',
              background: 'var(--bg-subtle)',
            }}
          >
            {(['Slug', 'Name', 'Latest Version', 'Tool', 'Actions'] as const).map((header) => (
              <th
                key={header}
                style={{
                  padding: '0.625rem 1rem',
                  textAlign: 'left',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  letterSpacing: '0.02em',
                }}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {initialSkills.length === 0 ? (
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
                No skills yet. Click &ldquo;New Skill&rdquo; to create one.
              </td>
            </tr>
          ) : (
            initialSkills.map((skill) => <SkillRow key={skill.id} skill={skill} />)
          )}
        </tbody>
      </table>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
        <span>{search ? `${total} matching skills` : `${total} skills`} · Page {page} of {totalPages}</span>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {page > 1 && <a href={skillListHref(page - 1)} style={{ color: 'var(--cl-primary)', textDecoration: 'none' }}>Previous</a>}
          {page < totalPages && <a href={skillListHref(page + 1)} style={{ color: 'var(--cl-primary)', textDecoration: 'none' }}>Next</a>}
        </div>
      </div>
    </div>
  )
}
