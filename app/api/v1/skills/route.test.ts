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
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { isProjectEnrolled, normalizeSlug } from '@/lib/services/projects'
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

function makeRequest(project?: string, token = 'valid-token'): NextRequest {
  const url = project
    ? `http://localhost/api/v1/skills?project=${project}`
    : 'http://localhost/api/v1/skills'
  return new NextRequest(new URL(url, 'http://localhost'), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

function makeRequestNoAuth(project?: string): NextRequest {
  const url = project
    ? `http://localhost/api/v1/skills?project=${project}`
    : 'http://localhost/api/v1/skills'
  return new NextRequest(new URL(url, 'http://localhost'), {
    method: 'GET',
  })
}

function makeSkillRow() {
  const content = '# My Skill\n\nContent.'
  const contentHash = createHash('sha256').update(content).digest('hex')
  return {
    slug: 'my-skill',
    name: 'My Skill',
    version: 1,
    content,
    contentHash,
    failClosed: false,
    tool: null,
  }
}

// ============================================================================
// GET /api/v1/skills
// ============================================================================

describe('GET /api/v1/skills', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(resolveBearerToken).mockResolvedValue(RESOLVED_TOKEN)
    vi.mocked(isProjectEnrolled).mockResolvedValue(true)
    vi.mocked(getAssignmentsForProject).mockResolvedValue([])
  })

  // 3.1a valid token + enrolled project → 200 with skills array
  it('3.1a returns 200 with ok: true and skills array for enrolled project', async () => {
    const skillRow = makeSkillRow()
    vi.mocked(getAssignmentsForProject).mockResolvedValue([skillRow])
    const { GET } = await import('@/app/api/v1/skills/route')

    const req = makeRequest('my-project')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(Array.isArray(body.skills)).toBe(true)
    expect(body.skills).toHaveLength(1)
    expect(body.skills[0].slug).toBe('my-skill')
  })

  // 3.1b no token → 401
  it('3.1b returns 401 when no authorization header', async () => {
    vi.mocked(resolveBearerToken).mockResolvedValue(null)
    const { GET } = await import('@/app/api/v1/skills/route')

    const req = makeRequestNoAuth('my-project')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error_class).toBe('auth')
    expect(body.error_code).toBe('token_required')
  })

  // 3.1c valid token + unenrolled project → 403
  it('3.1c returns 403 for unenrolled project', async () => {
    vi.mocked(isProjectEnrolled).mockResolvedValue(false)
    const { GET } = await import('@/app/api/v1/skills/route')

    const req = makeRequest('unenrolled-project')
    const res = await GET(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error_class).toBe('forbidden')
    expect(body.error_code).toBe('project_not_enrolled')
  })

  // 3.1d enrolled project with no assignments → { ok: true, skills: [] }
  it('3.1d returns empty skills array when no assignments', async () => {
    vi.mocked(getAssignmentsForProject).mockResolvedValue([])
    const { GET } = await import('@/app/api/v1/skills/route')

    const req = makeRequest('my-project')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.skills).toEqual([])
  })

  // 3.2 contentHash in response matches sha256(content) byte-for-byte
  it('3.2 contentHash in response matches sha256(content) byte-for-byte', async () => {
    const skillRow = makeSkillRow()
    vi.mocked(getAssignmentsForProject).mockResolvedValue([skillRow])
    const { GET } = await import('@/app/api/v1/skills/route')

    const req = makeRequest('my-project')
    const res = await GET(req)

    const body = await res.json()
    const skill = body.skills[0]
    const computedHash = createHash('sha256').update(skill.content).digest('hex')
    expect(skill.contentHash).toBe(computedHash)
  })

  // 3.3 assignment failClosed value returned directly
  it('3.3 assignment failClosed value is returned directly', async () => {
    const skillRow = { ...makeSkillRow(), failClosed: true }
    vi.mocked(getAssignmentsForProject).mockResolvedValue([skillRow])
    const { GET } = await import('@/app/api/v1/skills/route')

    const req = makeRequest('my-project')
    const res = await GET(req)

    const body = await res.json()
    expect(body.skills[0].failClosed).toBe(true)
  })

  // missing project param → 400
  it('returns 400 when project query param is missing', async () => {
    const { GET } = await import('@/app/api/v1/skills/route')

    const req = makeRequest(undefined)
    const res = await GET(req)

    expect(res.status).toBe(400)
  })

  // invalid token → 401
  it('returns 401 when token is invalid', async () => {
    vi.mocked(resolveBearerToken).mockResolvedValue(null)
    const { GET } = await import('@/app/api/v1/skills/route')

    const req = makeRequest('my-project', 'invalid-token')
    const res = await GET(req)

    expect(res.status).toBe(401)
  })
})
