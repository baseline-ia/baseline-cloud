import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { resolveBearerToken } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { normalizeSlug, isProjectEnrolled } from '@/lib/services/projects'
import { getAssignmentsForProject } from '@/lib/services/corporate-skills'

function extractBearer(req: Request): string | null {
  const auth = req.headers.get('authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return null
  return auth.slice(7).trim() || null
}

export async function GET(req: NextRequest) {
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
  const rl = checkRateLimit(`skills:${resolved.tokenId}`, { limit: 60, windowMs: 60_000 })
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs)

  // Step 3: Validate project param
  const projectParam = req.nextUrl.searchParams.get('project')
  if (!projectParam) {
    return NextResponse.json(
      { error_class: 'validation', error_code: 'project_required' },
      { status: 400 },
    )
  }

  let slug: string
  try {
    slug = normalizeSlug(projectParam)
  } catch {
    return NextResponse.json(
      { error_class: 'validation', error_code: 'invalid_project_slug' },
      { status: 400 },
    )
  }

  // Step 4: Enrollment check
  const enrolled = await isProjectEnrolled(slug)
  if (!enrolled) {
    return NextResponse.json(
      { error_class: 'forbidden', error_code: 'project_not_enrolled', project: slug },
      { status: 403 },
    )
  }

  // Step 5: Fetch assignments
  const skills = await getAssignmentsForProject(slug)

  return NextResponse.json({ ok: true, skills }, { status: 200 })
}
