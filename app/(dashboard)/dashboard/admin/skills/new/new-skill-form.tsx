'use client'

import { useActionState, useState, useCallback } from 'react'
import { createSkillWithVersionAction } from '../actions'

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
    // frontmatter block → styled code
    .replace(/^---\n([\s\S]*?)\n---/m, '<pre class="skill-frontmatter">---\n$1\n---</pre>')
    // headings
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // table rows (simple: | col | col |)
    .replace(/^\|(.+)\|$/gm, (_, row: string) => {
      const cells = row.split('|').map((c: string) => `<td>${c.trim()}</td>`).join('')
      return `<tr>${cells}</tr>`
    })
    .replace(/(<tr>.*<\/tr>\n?)+/gm, (match: string) => `<table>${match}</table>`)
    // separator rows (| --- |)
    .replace(/<tr><td>-+<\/td>.*?<\/tr>/g, '')
    // unordered list
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/gm, (match: string) => `<ul>${match}</ul>`)
    // ordered list
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // paragraphs (double newline)
    .replace(/\n\n/g, '</p><p>')
    // wrap in p
    .replace(/^(.+)$(?!<)/gm, (line: string) => line.startsWith('<') ? line : line)
}

// ============================================================================
// slugify helper
// ============================================================================

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}

// ============================================================================
// NewSkillForm
// ============================================================================

export function NewSkillForm() {
  const [state, action, pending] = useActionState(createSkillWithVersionAction, {})
  const [slug, setSlug] = useState('')
  const [name, setName] = useState('')
  const [content, setContent] = useState(() => skillTemplate('', ''))

  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setName(val)
    const auto = slugify(val)
    setSlug(auto)
    setContent(skillTemplate(auto, val))
  }, [])

  const handleSlugChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = slugify(e.target.value)
    setSlug(val)
    setContent(skillTemplate(val, name))
  }, [name])

  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value)
  }, [])

  return (
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Metadata card */}
      <div style={cardStyle}>
        <h2 style={{ margin: '0 0 1.25rem 0', fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>
          Skill Metadata
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <label htmlFor="new-name" style={labelStyle}>
                Name
              </label>
              <input
                id="new-name"
                name="name"
                type="text"
                placeholder="e.g. SDD Apply"
                required
                value={name}
                onChange={handleNameChange}
                style={inputStyle}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <label htmlFor="new-slug" style={labelStyle}>
                Slug
              </label>
              <input
                id="new-slug"
                name="slug"
                type="text"
                placeholder="e.g. sdd-apply"
                required
                value={slug}
                onChange={handleSlugChange}
                style={{ ...inputStyle, fontFamily: 'monospace' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <label htmlFor="new-description" style={labelStyle}>
              Description
            </label>
            <textarea
              id="new-description"
              name="description"
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
              <label htmlFor="new-tool" style={labelStyle}>
                Tool
              </label>
              <select id="new-tool" name="tool" style={inputStyle}>
                <option value="">Any</option>
                <option value="kiro">Kiro</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '1.5rem' }}>
              <input id="new-failClosed" name="failClosed" type="checkbox" value="on" />
              <label htmlFor="new-failClosed" style={labelStyle}>
                Fail Closed
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Version content card */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>
            Initial Version Content
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
            v1
          </span>
        </div>

        {/* Split-pane editor */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <span style={{ ...labelStyle, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Editor
            </span>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <span style={{ ...labelStyle, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Preview
            </span>
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
      </div>

      {state.error && <p style={errorStyle}>{state.error}</p>}

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <button type="submit" disabled={pending} style={btnPrimary(pending)}>
          {pending ? 'Creating…' : 'Create Skill'}
        </button>
      </div>
    </form>
  )
}
