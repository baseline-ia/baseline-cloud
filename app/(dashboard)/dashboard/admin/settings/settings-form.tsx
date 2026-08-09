'use client'

import { useActionState } from 'react'
import { updateBaselinesAction } from './actions'

const WORK_TYPES = ['feature', 'migration', 'new-project', 'chore', 'fix', 'refactor', 'docs'] as const

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ')
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

interface SettingsFormProps {
  baselines: Record<string, number>
}

export function SettingsForm({ baselines }: SettingsFormProps) {
  const [state, action, pending] = useActionState(updateBaselinesAction, {})

  return (
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: '1rem',
        }}
      >
        {WORK_TYPES.map((wt) => (
          <div key={wt} style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <label
              htmlFor={`baseline-${wt}`}
              style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)' }}
            >
              {capitalize(wt)}
            </label>
            <input
              id={`baseline-${wt}`}
              name={wt}
              type="number"
              min={1}
              step={1}
              required
              defaultValue={baselines[wt] ?? 60}
              style={inputStyle}
            />
          </div>
        ))}
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
          Settings saved successfully.
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
          {pending ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </form>
  )
}
