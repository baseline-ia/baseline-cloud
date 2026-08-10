import { Zap } from 'lucide-react'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { resolveSession } from '@/lib/auth'
import { NewSkillForm } from './new-skill-form'

export default async function NewSkillPage() {
  const cookieStore = await cookies()
  const session = await resolveSession(cookieStore.get('baseline_dashboard_session')?.value)
  if (!session || session.role !== 'admin') redirect('/dashboard')

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
          <Link
            href="/dashboard/admin/skills"
            style={{
              fontSize: '0.875rem',
              color: 'var(--text-muted)',
              textDecoration: 'none',
            }}
          >
            ← Skills
          </Link>
        </div>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Zap size={22} />
          New Skill
        </h1>
        <p className="subtitle">Create a new skill and publish its first version.</p>
      </div>

      <NewSkillForm />
    </div>
  )
}
