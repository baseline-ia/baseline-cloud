import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { resolveSession } from '@/lib/auth';
import { LoginForm } from './login-form';

interface LoginPageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  // If already authenticated, redirect to dashboard
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('baseline_dashboard_session')?.value;
  if (sessionCookie) {
    const session = await resolveSession(sessionCookie);
    if (session) {
      redirect('/dashboard');
    }
  }

  const params = await searchParams;
  const next = params.next ?? '/dashboard';

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="brand-logo">b</div>
        <h1>baseline-cloud</h1>
        <p className="subtitle">Self-hosted telemetry dashboard for the baseline CLI</p>

        <LoginForm next={next} />

        <div className="help-text">
          <p>New here? Sign up via the API:</p>
          <pre
            style={{
              margin: '0.5rem 0 0',
              padding: '0.5rem',
              background: 'var(--bg-subtle)',
              borderRadius: 'var(--cl-radius-sm)',
              fontSize: '0.75rem',
              overflowX: 'auto',
            }}
          >
            <code>{`curl -X POST /v1/auth/signup \\
  -H 'Content-Type: application/json' \\
  -d '{"username":"...","email":"...","password":"..."}'`}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
