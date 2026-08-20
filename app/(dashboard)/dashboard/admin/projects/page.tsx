import { FolderKanban } from 'lucide-react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { resolveSession } from '@/lib/auth'
import { listAdminProjects, parseAdminProjectListParams } from '@/lib/services/projects'
import { listCorporateSkills } from '@/lib/services/corporate-skills'
import { ProjectsForm } from './projects-form'

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const cookieStore = await cookies()
  const session = await resolveSession(cookieStore.get('baseline_dashboard_session')?.value)
  if (!session || session.role !== 'admin') redirect('/dashboard')

  const listParams = parseAdminProjectListParams(await searchParams)
  const [projectList, allSkills] = await Promise.all([
    listAdminProjects(listParams),
    listCorporateSkills(),
  ])

  return (
    <div>
      <div className="page-header">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FolderKanban size={22} />
          Projects
        </h1>
        <p className="subtitle">Manage the project enrollment allowlist for telemetry ingestion.</p>
      </div>

      <ProjectsForm
        projects={projectList.rows}
        skills={allSkills}
        search={listParams.search}
        page={projectList.page}
        total={projectList.total}
        totalPages={projectList.totalPages}
      />
    </div>
  )
}
