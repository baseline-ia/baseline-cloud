import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { config } from '../config'
import { checkRateLimit, rateLimitResponse, __resetRateLimitStoreForTests } from '../rate-limit'

beforeEach(() => {
  __resetRateLimitStoreForTests()
})

describe('checkRateLimit — disabled (default in test env)', () => {
  it('always allows when RATE_LIMIT_ENABLED is false', () => {
    expect(config.RATE_LIMIT_ENABLED).toBe(false)
    for (let i = 0; i < 20; i++) {
      const result = checkRateLimit('k', { limit: 1, windowMs: 60_000 })
      expect(result.allowed).toBe(true)
      expect(result.retryAfterMs).toBe(0)
    }
  })
})

describe('checkRateLimit — enabled', () => {
  beforeEach(() => {
    config.RATE_LIMIT_ENABLED = true
    __resetRateLimitStoreForTests()
  })

  afterEach(() => {
    config.RATE_LIMIT_ENABLED = false
  })

  it('allows requests within the limit', () => {
    const opts = { limit: 3, windowMs: 60_000 }
    expect(checkRateLimit('a', opts).allowed).toBe(true)
    expect(checkRateLimit('a', opts).allowed).toBe(true)
    expect(checkRateLimit('a', opts).allowed).toBe(true)
  })

  it('rejects the N+1 request', () => {
    const opts = { limit: 3, windowMs: 60_000 }
    checkRateLimit('b', opts)
    checkRateLimit('b', opts)
    checkRateLimit('b', opts)
    const result = checkRateLimit('b', opts)
    expect(result.allowed).toBe(false)
  })

  it('retryAfterMs is positive and accurate when denied', () => {
    const windowMs = 60_000
    const opts = { limit: 1, windowMs }
    checkRateLimit('c', opts)
    const before = Date.now()
    const result = checkRateLimit('c', opts)
    const after = Date.now()
    expect(result.allowed).toBe(false)
    expect(result.retryAfterMs).toBeGreaterThan(0)
    expect(result.retryAfterMs).toBeLessThanOrEqual(windowMs)
    expect(result.retryAfterMs).toBeGreaterThanOrEqual(windowMs - (after - before) - 5)
  })

  it('distinct keys do not share counters', () => {
    const opts = { limit: 1, windowMs: 60_000 }
    checkRateLimit('x', opts)
    const result = checkRateLimit('y', opts)
    expect(result.allowed).toBe(true)
  })

  it('resets counter after window expires', async () => {
    const opts = { limit: 1, windowMs: 50 }
    checkRateLimit('d', opts)
    expect(checkRateLimit('d', opts).allowed).toBe(false)
    await new Promise((r) => setTimeout(r, 60))
    expect(checkRateLimit('d', opts).allowed).toBe(true)
  })

  it('expired entries are discarded on next access', async () => {
    const opts = { limit: 2, windowMs: 50 }
    checkRateLimit('e', opts)
    checkRateLimit('e', opts)
    await new Promise((r) => setTimeout(r, 60))
    const result = checkRateLimit('e', opts)
    expect(result.allowed).toBe(true)
  })
})

describe('rateLimitResponse', () => {
  it('returns HTTP 429', async () => {
    const res = rateLimitResponse(5000)
    expect(res.status).toBe(429)
  })

  it('body has correct shape', async () => {
    const res = rateLimitResponse(5000)
    const body = await res.json()
    expect(body).toEqual({ error_class: 'rate_limit', error_code: 'too_many_requests' })
  })

  it('Retry-After is ceil(retryAfterMs / 1000)', async () => {
    const res = rateLimitResponse(5001)
    expect(res.headers.get('Retry-After')).toBe('6')
  })

  it('Retry-After is exact seconds when divisible', async () => {
    const res = rateLimitResponse(10000)
    expect(res.headers.get('Retry-After')).toBe('10')
  })
})

describe('__resetRateLimitStoreForTests', () => {
  it('clears state between tests', () => {
    config.RATE_LIMIT_ENABLED = true
    const opts = { limit: 1, windowMs: 60_000 }
    checkRateLimit('reset-test', opts)
    expect(checkRateLimit('reset-test', opts).allowed).toBe(false)
    __resetRateLimitStoreForTests()
    expect(checkRateLimit('reset-test', opts).allowed).toBe(true)
    config.RATE_LIMIT_ENABLED = false
  })
})
