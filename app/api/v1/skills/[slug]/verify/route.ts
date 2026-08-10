import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { resolveBearerToken } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { normalizeSlug, isProjectEnrolled } from '@/lib/services/projects'
import { getAssignmentsForProject, SKILL_SLUG_RE } from '@/lib/services/corporate-skills'

function extractBearer(req: Request): string | null {
  const auth = req.headers.get('authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return null
  return auth.slice(7).trim() || null
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  // Step 1: Bearer token auth
  const raw = extractBearer(req)
  if (!raw) {
    return NextResponse.json(
      { error_class: 'auth', error_code: 'token_required' },
      { status: 401 },
    )
  }

  const resolved = await resolveBearerToken(raw)
  if (!resolved) {
    return NextResponse.json(
      { error_class: 'auth', error_code: 'token_required' },
      { status: 401 },
    )
  }

  // Step 2: Rate limiting
  const rl = checkRateLimit(`skills:verify:${resolved.tokenId}`, { limit: 60, windowMs: 60_000 })
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs)

  // Step 3: Validate project param
  const projectParam = req.nextUrl.searchParams.get('project')
  if (!projectParam) {
    return NextResponse.json(
      { error_class: 'validation', error_code: 'project_required' },
      { status: 400 },
    )
  }

  let projectSlug: string
  try {
    projectSlug = normalizeSlug(projectParam)
  } catch {
    return NextResponse.json(
      { error_class: 'validation', error_code: 'invalid_project_slug' },
      { status: 400 },
    )
  }

  // Step 4: Enrollment check
  const enrolled = await isProjectEnrolled(projectSlug)
  if (!enrolled) {
    return NextResponse.json(
      { error_class: 'forbidden', error_code: 'project_not_enrolled', project: projectSlug },
      { status: 403 },
    )
  }

  // Step 5: Validate skill slug param
  const { slug: skillSlug } = await params
  if (!SKILL_SLUG_RE.test(skillSlug)) {
    return NextResponse.json(
      { error_class: 'validation', error_code: 'invalid_skill_slug' },
      { status: 400 },
    )
  }

  // Step 6: Fetch assignments and find the matching skill
  const assignments = await getAssignmentsForProject(projectSlug)
  const assignment = assignments.find((a) => a.slug === skillSlug)

  if (!assignment) {
    return NextResponse.json(
      { error_class: 'not_found', error_code: 'skill_not_assigned' },
      { status: 404 },
    )
  }

  return NextResponse.json(
    {
      ok: true,
      active: true,
      version: assignment.version,
      contentHash: assignment.contentHash,
    },
    { status: 200 },
  )
}
