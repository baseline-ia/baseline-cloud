import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  update: vi.fn(),
  verifyPassword: vi.fn(),
  issueToken: vi.fn(),
  writeAudit: vi.fn(),
}))

vi.mock('@/lib/db/client', () => ({ db: mocks }))
vi.mock('@/lib/auth', () => ({
  issueToken: mocks.issueToken,
  verifyPassword: mocks.verifyPassword,
  writeAudit: mocks.writeAudit,
}))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: () => ({ allowed: true }),
  rateLimitResponse: vi.fn(),
}))

import { POST } from './route'

describe('POST /api/v1/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const user = {
      id: 'user-1',
      username: 'alice',
      email: 'alice@example.com',
      role: 'member',
      enabled: true,
      passwordHash: 'hashed',
    }
    mocks.select
      .mockReturnValueOnce({ from: () => ({ where: () => ({ limit: async () => [user] }) }) })
      .mockReturnValueOnce({ from: () => ({ where: async () => [] }) })
    mocks.update.mockReturnValue({ set: () => ({ where: async () => undefined }) })
    mocks.verifyPassword.mockResolvedValue(true)
    mocks.issueToken.mockResolvedValue({
      id: 'token-1',
      raw: 'prefix.secret',
      prefix: 'prefix',
      name: 'CLI',
    })
  })

  it('issues and returns a bearer token after successful password login', async () => {
    const response = await POST(
      new Request('http://localhost/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: 'alice', password: 'correct-password' }),
        headers: { 'content-type': 'application/json' },
      }) as never,
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      user: { username: 'alice' },
      token: { id: 'token-1', raw: 'prefix.secret', name: 'CLI' },
    })
    expect(mocks.issueToken).toHaveBeenCalledWith({
      userId: 'user-1',
      username: 'alice',
      name: 'CLI',
      ip: expect.any(String),
    })
  })
})
