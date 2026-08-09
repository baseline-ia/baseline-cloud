// Single-process in-memory store. This module assumes exactly one Node
// instance; if the deployment ever scales horizontally, limits multiply
// by replica count and this module must be replaced with a shared store
// (Redis, Upstash, etc.).
import { NextResponse } from 'next/server'
import { config } from '@/lib/config'

export interface RateLimitOptions {
  limit: number
  windowMs: number
}

export interface RateLimitResult {
  allowed: boolean
  retryAfterMs: number
}

interface Bucket {
  count: number
  resetAt: number
}

const store = new Map<string, Bucket>()

let lastSweepAt = 0
const SWEEP_INTERVAL_MS = 60_000

export function checkRateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
  if (!config.RATE_LIMIT_ENABLED) {
    return { allowed: true, retryAfterMs: 0 }
  }

  const now = Date.now()

  if (now - lastSweepAt >= SWEEP_INTERVAL_MS) {
    for (const [k, b] of store) {
      if (b.resetAt <= now) store.delete(k)
    }
    lastSweepAt = now
  }

  const bucket = store.get(key)

  if (!bucket || bucket.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + opts.windowMs })
    return { allowed: true, retryAfterMs: 0 }
  }

  if (bucket.count >= opts.limit) {
    return { allowed: false, retryAfterMs: bucket.resetAt - now }
  }

  bucket.count += 1
  return { allowed: true, retryAfterMs: 0 }
}

export function rateLimitResponse(retryAfterMs: number): NextResponse {
  const retryAfterSec = Math.ceil(retryAfterMs / 1000)
  return NextResponse.json(
    { error_class: 'rate_limit', error_code: 'too_many_requests' },
    { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
  )
}

export function __resetRateLimitStoreForTests(): void {
  store.clear()
  lastSweepAt = 0
}
