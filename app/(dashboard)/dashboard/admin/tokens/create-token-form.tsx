'use client'

import { useActionState } from 'react'
import { createTokenAction } from './actions'

export function CreateTokenForm() {
  const [state, action, pending] = useActionState(createTokenAction, {})

  return (
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
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.75rem' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          <label
            htmlFor="token-name"
            style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)' }}
          >
            Token name
          </label>
          <input
            id="token-name"
            name="name"
            type="text"
            placeholder="e.g. CI / My MacBook"
            required
            style={{
              height: '36px',
              padding: '0 0.75rem',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--cl-radius-sm)',
              fontSize: '0.9375rem',
              color: 'var(--text)',
              background: 'var(--bg-subtle)',
              outline: 'none',
              width: '100%',
              maxWidth: '360px',
            }}
          />
        </div>
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
            flexShrink: 0,
          }}
        >
          {pending ? 'Creating…' : 'Create Token'}
        </button>
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
    </form>
  )
}
