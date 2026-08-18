'use client'

import { useActionState, useState, useCallback } from 'react'
import type { CorporateSkill, CorporateSkillVersion } from '@/lib/db/schema'
import { updateSkillMetadataAction, publishVersionAction } from '../actions'

// ============================================================================
// Types
// ============================================================================

interface SkillDetailViewProps {
  skill: CorporateSkill
  latestVersion: CorporateSkillVersion | null
  versions: CorporateSkillVersion[]
  versionPage: number
  versionTotal: number
  versionTotalPages: number
}

// ============================================================================
// Styles
// ============================================================================

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
  padding: '1.5rem',
  boxShadow: 'var(--shadow-sm)',
  marginBottom: '1.5rem',
}

const cardTitleStyle: React.CSSProperties = {
  margin: '0 0 1.25rem 0',
  fontSize: '1rem',
  fontWeight: 600,
  color: 'var(--text)',
  paddingBottom: '0.75rem',
  borderBottom: '1px solid var(--border-color)',
}

const labelStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  fontWeight: 500,
  color: 'var(--text)',
}

const errorStyle: React.CSSProperties = {
  margin: 0,
  padding: '0.5rem 0.75rem',
  background: 'var(--danger-soft)',
  color: 'var(--danger)',
  borderRadius: 'var(--cl-radius-sm)',
  fontSize: '0.875rem',
  fontWeight: 500,
}

const successStyle: React.CSSProperties = {
  margin: 0,
  padding: '0.5rem 0.75rem',
  background: 'var(--success-soft)',
  color: 'var(--success)',
  borderRadius: 'var(--cl-radius-sm)',
  fontSize: '0.875rem',
  fontWeight: 500,
}

function btnPrimary(pending: boolean): React.CSSProperties {
  return {
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
  }
}

// ============================================================================
// skillTemplate
// ============================================================================

function skillTemplate(slug: string, name: string): string {
  return `---
name: ${slug}
description: "Trigger: ... Apply ${name} workflow automatically."
license: MIT
metadata:
  author: ""
  version: "1.0"
---

## Activation Contract
Describe when the AI should activate this skill.

## Hard Rules
- Rule 1: always do X
- Rule 2: never do Y

## Decision Gates
| Situation | Action |
| --- | --- |
| Case 1 | Action to take |

## Execution Steps
1. Step 1
2. Step 2

## Output Contract
Describe what the AI should return.
`
}

// ============================================================================
// renderMarkdown
// ============================================================================

function renderMarkdown(md: string): string {
  return md
    .replace(/^---\n([\s\S]*?)\n---/m, '<pre class="skill-frontmatter">---\n$1\n---</pre>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^\|(.+)\|$/gm, (_, row: string) => {
      const cells = row.split('|').map((c: string) => `<td>${c.trim()}</td>`).join('')
      return `<tr>${cells}</tr>`
    })
    .replace(/(<tr>.*<\/tr>\n?)+/gm, (match: string) => `<table>${match}</table>`)
    .replace(/<tr><td>-+<\/td>.*?<\/tr>/g, '')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/gm, (match: string) => `<ul>${match}</ul>`)
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(.+)$(?!<)/gm, (line: string) => line.startsWith('<') ? line : line)
}

// ============================================================================
// Section A — MetadataSection
// ============================================================================

function MetadataSection({ skill }: { skill: CorporateSkill }) {
  const [state, action, pending] = useActionState(updateSkillMetadataAction, {})

  return (
    <div style={cardStyle}>
      <h2 style={cardTitleStyle}>Metadata</h2>
      <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <input type="hidden" name="skillId" value={skill.id} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <label htmlFor="meta-name" style={labelStyle}>
              Name
            </label>
            <input
              id="meta-name"
              name="name"
              type="text"
              defaultValue={skill.name}
              required
              style={inputStyle}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <label style={labelStyle}>Slug</label>
            <div
              style={{
                height: '36px',
                padding: '0 0.75rem',
                display: 'flex',
                alignItems: 'center',
                fontSize: '0.875rem',
                fontFamily: 'monospace',
                color: 'var(--text-muted)',
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--cl-radius-sm)',
              }}
            >
              {skill.slug}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          <label htmlFor="meta-description" style={labelStyle}>
            Description
          </label>
          <textarea
            id="meta-description"
            name="description"
            defaultValue={skill.description ?? ''}
            placeholder="Optional description…"
            style={{
              padding: '0.5rem 0.75rem',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--cl-radius-sm)',
              fontSize: '0.875rem',
              color: 'var(--text)',
              background: 'var(--bg-subtle)',
              outline: 'none',
              width: '100%',
              minHeight: '60px',
              resize: 'vertical',
            }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <label htmlFor="meta-tool" style={labelStyle}>
              Tool
            </label>
            <select id="meta-tool" name="tool" defaultValue={skill.tool ?? ''} style={inputStyle}>
              <option value="">Any</option>
              <option value="kiro">Kiro</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '1.5rem' }}>
            <input
              id="meta-failClosed"
              name="failClosed"
              type="checkbox"
              value="on"
              defaultChecked={skill.failClosed}
            />
            <label htmlFor="meta-failClosed" style={labelStyle}>
              Fail Closed
            </label>
          </div>
        </div>

        {state.error && <p style={errorStyle}>{state.error}</p>}
        {state.success && <p style={successStyle}>Metadata updated.</p>}

        <div>
          <button type="submit" disabled={pending} style={btnPrimary(pending)}>
            {pending ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ============================================================================
// Section B — PublishVersionSection
// ============================================================================

function PublishVersionSection({
  skill,
  latestVersion,
}: {
  skill: CorporateSkill
  latestVersion: CorporateSkillVersion | null
}) {
  const [state, action, pending] = useActionState(publishVersionAction, {})
  const nextVersionNumber = latestVersion ? latestVersion.version + 1 : 1
  const [content, setContent] = useState(() =>
    latestVersion ? latestVersion.content : skillTemplate(skill.slug, skill.name),
  )
  const [activePanel, setActivePanel] = useState<'editor' | 'preview'>('editor')

  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value)
  }, [])

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
        <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>
          Publish New Version
        </h2>
        <span
          style={{
            padding: '0.125rem 0.5rem',
            borderRadius: '999px',
            fontSize: '0.75rem',
            fontWeight: 600,
            background: 'color-mix(in srgb, var(--cl-primary) 10%, transparent)',
            color: 'var(--cl-primary)',
          }}
        >
          Publishing v{nextVersionNumber}
        </span>
      </div>

      <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <input type="hidden" name="skillId" value={skill.id} />

        <div
          role="tablist"
          aria-label="Skill content view"
          style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid var(--border-color)' }}
        >
          {(['editor', 'preview'] as const).map((panel) => (
            <button
              key={panel}
              type="button"
              role="tab"
              aria-selected={activePanel === panel}
              onClick={() => setActivePanel(panel)}
              style={{
                padding: '0.5rem 0.75rem',
                border: 'none',
                borderBottom: activePanel === panel ? '2px solid var(--cl-primary)' : '2px solid transparent',
                color: activePanel === panel ? 'var(--cl-primary)' : 'var(--text-muted)',
                background: 'transparent',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {panel === 'editor' ? 'Editor' : 'Preview'}
            </button>
          ))}
        </div>

        <div style={{ minWidth: 0 }}>
          <div
            role="tabpanel"
            aria-label="Editor"
            hidden={activePanel !== 'editor'}
            style={{ flexDirection: 'column', gap: '0.375rem' }}
          >
            <textarea
              name="content"
              required
              value={content}
              onChange={handleContentChange}
              spellCheck={false}
              style={{
                padding: '0.75rem',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--cl-radius-sm)',
                fontSize: '0.8125rem',
                color: 'var(--text)',
                background: 'var(--bg-subtle)',
                outline: 'none',
                width: '100%',
                minHeight: '500px',
                resize: 'vertical',
                fontFamily: 'monospace',
                lineHeight: 1.6,
              }}
            />
          </div>
          <div
            role="tabpanel"
            aria-label="Preview"
            hidden={activePanel !== 'preview'}
            style={{ minWidth: 0 }}
          >
            <div
              style={{
                minHeight: '500px',
                padding: '0.75rem 1rem',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--cl-radius-sm)',
                background: 'var(--bg)',
                fontSize: '0.875rem',
                lineHeight: 1.7,
                overflowY: 'auto',
                color: 'var(--text)',
              }}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
            />
          </div>
        </div>

        {state.error && <p style={errorStyle}>{state.error}</p>}
        {state.success && <p style={successStyle}>Version published successfully.</p>}

        <div>
          <button type="submit" disabled={pending} style={btnPrimary(pending)}>
            {pending ? 'Publishing…' : `Publish v${nextVersionNumber}`}
          </button>
        </div>
      </form>
    </div>
  )
}

// ============================================================================
// Section C — VersionHistorySection
// ============================================================================

function VersionHistorySection({
  skillSlug,
  versions,
  page,
  total,
  totalPages,
}: {
  skillSlug: string
  versions: CorporateSkillVersion[]
  page: number
  total: number
  totalPages: number
}) {
  function versionListHref(nextPage: number) {
    return `/dashboard/admin/skills/${skillSlug}?page=${nextPage}`
  }

  return (
    <div style={cardStyle}>
      <h2 style={cardTitleStyle}>Version History</h2>
      {versions.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem', margin: 0 }}>
          No versions published yet.
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-subtle)' }}>
                {(['Version', 'Published At', 'SHA-256', 'Published By'] as const).map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '0.5rem 0.75rem',
                      textAlign: 'left',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      letterSpacing: '0.02em',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => (
                <tr key={v.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.625rem 0.75rem', fontSize: '0.875rem' }}>
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
                      v{v.version}
                    </span>
                  </td>
                  <td style={{ padding: '0.625rem 0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    {v.publishedAt.toLocaleString()}
                  </td>
                  <td style={{ padding: '0.625rem 0.75rem', fontSize: '0.8125rem' }}>
                    <code
                      style={{
                        fontFamily: 'monospace',
                        background: 'var(--bg-subtle)',
                        padding: '0.125rem 0.375rem',
                        borderRadius: '4px',
                        color: 'var(--text)',
                      }}
                    >
                      {v.contentHash.slice(0, 8)}
                    </code>
                  </td>
                  <td style={{ padding: '0.625rem 0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    {v.publishedByUserId ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
        <span>{total} version{total === 1 ? '' : 's'} · Page {page} of {totalPages}</span>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {page > 1 && <a href={versionListHref(page - 1)} style={{ color: 'var(--cl-primary)', textDecoration: 'none' }}>Previous</a>}
          {page < totalPages && <a href={versionListHref(page + 1)} style={{ color: 'var(--cl-primary)', textDecoration: 'none' }}>Next</a>}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// SkillDetailView (main export)
// ============================================================================

export function SkillDetailView({
  skill,
  latestVersion,
  versions,
  versionPage,
  versionTotal,
  versionTotalPages,
}: SkillDetailViewProps) {
  return (
    <div>
      <MetadataSection skill={skill} />
      <PublishVersionSection skill={skill} latestVersion={latestVersion} />
      <VersionHistorySection
        skillSlug={skill.slug}
        versions={versions}
        page={versionPage}
        total={versionTotal}
        totalPages={versionTotalPages}
      />
    </div>
  )
}
