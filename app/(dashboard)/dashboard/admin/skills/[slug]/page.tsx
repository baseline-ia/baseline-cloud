import { Zap } from 'lucide-react'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { resolveSession } from '@/lib/auth'
import {
  getCorporateSkillVersionPage,
  parseSkillVersionPageParams,
} from '@/lib/services/corporate-skills'
import { SkillDetailView } from './skill-detail'

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function SkillDetailPage({ params, searchParams }: Props) {
  const cookieStore = await cookies()
  const session = await resolveSession(cookieStore.get('baseline_dashboard_session')?.value)
  if (!session || session.role !== 'admin') redirect('/dashboard')

  const { slug } = await params
  const versionParams = parseSkillVersionPageParams(await searchParams)
  const result = await getCorporateSkillVersionPage(slug, versionParams)
  if (!result) notFound()

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
          {result.skill.name}
        </h1>
        <p className="subtitle">
          <code style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>{result.skill.slug}</code>
        </p>
      </div>

      <SkillDetailView
        skill={result.skill}
        latestVersion={result.latestVersion}
        versions={result.versions}
        versionPage={result.page}
        versionTotal={result.total}
        versionTotalPages={result.totalPages}
      />
    </div>
  )
}
