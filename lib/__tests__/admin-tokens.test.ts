import { describe, expect, it } from 'vitest'
import { parseAdminTokenListParams } from '@/lib/services/admin-tokens'

describe('parseAdminTokenListParams', () => {
  it('defaults to active page one with no search', () => {
    expect(parseAdminTokenListParams({})).toEqual({ tab: 'active', search: '', page: 1 })
  })

  it('accepts revoked status, trims search, and parses a positive page', () => {
    expect(parseAdminTokenListParams({ tab: 'revoked', q: '  ci  ', page: '3' })).toEqual({
      tab: 'revoked',
      search: 'ci',
      page: 3,
    })
  })

  it('rejects invalid tabs and pages', () => {
    expect(parseAdminTokenListParams({ tab: 'unknown', page: '-2' })).toEqual({
      tab: 'active',
      search: '',
      page: 1,
    })
  })
})
