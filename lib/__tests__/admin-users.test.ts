import { describe, expect, it } from 'vitest'
import { parseAdminUserListParams } from '@/lib/services/admin-users'

describe('parseAdminUserListParams', () => {
  it('defaults to page one with no search', () => {
    expect(parseAdminUserListParams({})).toEqual({ search: '', page: 1 })
  })

  it('trims search and parses a positive page', () => {
    expect(parseAdminUserListParams({ q: '  alice@example.com  ', page: '3' })).toEqual({
      search: 'alice@example.com',
      page: 3,
    })
  })

  it('rejects invalid pages and uses the first repeated parameter', () => {
    expect(parseAdminUserListParams({ q: ['alice', 'ignored'], page: '-2' })).toEqual({
      search: 'alice',
      page: 1,
    })
  })
})
