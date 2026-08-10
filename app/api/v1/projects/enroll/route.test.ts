import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  resolveBearerToken: vi.fn(),
  enrollProject: vi.fn(),
  getProject: vi.fn(),
  checkRateLimit: vi.fn(),
  rateLimitResponse: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ resolveBearerToken: mocks.resolveBearerToken }))
vi.mock('@/lib/services/projects', () => ({
  enrollProject: mocks.enrollProject,
  getProject: mocks.getProject,
  normalizeSlug: (slug: string) => slug.trim().toLowerCase(),
  ProjectAlreadyEnrolledError: class ProjectAlreadyEnrolledError extends Error {},
}))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: mocks.checkRateLimit,
  rateLimitResponse: mocks.rateLimitResponse,
}))

import { POST } from './route'

const user = { userId: 'user-1', username: 'alice', role: 'member' as const }

function request(body: unknown, token = 'prefix.secret') {
  return new Request('http://localhost/api/v1/projects/enroll', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/v1/projects/enroll', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.resolveBearerToken.mockResolvedValue(user)
    mocks.checkRateLimit.mockReturnValue({ allowed: true, retryAfterMs: 0 })
  })

  it('requires a bearer token', async () => {
    const response = await POST(new Request('http://localhost/api/v1/projects/enroll', { method: 'POST' }) as never)
    expect(response.status).toBe(401)
  })

  it('applies the per-user enrollment rate limit', async () => {
    const limited = new Response(JSON.stringify({ error_code: 'too_many_requests' }), { status: 429 })
    mocks.checkRateLimit.mockReturnValue({ allowed: false, retryAfterMs: 60_000 })
    mocks.rateLimitResponse.mockReturnValue(limited)

    const response = await POST(request({ slug: 'my-project', name: 'My Project' }) as never)

    expect(response.status).toBe(429)
    expect(mocks.checkRateLimit).toHaveBeenCalledWith('projects:enroll:user-1', {
      limit: 10,
      windowMs: 15 * 60_000,
    })
    expect(mocks.enrollProject).not.toHaveBeenCalled()
  })

  it('returns 400 for a slug outside the server slug contract', async () => {
    const response = await POST(request({ slug: 'not valid!', name: 'Project' }) as never)

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error_class: 'validation', error_code: 'invalid_input' })
  })

  it('creates an enrolled project for an authenticated user', async () => {
    const project = { slug: 'my-project', name: 'My Project', enabled: true }
    mocks.enrollProject.mockResolvedValue(project)

    const response = await POST(request({ slug: 'My-Project', name: 'My Project' }) as never)

    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({ ok: true, created: true, project })
    expect(mocks.enrollProject).toHaveBeenCalledWith('my-project', 'My Project', 'user-1')
  })

  it('returns 409 for a project owned by another user', async () => {
    const { ProjectAlreadyEnrolledError } = await import('@/lib/services/projects')
    mocks.enrollProject.mockRejectedValue(new ProjectAlreadyEnrolledError('my-project'))
    mocks.getProject.mockResolvedValue({
      slug: 'my-project', name: 'Other', enabled: true, createdByUserId: 'user-2',
    })

    const response = await POST(request({ slug: 'my-project', name: 'My Project' }) as never)

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error_class: 'conflict', error_code: 'project_already_enrolled' })
  })

  it('returns 200 for a retry by the same user with the same metadata', async () => {
    const { ProjectAlreadyEnrolledError } = await import('@/lib/services/projects')
    mocks.enrollProject.mockRejectedValue(new ProjectAlreadyEnrolledError('my-project'))
    const project = {
      slug: 'my-project', name: 'My Project', enabled: true, createdByUserId: 'user-1',
    }
    mocks.getProject.mockResolvedValue(project)

    const response = await POST(request({ slug: 'my-project', name: 'My Project' }) as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true, created: false, project })
  })
})
