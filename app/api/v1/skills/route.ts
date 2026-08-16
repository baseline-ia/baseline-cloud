import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { resolveBearerToken } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { normalizeSlug, isProjectEnrolled } from '@/lib/services/projects'
import {
  getAssignmentsForProject,
  createCorporateSkill,
  publishSkillVersion,
  SkillSlugTakenError,
} from '@/lib/services/corporate-skills'

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

const CreateSkillBody = z.object({
  slug: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  tool: z.enum(['', 'kiro']).optional(),
  content: z.string().min(1),
})

export async function POST(req: NextRequest) {
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

  if (resolved.role !== 'admin') {
    return NextResponse.json(
      { error_class: 'forbidden', error_code: 'admin_required' },
      { status: 403 },
    )
  }

  const rl = checkRateLimit(`skills-create:${resolved.tokenId}`, { limit: 20, windowMs: 60_000 })
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error_class: 'validation', error_code: 'invalid_json' },
      { status: 400 },
    )
  }

  const parsed = CreateSkillBody.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error_class: 'validation', error_code: 'invalid_body', detail: parsed.error.errors[0]?.message },
      { status: 400 },
    )
  }

  const { slug, name, description, tool, content } = parsed.data

  let skill: { id: string }
  try {
    skill = await createCorporateSkill(
      {
        slug,
        name,
        description: description || null,
        tool: tool || null,
        failClosed: false,
      },
      resolved.userId,
    )
  } catch (err) {
    if (err instanceof SkillSlugTakenError) {
      return NextResponse.json(
        { error_class: 'conflict', error_code: 'slug_taken', slug },
        { status: 409 },
      )
    }
    return NextResponse.json(
      { error_class: 'server', error_code: 'create_failed' },
      { status: 500 },
    )
  }

  try {
    await publishSkillVersion(skill.id, content, resolved.userId)
  } catch {
    return NextResponse.json(
      { error_class: 'server', error_code: 'publish_failed' },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, slug, id: skill.id }, { status: 201 })
}
