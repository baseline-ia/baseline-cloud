import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db/client', () => ({
  db: { select: vi.fn() },
}))

vi.mock('@/lib/auth/index', () => ({
  writeAudit: vi.fn(),
}))

import { db } from '@/lib/db/client'
import { listAdminProjects, parseAdminProjectListParams } from '@/lib/services/projects'

describe('parseAdminProjectListParams', () => {
  it('defaults to page one with no search', () => {
    expect(parseAdminProjectListParams({})).toEqual({ search: '', page: 1 })
  })

  it('trims search and parses a positive page', () => {
    expect(parseAdminProjectListParams({ q: '  api  ', page: '3' })).toEqual({
      search: 'api',
      page: 3,
    })
  })

  it('rejects invalid pages and uses the first repeated parameter', () => {
    expect(parseAdminProjectListParams({ q: ['api', 'ignored'], page: '-2' })).toEqual({
      search: 'api',
      page: 1,
    })
  })
})

describe('listAdminProjects', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('counts and fetches only the requested page', async () => {
    const countWhere = vi.fn().mockResolvedValue([{ total: '51' }])
    const rows = [
      {
        slug: 'api-gateway',
        name: 'API Gateway',
        enabled: true,
        createdAt: new Date('2024-01-01'),
        createdByUserId: null,
        disabledAt: null,
        disabledByUserId: null,
      },
    ]
    const rowsWhere = vi.fn().mockReturnValue({
      orderBy: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          offset: vi.fn().mockResolvedValue(rows),
        }),
      }),
    })

    vi.mocked(db.select)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({ where: countWhere }),
      } as any)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({ where: rowsWhere }),
      } as any)

    const result = await listAdminProjects({ search: 'api', page: 2 })

    expect(result).toMatchObject({ rows, total: 51, page: 2, totalPages: 2 })
    expect(rowsWhere).toHaveBeenCalledTimes(1)
    const orderBy = rowsWhere.mock.results[0]?.value.orderBy
    const limit = orderBy.mock.results[0]?.value.limit
    expect(limit).toHaveBeenCalledWith(50)
    expect(limit.mock.results[0]?.value.offset).toHaveBeenCalledWith(50)
  })
})
