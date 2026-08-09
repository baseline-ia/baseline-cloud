import { describe, it, expect } from 'vitest'
import { extractIp } from '../ip'

function makeRequest(headers: Record<string, string>): Request {
  return new Request('http://localhost/', { headers })
}

describe('extractIp', () => {
  it('returns x-real-ip when present', () => {
    const req = makeRequest({ 'x-real-ip': '1.2.3.4', 'x-forwarded-for': '5.6.7.8, 9.10.11.12' })
    expect(extractIp(req)).toBe('1.2.3.4')
  })

  it('trims x-real-ip', () => {
    const req = makeRequest({ 'x-real-ip': '  1.2.3.4  ' })
    expect(extractIp(req)).toBe('1.2.3.4')
  })

  it('uses first hop of x-forwarded-for when x-real-ip is absent', () => {
    const req = makeRequest({ 'x-forwarded-for': '5.6.7.8, 9.10.11.12' })
    expect(extractIp(req)).toBe('5.6.7.8')
  })

  it('trims x-forwarded-for first hop', () => {
    const req = makeRequest({ 'x-forwarded-for': '  5.6.7.8  , 9.10.11.12' })
    expect(extractIp(req)).toBe('5.6.7.8')
  })

  it('returns "unknown" when neither header is present', () => {
    const req = makeRequest({})
    expect(extractIp(req)).toBe('unknown')
  })

  it('ignores blank x-real-ip and falls back to x-forwarded-for', () => {
    const req = makeRequest({ 'x-real-ip': '   ', 'x-forwarded-for': '5.6.7.8' })
    expect(extractIp(req)).toBe('5.6.7.8')
  })
})
