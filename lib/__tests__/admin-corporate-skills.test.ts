import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db/client', () => ({
  db: { select: vi.fn() },
}))

vi.mock('@/lib/auth/index', () => ({
  writeAudit: vi.fn(),
}))

import { db } from '@/lib/db/client'
import {
  listAdminCorporateSkills,
  parseAdminCorporateSkillListParams,
} from '@/lib/services/corporate-skills'

describe('parseAdminCorporateSkillListParams', () => {
  it('defaults to page one with no search', () => {
    expect(parseAdminCorporateSkillListParams({})).toEqual({ search: '', page: 1 })
  })

  it('trims search and parses a positive page', () => {
    expect(parseAdminCorporateSkillListParams({ q: '  kiro  ', page: '3' })).toEqual({
      search: 'kiro',
      page: 3,
    })
  })

  it('rejects invalid pages and uses the first repeated parameter', () => {
    expect(parseAdminCorporateSkillListParams({ q: ['kiro', 'ignored'], page: '-2' })).toEqual({
      search: 'kiro',
      page: 1,
    })
  })
})

describe('listAdminCorporateSkills', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('counts filtered skills and limits the latest-version page query', async () => {
    const countWhere = vi.fn().mockResolvedValue([{ total: '51' }])
    const rowsWhere = vi.fn().mockReturnValue({
      orderBy: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          offset: vi.fn().mockResolvedValue([
            {
              id: 'skill-1',
              slug: 'kiro-skill',
              name: 'Kiro Skill',
              description: 'A skill',
              tool: 'kiro',
              failClosed: false,
              createdByUserId: null,
              createdAt: new Date('2024-01-01'),
              updatedAt: new Date('2024-01-01'),
              latestVersion: 2,
            },
          ]),
        }),
      }),
    })

    vi.mocked(db.select)
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: countWhere }) } as any)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          groupBy: vi.fn().mockReturnValue({ as: vi.fn().mockReturnValue({}) }),
        }),
      } as any)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({ where: rowsWhere }),
        }),
      } as any)

    const result = await listAdminCorporateSkills({ search: 'kiro', page: 2 })

    expect(result).toMatchObject({ total: 51, page: 2, totalPages: 2 })
    const orderBy = rowsWhere.mock.results[0]?.value.orderBy
    const limit = orderBy.mock.results[0]?.value.limit
    expect(limit).toHaveBeenCalledWith(50)
    expect(limit.mock.results[0]?.value.offset).toHaveBeenCalledWith(50)
  })
})
