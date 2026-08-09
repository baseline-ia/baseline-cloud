'use client'

import { useActionState } from 'react'
import { createUserAction } from './actions'

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

const labelStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  fontWeight: 500,
  color: 'var(--text)',
  display: 'block',
  marginBottom: '0.375rem',
}

const fieldStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
}

export function CreateUserForm() {
  const [state, action, pending] = useActionState(createUserAction, {})

  return (
    <form
      action={action}
      style={{
        marginTop: '1.25rem',
        paddingTop: '1.25rem',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
        }}
      >
        <div style={fieldStyle}>
          <label htmlFor="cu-username" style={labelStyle}>
            Username
          </label>
          <input
            id="cu-username"
            name="username"
            type="text"
            placeholder="john_doe"
            required
            style={inputStyle}
          />
        </div>
        <div style={fieldStyle}>
          <label htmlFor="cu-email" style={labelStyle}>
            Email
          </label>
          <input
            id="cu-email"
            name="email"
            type="email"
            placeholder="john@example.com"
            required
            style={inputStyle}
          />
        </div>
        <div style={fieldStyle}>
          <label htmlFor="cu-password" style={labelStyle}>
            Password
          </label>
          <input
            id="cu-password"
            name="password"
            type="password"
            placeholder="Min. 8 characters"
            required
            minLength={8}
            style={inputStyle}
          />
        </div>
        <div style={fieldStyle}>
          <label htmlFor="cu-role" style={labelStyle}>
            Role
          </label>
          <select
            id="cu-role"
            name="role"
            defaultValue="member"
            style={{ ...inputStyle, cursor: 'pointer' }}
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
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

      <div>
        <button
          type="submit"
          disabled={pending}
          style={{
            height: '36px',
            padding: '0 1.25rem',
            background: pending ? 'color-mix(in srgb, var(--cl-primary) 60%, transparent)' : 'var(--cl-primary)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--cl-radius-sm)',
            fontWeight: 600,
            fontSize: '0.9375rem',
            cursor: pending ? 'not-allowed' : 'pointer',
          }}
        >
          {pending ? 'Creating…' : 'Create User'}
        </button>
      </div>
    </form>
  )
}
