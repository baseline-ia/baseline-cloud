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

export function SkillsForm({ initialSkills }: SkillsFormProps) {
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
    </div>
  )
}
