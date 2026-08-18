import { Zap } from 'lucide-react'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { resolveSession } from '@/lib/auth'
import {
  listAdminCorporateSkills,
  parseAdminCorporateSkillListParams,
} from '@/lib/services/corporate-skills'
import { SkillsForm } from './skills-form'

export default async function SkillsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const cookieStore = await cookies()
  const session = await resolveSession(cookieStore.get('baseline_dashboard_session')?.value)
  if (!session || session.role !== 'admin') redirect('/dashboard')

  const listParams = parseAdminCorporateSkillListParams(await searchParams)
  const skillList = await listAdminCorporateSkills(listParams)

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            <Zap size={22} />
            Skills
          </h1>
          <Link
            href="/dashboard/admin/skills/new"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
              height: '36px',
              padding: '0 1.25rem',
              background: 'var(--cl-primary)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--cl-radius-sm)',
              fontWeight: 600,
              fontSize: '0.9375rem',
              textDecoration: 'none',
            }}
          >
            + New Skill
          </Link>
        </div>
        <p className="subtitle">Manage the global corporate skill catalog.</p>
      </div>

      <SkillsForm
        initialSkills={skillList.rows}
        search={listParams.search}
        page={skillList.page}
        total={skillList.total}
        totalPages={skillList.totalPages}
      />
    </div>
  )
}
