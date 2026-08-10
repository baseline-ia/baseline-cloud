import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHash } from 'node:crypto'

// ============================================================================
// vi.mock calls are hoisted
// ============================================================================

vi.mock('@/lib/auth', () => ({
  resolveBearerToken: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true, retryAfterMs: 0 }),
  rateLimitResponse: vi.fn(),
}))

vi.mock('@/lib/services/projects', () => ({
  normalizeSlug: vi.fn((s: string) => s.trim().toLowerCase()),
  isProjectEnrolled: vi.fn(),
}))

vi.mock('@/lib/services/corporate-skills', () => ({
  getAssignmentsForProject: vi.fn(),
  SKILL_SLUG_RE: /^[a-z0-9-]{1,64}$/,
}))

// ============================================================================
// Import AFTER mocks
// ============================================================================

import { NextRequest } from 'next/server'
import { resolveBearerToken } from '@/lib/auth'
import { isProjectEnrolled } from '@/lib/services/projects'
import { getAssignmentsForProject } from '@/lib/services/corporate-skills'

// ============================================================================
// Helpers
// ============================================================================

const RESOLVED_TOKEN = {
  tokenId: 'token-1',
  userId: 'user-1',
  username: 'alice',
  role: 'member' as const,
  prefix: 'tok_',
  name: 'My Token',
}

function makeRequest(skillSlug: string, project: string, token = 'valid-token'): NextRequest {
  return new NextRequest(
    new URL(`http://localhost/api/v1/skills/${skillSlug}/verify?project=${project}`, 'http://localhost'),
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    },
  )
}

function makeRequestNoAuth(skillSlug: string, project: string): NextRequest {
  return new NextRequest(
    new URL(`http://localhost/api/v1/skills/${skillSlug}/verify?project=${project}`, 'http://localhost'),
    { method: 'GET' },
  )
}

function makeParams(slug: string) {
  return Promise.resolve({ slug })
}

function makeSkillRow(overrides: Record<string, unknown> = {}) {
  const content = '# My Skill\n\nContent.'
  const contentHash = createHash('sha256').update(content).digest('hex')
  return {
    slug: 'my-skill',
    name: 'My Skill',
    version: 2,
    content,
    contentHash,
    failClosed: false,
    tool: null,
    ...overrides,
  }
}

// ============================================================================
// GET /api/v1/skills/[slug]/verify
// ============================================================================

describe('GET /api/v1/skills/[slug]/verify', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(resolveBearerToken).mockResolvedValue(RESOLVED_TOKEN)
    vi.mocked(isProjectEnrolled).mockResolvedValue(true)
    vi.mocked(getAssignmentsForProject).mockResolvedValue([])
  })

  // 3.4a assigned skill → 200 { active: true, version, contentHash }
  it('3.4a returns 200 with active: true when skill is assigned', async () => {
    vi.mocked(getAssignmentsForProject).mockResolvedValue([makeSkillRow()])
    const { GET } = await import('@/app/api/v1/skills/[slug]/verify/route')

    const req = makeRequest('my-skill', 'my-project')
    const res = await GET(req, { params: makeParams('my-skill') })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.active).toBe(true)
    expect(body.version).toBe(2)
    expect(typeof body.contentHash).toBe('string')
  })

  // 3.4b not assigned → 404
  it('3.4b returns 404 when skill is not assigned to project', async () => {
    vi.mocked(getAssignmentsForProject).mockResolvedValue([])
    const { GET } = await import('@/app/api/v1/skills/[slug]/verify/route')

    const req = makeRequest('my-skill', 'my-project')
    const res = await GET(req, { params: makeParams('my-skill') })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error_class).toBe('not_found')
    expect(body.error_code).toBe('skill_not_assigned')
  })

  // 3.4c token missing → 401
  it('3.4c returns 401 when no token', async () => {
    vi.mocked(resolveBearerToken).mockResolvedValue(null)
    const { GET } = await import('@/app/api/v1/skills/[slug]/verify/route')

    const req = makeRequestNoAuth('my-skill', 'my-project')
    const res = await GET(req, { params: makeParams('my-skill') })

    expect(res.status).toBe(401)
  })

  // 3.4d unenrolled project → 403
  it('3.4d returns 403 for unenrolled project', async () => {
    vi.mocked(isProjectEnrolled).mockResolvedValue(false)
    const { GET } = await import('@/app/api/v1/skills/[slug]/verify/route')

    const req = makeRequest('my-skill', 'unenrolled')
    const res = await GET(req, { params: makeParams('my-skill') })

    expect(res.status).toBe(403)
  })

  // 3.5 after unassignment, verify returns 404
  it('3.5 after unassignment, verify returns 404 (was previously 200)', async () => {
    // First call returns assigned, second call returns unassigned
    vi.mocked(getAssignmentsForProject)
      .mockResolvedValueOnce([makeSkillRow()])
      .mockResolvedValueOnce([])
    const { GET } = await import('@/app/api/v1/skills/[slug]/verify/route')

    const req1 = makeRequest('my-skill', 'my-project')
    const res1 = await GET(req1, { params: makeParams('my-skill') })
    expect(res1.status).toBe(200)

    const req2 = makeRequest('my-skill', 'my-project')
    const res2 = await GET(req2, { params: makeParams('my-skill') })
    expect(res2.status).toBe(404)
  })

  // invalid slug format → 400
  it('returns 400 when skill slug has invalid format', async () => {
    const { GET } = await import('@/app/api/v1/skills/[slug]/verify/route')

    const req = makeRequest('My Skill!', 'my-project')
    const res = await GET(req, { params: makeParams('My Skill!') })

    expect(res.status).toBe(400)
  })
})
