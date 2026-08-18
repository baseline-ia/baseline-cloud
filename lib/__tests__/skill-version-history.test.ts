import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db/client', () => ({
  db: { select: vi.fn() },
}))

import { db } from '@/lib/db/client'
import {
  getCorporateSkillVersionPage,
  parseSkillVersionPageParams,
} from '@/lib/services/corporate-skills'

describe('parseSkillVersionPageParams', () => {
  it('defaults to page one', () => {
    expect(parseSkillVersionPageParams({})).toEqual({ page: 1 })
  })

  it('accepts a positive page and rejects invalid pages', () => {
    expect(parseSkillVersionPageParams({ page: '3' })).toEqual({ page: 3 })
    expect(parseSkillVersionPageParams({ page: '-1' })).toEqual({ page: 1 })
  })
})

describe('getCorporateSkillVersionPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('counts versions and limits the newest-first history page', async () => {
    const skill = {
      id: 'skill-1',
      slug: 'sdd-apply',
      name: 'SDD Apply',
      description: null,
      tool: 'kiro',
      failClosed: false,
      createdByUserId: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    }
    const latest = { id: 'version-51', skillId: 'skill-1', version: 51 }
    const versions = [{ id: 'version-1', skillId: 'skill-1', version: 1 }]
    const skillLimit = vi.fn().mockResolvedValue([skill])
    const latestLimit = vi.fn().mockResolvedValue([latest])
    const countWhere = vi.fn().mockResolvedValue([{ total: '51' }])
    const versionWhere = vi.fn().mockReturnValue({
      orderBy: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          offset: vi.fn().mockResolvedValue(versions),
        }),
      }),
    })

    vi.mocked(db.select)
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: skillLimit }) }) } as any)
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ orderBy: vi.fn().mockReturnValue({ limit: latestLimit }) }) }) } as any)
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: countWhere }) } as any)
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: versionWhere }) } as any)

    const result = await getCorporateSkillVersionPage('sdd-apply', { page: 2 })

    expect(result).toMatchObject({ skill, latestVersion: latest, total: 51, page: 2, totalPages: 2 })
    const orderBy = versionWhere.mock.results[0]?.value.orderBy
    const limit = orderBy.mock.results[0]?.value.limit
    expect(limit).toHaveBeenCalledWith(50)
    expect(limit.mock.results[0]?.value.offset).toHaveBeenCalledWith(50)
  })
})
