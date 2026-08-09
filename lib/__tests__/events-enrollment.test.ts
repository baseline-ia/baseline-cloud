import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// vi.mock calls are hoisted — factory functions must not reference outer vars
// ============================================================================

vi.mock('@/lib/db/client', () => ({
  db: {
    insert: vi.fn(),
    transaction: vi.fn(),
  },
}))

vi.mock('@/lib/auth', () => ({
  resolveBearerToken: vi.fn(),
}))

vi.mock('@/lib/ip', () => ({
  extractIp: vi.fn().mockReturnValue('127.0.0.1'),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true, retryAfterMs: 0 }),
  rateLimitResponse: vi.fn(),
}))

vi.mock('@/lib/services/projects', () => ({
  normalizeSlug: vi.fn((s: string) => s.trim().toLowerCase()),
  isProjectEnrolled: vi.fn(),
  checkProjectsEnrolled: vi.fn(),
}))

// nanoid must return a stable value in tests
vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => 'test-id-123456789012'),
}))

// ============================================================================
// Import AFTER mocks
// ============================================================================

import { NextRequest } from 'next/server'
import { db } from '@/lib/db/client'
import { resolveBearerToken } from '@/lib/auth'
import { isProjectEnrolled, checkProjectsEnrolled, normalizeSlug } from '@/lib/services/projects'

// ============================================================================
// Helpers
// ============================================================================

function makeRequest(url: string, body: unknown, token = 'valid-token'): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
}

function makeRequestNoAuth(url: string, body: unknown): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const RESOLVED_USER = {
  tokenId: 'token-1',
  userId: 'user-1',
  username: 'alice',
  role: 'member' as const,
  prefix: 'tok_',
  name: 'My Token',
}

// ============================================================================
// single event route — POST /api/v1/events
// ============================================================================

describe('POST /api/v1/events — project enrollment check', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(resolveBearerToken).mockResolvedValue(RESOLVED_USER)
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockResolvedValue([{ id: 'test-id-123456789012' }]),
    } as any)
  })

  it('returns 201 when project is enrolled', async () => {
    vi.mocked(isProjectEnrolled).mockResolvedValue(true)
    const { POST } = await import('@/app/api/v1/events/route')

    const req = makeRequest('http://localhost/api/v1/events', {
      event_type: 'cli.install',
      project: 'alpha',
      payload: {},
    })

    const res = await POST(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  it('returns 403 with project_not_enrolled when project is not enrolled', async () => {
    vi.mocked(isProjectEnrolled).mockResolvedValue(false)
    const { POST } = await import('@/app/api/v1/events/route')

    const req = makeRequest('http://localhost/api/v1/events', {
      event_type: 'cli.install',
      project: 'unknown-proj',
      payload: {},
    })

    const res = await POST(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error_class).toBe('forbidden')
    expect(body.error_code).toBe('project_not_enrolled')
    expect(body.project).toBe('unknown-proj')
  })

  it('does not insert event when project is not enrolled', async () => {
    vi.mocked(isProjectEnrolled).mockResolvedValue(false)
    const { POST } = await import('@/app/api/v1/events/route')

    const req = makeRequest('http://localhost/api/v1/events', {
      event_type: 'cli.install',
      project: 'unknown-proj',
      payload: {},
    })

    await POST(req)
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('normalizes slug before enrollment check — "MyProject" resolves to "myproject"', async () => {
    vi.mocked(isProjectEnrolled).mockResolvedValue(true)
    vi.mocked(normalizeSlug).mockReturnValue('myproject')
    const { POST } = await import('@/app/api/v1/events/route')

    const req = makeRequest('http://localhost/api/v1/events', {
      event_type: 'cli.install',
      project: 'MyProject',
      payload: {},
    })

    await POST(req)
    expect(normalizeSlug).toHaveBeenCalledWith('MyProject')
    expect(isProjectEnrolled).toHaveBeenCalledWith('myproject')
  })

  it('inserts with normalized slug (not original project value)', async () => {
    vi.mocked(isProjectEnrolled).mockResolvedValue(true)
    vi.mocked(normalizeSlug).mockReturnValue('myproject')
    const mockValues = vi.fn().mockResolvedValue([{ id: 'test-id' }])
    vi.mocked(db.insert).mockReturnValue({ values: mockValues } as any)
    const { POST } = await import('@/app/api/v1/events/route')

    const req = makeRequest('http://localhost/api/v1/events', {
      event_type: 'cli.install',
      project: 'MyProject',
      payload: {},
    })

    await POST(req)
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ project: 'myproject' }),
    )
  })

  it('returns 403 when project is disabled (isProjectEnrolled returns false)', async () => {
    vi.mocked(isProjectEnrolled).mockResolvedValue(false)
    const { POST } = await import('@/app/api/v1/events/route')

    const req = makeRequest('http://localhost/api/v1/events', {
      event_type: 'cli.install',
      project: 'disabled-proj',
      payload: {},
    })

    const res = await POST(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error_code).toBe('project_not_enrolled')
  })
})

// ============================================================================
// batch event route — POST /api/v1/events/batch
// ============================================================================

describe('POST /api/v1/events/batch — project enrollment check', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(resolveBearerToken).mockResolvedValue(RESOLVED_USER)
    vi.mocked(db.transaction).mockImplementation(async (fn) => {
      await fn({
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue([{ id: 'test-id' }]),
        }),
      } as any)
    })
  })

  it('returns 201 when all projects in batch are enrolled', async () => {
    vi.mocked(checkProjectsEnrolled).mockResolvedValue({ ok: true })
    const { POST } = await import('@/app/api/v1/events/batch/route')

    const req = makeRequest('http://localhost/api/v1/events/batch', {
      events: [
        { event_type: 'cli.install', project: 'alpha', payload: {} },
        { event_type: 'cli.doctor', project: 'beta', payload: {} },
      ],
    })

    const res = await POST(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  it('returns 403 when one project in batch is not enrolled', async () => {
    vi.mocked(checkProjectsEnrolled).mockResolvedValue({ ok: false, missing: ['unknown'] })
    const { POST } = await import('@/app/api/v1/events/batch/route')

    const req = makeRequest('http://localhost/api/v1/events/batch', {
      events: [
        { event_type: 'cli.install', project: 'alpha', payload: {} },
        { event_type: 'cli.doctor', project: 'unknown', payload: {} },
      ],
    })

    const res = await POST(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error_class).toBe('forbidden')
    expect(body.error_code).toBe('project_not_enrolled')
    expect(body.project).toBe('unknown')
  })

  it('does not run transaction when any project is not enrolled (all-or-nothing)', async () => {
    vi.mocked(checkProjectsEnrolled).mockResolvedValue({ ok: false, missing: ['unknown'] })
    const { POST } = await import('@/app/api/v1/events/batch/route')

    const req = makeRequest('http://localhost/api/v1/events/batch', {
      events: [
        { event_type: 'cli.install', project: 'alpha', payload: {} },
        { event_type: 'cli.doctor', project: 'unknown', payload: {} },
      ],
    })

    await POST(req)
    expect(db.transaction).not.toHaveBeenCalled()
  })

  it('normalizes slugs before enrollment check', async () => {
    vi.mocked(checkProjectsEnrolled).mockResolvedValue({ ok: true })
    vi.mocked(normalizeSlug).mockImplementation((s: string) => s.trim().toLowerCase())
    const { POST } = await import('@/app/api/v1/events/batch/route')

    const req = makeRequest('http://localhost/api/v1/events/batch', {
      events: [
        { event_type: 'cli.install', project: 'ALPHA', payload: {} },
        { event_type: 'cli.doctor', project: 'Alpha', payload: {} },
      ],
    })

    await POST(req)
    // Both ALPHA and Alpha normalize to alpha — deduplication should leave just ['alpha']
    expect(checkProjectsEnrolled).toHaveBeenCalledWith(['alpha'])
  })

  it('inserts with normalized slugs in transaction', async () => {
    vi.mocked(checkProjectsEnrolled).mockResolvedValue({ ok: true })
    vi.mocked(normalizeSlug).mockReturnValue('myproject')
    const mockValues = vi.fn().mockResolvedValue([])
    const mockInsert = vi.fn().mockReturnValue({ values: mockValues })
    vi.mocked(db.transaction).mockImplementation(async (fn) => {
      await fn({ insert: mockInsert } as any)
    })
    const { POST } = await import('@/app/api/v1/events/batch/route')

    const req = makeRequest('http://localhost/api/v1/events/batch', {
      events: [{ event_type: 'cli.install', project: 'MyProject', payload: {} }],
    })

    await POST(req)
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ project: 'myproject' }),
    )
  })
})
