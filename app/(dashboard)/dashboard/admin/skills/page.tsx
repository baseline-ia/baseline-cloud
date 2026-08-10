import { Zap } from 'lucide-react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { resolveSession } from '@/lib/auth'
import { listCorporateSkills } from '@/lib/services/corporate-skills'
import { SkillsForm } from './skills-form'

export default async function SkillsPage() {
  const cookieStore = await cookies()
  const session = await resolveSession(cookieStore.get('baseline_dashboard_session')?.value)
  if (!session || session.role !== 'admin') redirect('/dashboard')

  const skills = await listCorporateSkills()

  return (
    <div>
      <div className="page-header">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Zap size={22} />
          Skills
        </h1>
        <p className="subtitle">Manage the corporate skill catalog and project assignments.</p>
      </div>

      <SkillsForm initialSkills={skills} />
    </div>
  )
}
