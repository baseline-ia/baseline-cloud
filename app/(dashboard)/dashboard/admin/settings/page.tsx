import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { resolveSession } from '@/lib/auth'
import { getTimeBaselines } from '@/lib/services/metrics'
import { SettingsForm } from './settings-form'

export default async function SettingsPage() {
  const cookieStore = await cookies()
  const session = await resolveSession(cookieStore.get('baseline_dashboard_session')?.value)
  if (!session || session.role !== 'admin') redirect('/dashboard')

  const baselines = await getTimeBaselines()

  return (
    <div>
      <div className="page-header">
        <h1>Settings</h1>
        <p className="subtitle">Workspace-level configuration.</p>
      </div>

      <div
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--cl-radius)',
          padding: '1.25rem 1.5rem',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)', margin: '0 0 0.25rem' }}>
            Time Baselines (minutes)
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>
            Default estimated time per work type when no per-change estimate is provided.
          </p>
        </div>
        <SettingsForm baselines={baselines} />
      </div>
    </div>
  )
}
