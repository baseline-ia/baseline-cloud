'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { loginAction, type LoginState } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary-full" disabled={pending}>
      {pending ? 'Signing in...' : 'Sign in'}
    </button>
  );
}

const initialState: LoginState = { error: null };

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState(loginAction, initialState);

  return (
    <form action={formAction}>
      <input type="hidden" name="next" value={next} />

      {state.error && <div className="error-msg">{state.error}</div>}

      <div className="form-field">
        <label className="form-label" htmlFor="username">
          Username
        </label>
        <input
          id="username"
          type="text"
          name="username"
          required
          autoFocus
          autoComplete="username"
          className="form-input"
        />
      </div>

      <div className="form-field" style={{ marginBottom: '1.25rem' }}>
        <label className="form-label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          name="password"
          required
          autoComplete="current-password"
          className="form-input"
        />
      </div>

      <SubmitButton />
    </form>
  );
}
