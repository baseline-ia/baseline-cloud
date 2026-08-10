'use client'

import { useActionState } from 'react'
import type { CorporateSkill } from '@/lib/db/schema'
import {
  createSkillAction,
  publishVersionAction,
  assignToProjectAction,
  unassignAction,
} from './actions'

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
// Styles (matches admin/projects pattern)
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

const textareaStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--cl-radius-sm)',
  fontSize: '0.875rem',
  color: 'var(--text)',
  background: 'var(--bg-subtle)',
  outline: 'none',
  width: '100%',
  minHeight: '120px',
  resize: 'vertical',
  fontFamily: 'monospace',
}

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--cl-radius)',
  padding: '1.25rem 1.5rem',
  boxShadow: 'var(--shadow-sm)',
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

function btnDanger(pending: boolean): React.CSSProperties {
  return {
    padding: '0.25rem 0.625rem',
    fontSize: '0.8125rem',
    fontWeight: 500,
    color: 'var(--danger)',
    background: 'var(--danger-soft)',
    border: '1px solid color-mix(in srgb, var(--danger) 20%, transparent)',
    borderRadius: 'var(--cl-radius-sm)',
    cursor: pending ? 'not-allowed' : 'pointer',
    opacity: pending ? 0.6 : 1,
    whiteSpace: 'nowrap' as const,
  }
}

// ============================================================================
// CreateSkillForm
// ============================================================================

function CreateSkillForm() {
  const [state, action, pending] = useActionState(createSkillAction, {})

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
          Create new skill
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <label htmlFor="create-slug" style={labelStyle}>
                Slug
              </label>
              <input
                id="create-slug"
                name="slug"
                type="text"
                placeholder="e.g. sdd-apply"
                required
                style={inputStyle}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <label htmlFor="create-name" style={labelStyle}>
                Name
              </label>
              <input
                id="create-name"
                name="name"
                type="text"
                placeholder="e.g. SDD Apply"
                required
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <label htmlFor="create-description" style={labelStyle}>
              Description
            </label>
            <textarea
              id="create-description"
              name="description"
              placeholder="Optional description…"
              style={{ ...textareaStyle, minHeight: '60px' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <label htmlFor="create-tool" style={labelStyle}>
                Tool
              </label>
              <select id="create-tool" name="tool" style={inputStyle}>
                <option value="">None</option>
                <option value="claude">Claude</option>
                <option value="opencode">OpenCode</option>
                <option value="kiro">Kiro</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '1.5rem' }}>
              <input id="create-failClosed" name="failClosed" type="checkbox" value="on" />
              <label htmlFor="create-failClosed" style={labelStyle}>
                Fail Closed
              </label>
            </div>
          </div>

          {state.error && <p style={errorStyle}>{state.error}</p>}
          {state.success && <p style={successStyle}>Skill created successfully.</p>}

          <div>
            <button type="submit" disabled={pending} style={btnPrimary(pending)}>
              {pending ? 'Creating…' : 'Create Skill'}
            </button>
          </div>
        </form>
      </details>
    </div>
  )
}

// ============================================================================
// PublishVersionPanel
// ============================================================================

function PublishVersionPanel({ skill }: { skill: SkillWithLatestVersion }) {
  const [state, action, pending] = useActionState(publishVersionAction, {})

  return (
    <details style={{ marginTop: '0.75rem' }}>
      <summary
        style={{
          cursor: 'pointer',
          fontSize: '0.875rem',
          fontWeight: 600,
          color: 'var(--cl-primary)',
          listStyle: 'none',
        }}
      >
        Publish Version
      </summary>
      <form
        action={action}
        style={{
          marginTop: '0.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}
      >
        <input type="hidden" name="skillId" value={skill.id} />
        <textarea
          name="content"
          placeholder="Paste SKILL.md content here…"
          required
          style={textareaStyle}
        />
        {state.error && <p style={errorStyle}>{state.error}</p>}
        {state.success && <p style={successStyle}>Version published.</p>}
        <div>
          <button type="submit" disabled={pending} style={btnPrimary(pending)}>
            {pending ? 'Publishing…' : 'Publish'}
          </button>
        </div>
      </form>
    </details>
  )
}

// ============================================================================
// ManageAssignmentsPanel
// ============================================================================

function ManageAssignmentsPanel({ skill }: { skill: SkillWithLatestVersion }) {
  const [assignState, doAssign, assignPending] = useActionState(assignToProjectAction, {})
  const [unassignState, doUnassign, unassignPending] = useActionState(unassignAction, {})

  return (
    <details style={{ marginTop: '0.75rem' }}>
      <summary
        style={{
          cursor: 'pointer',
          fontSize: '0.875rem',
          fontWeight: 600,
          color: 'var(--text)',
          listStyle: 'none',
        }}
      >
        Manage Assignments
      </summary>
      <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {/* Assign form */}
        <form
          action={doAssign}
          style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
        >
          <input type="hidden" name="skillId" value={skill.id} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.5rem', alignItems: 'end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={{ ...labelStyle, fontSize: '0.8125rem' }}>Project Slug</label>
              <input
                name="projectSlug"
                type="text"
                placeholder="my-project"
                required
                style={{ ...inputStyle, height: '32px', fontSize: '0.875rem' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={{ ...labelStyle, fontSize: '0.8125rem' }}>Version (empty = latest)</label>
              <input
                name="versionId"
                type="text"
                placeholder="Leave empty for latest"
                style={{ ...inputStyle, height: '32px', fontSize: '0.875rem' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', paddingBottom: '2px' }}>
              <input name="failClosed" type="checkbox" value="on" id={`fc-${skill.id}`} />
              <label htmlFor={`fc-${skill.id}`} style={{ ...labelStyle, fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                Fail Closed
              </label>
            </div>
          </div>
          {assignState.error && <p style={errorStyle}>{assignState.error}</p>}
          {assignState.success && <p style={successStyle}>Assigned.</p>}
          <div>
            <button type="submit" disabled={assignPending} style={btnPrimary(assignPending)}>
              {assignPending ? 'Assigning…' : 'Assign to Project'}
            </button>
          </div>
        </form>

        {/* Unassign form */}
        <form
          action={doUnassign}
          style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
        >
          <input type="hidden" name="skillId" value={skill.id} />
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
              <label style={{ ...labelStyle, fontSize: '0.8125rem' }}>Unassign from Project Slug</label>
              <input
                name="projectSlug"
                type="text"
                placeholder="my-project"
                required
                style={{ ...inputStyle, height: '32px', fontSize: '0.875rem' }}
              />
            </div>
            <button type="submit" disabled={unassignPending} style={btnDanger(unassignPending)}>
              {unassignPending ? 'Unassigning…' : 'Unassign'}
            </button>
          </div>
          {unassignState.error && <p style={errorStyle}>{unassignState.error}</p>}
          {unassignState.success && <p style={successStyle}>Unassigned.</p>}
        </form>
      </div>
    </details>
  )
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
      <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
        {skill.latestVersion != null ? `v${skill.latestVersion}` : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No versions</span>}
      </td>
      <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
        {skill.tool ?? '—'}
      </td>
      <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '0.125rem 0.5rem',
            borderRadius: '999px',
            fontSize: '0.75rem',
            fontWeight: 600,
            background: skill.failClosed ? 'var(--danger-soft)' : 'var(--bg-subtle)',
            color: skill.failClosed ? 'var(--danger)' : 'var(--text-muted)',
          }}
        >
          {skill.failClosed ? 'Yes' : 'No'}
        </span>
      </td>
      <td style={{ padding: '0.75rem 1rem' }}>
        <PublishVersionPanel skill={skill} />
        <ManageAssignmentsPanel skill={skill} />
      </td>
    </tr>
  )
}

// ============================================================================
// SkillsForm (main export)
// ============================================================================

export function SkillsForm({ initialSkills }: SkillsFormProps) {
  return (
    <div>
      <CreateSkillForm />

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
              {(['Slug', 'Name', 'Latest Version', 'Tool', 'Fail Closed', 'Actions'] as const).map(
                (header) => (
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
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {initialSkills.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  style={{
                    textAlign: 'center',
                    padding: '3rem',
                    color: 'var(--text-muted)',
                    fontSize: '0.9375rem',
                  }}
                >
                  No skills yet. Create one above.
                </td>
              </tr>
            ) : (
              initialSkills.map((skill) => <SkillRow key={skill.id} skill={skill} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
