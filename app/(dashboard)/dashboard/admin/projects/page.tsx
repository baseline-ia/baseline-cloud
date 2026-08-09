import { FolderKanban } from 'lucide-react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { resolveSession } from '@/lib/auth'
import { listProjects } from '@/lib/services/projects'
import { ProjectsForm } from './projects-form'

export default async function ProjectsPage() {
  const cookieStore = await cookies()
  const session = await resolveSession(cookieStore.get('baseline_dashboard_session')?.value)
  if (!session || session.role !== 'admin') redirect('/dashboard')

  const projects = await listProjects()

  return (
    <div>
      <div className="page-header">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FolderKanban size={22} />
          Projects
        </h1>
        <p className="subtitle">Manage the project enrollment allowlist for telemetry ingestion.</p>
      </div>

      <ProjectsForm projects={projects} />
    </div>
  )
}
