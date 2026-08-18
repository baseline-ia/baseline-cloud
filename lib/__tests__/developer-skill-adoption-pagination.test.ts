import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/client', () => ({
  db: { select: vi.fn() },
}));

import { db } from '@/lib/db/client';
import {
  getDeveloperStatsPage,
  getSkillAdoptionPage,
  parseDeveloperStatsParams,
  parseSkillAdoptionParams,
} from '@/lib/services/metrics';

describe('aggregate list parsers', () => {
  it('normalizes developer search and page parameters', () => {
    expect(parseDeveloperStatsParams({ q: '  alice  ', page: '2' })).toEqual({
      search: 'alice',
      page: 2,
    });
    expect(parseDeveloperStatsParams({ page: '-1' })).toEqual({ search: '', page: 1 });
  });

  it('normalizes skill adoption search and page parameters', () => {
    expect(parseSkillAdoptionParams({ q: '  kiro  ', page: '2' })).toEqual({
      search: 'kiro',
      page: 2,
    });
    expect(parseSkillAdoptionParams({ page: 'invalid' })).toEqual({ search: '', page: 1 });
  });
});

describe('getDeveloperStatsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('limits the grouped developer query to one page', async () => {
    const groupedWhere = vi.fn().mockReturnValue({
      groupBy: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            offset: vi.fn().mockResolvedValue([
              {
                username: 'alice',
                totalEvents: 4,
                lastSeenAt: new Date('2024-01-01'),
              },
            ]),
          }),
        }),
      }),
    });
    const countWhere = vi.fn().mockResolvedValue([{ total: 51 }]);
    const topCommands = vi.fn().mockReturnValue({
      orderBy: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([{ eventType: 'cli.doctor', c: 3 }]),
      }),
    });
    const errorWhere = vi.fn().mockResolvedValue([{ c: 0 }]);

    vi.mocked(db.select)
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: countWhere }) } as any)
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: groupedWhere }) } as any)
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ groupBy: topCommands }) }) } as any)
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: errorWhere }) } as any);

    const result = await getDeveloperStatsPage({ search: 'alice', page: 2 });

    expect(result).toMatchObject({ total: 51, page: 2, totalPages: 2 });
    const orderBy = groupedWhere.mock.results[0]?.value.groupBy.mock.results[0]?.value.orderBy;
    const limit = orderBy.mock.results[0]?.value.limit;
    expect(limit).toHaveBeenCalledWith(50);
    expect(limit.mock.results[0]?.value.offset).toHaveBeenCalledWith(50);
  });
});

describe('getSkillAdoptionPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('counts grouped skills and limits the aggregate page', async () => {
    const groupedSkills = { as: vi.fn().mockReturnValue({}) };
    const groupBuilder = vi.fn().mockReturnValue({ as: groupedSkills.as });
    const groupedRowsWhere = vi.fn().mockReturnValue({
      groupBy: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            offset: vi.fn().mockResolvedValue([
              {
                skillName: 'skill-a',
                tool: 'kiro',
                adopters: 3,
                lastInstalledAt: new Date('2024-01-01'),
              },
            ]),
          }),
        }),
      }),
    });

    vi.mocked(db.select)
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ groupBy: groupBuilder }) }) } as any)
      .mockReturnValueOnce({ from: vi.fn().mockResolvedValue([{ total: 51 }]) } as any)
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: groupedRowsWhere }) } as any);

    const result = await getSkillAdoptionPage({ search: 'kiro', page: 2 });

    expect(result).toMatchObject({ total: 51, page: 2, totalPages: 2 });
    const orderBy = groupedRowsWhere.mock.results[0]?.value.groupBy.mock.results[0]?.value.orderBy;
    const limit = orderBy.mock.results[0]?.value.limit;
    expect(limit).toHaveBeenCalledWith(50);
    expect(limit.mock.results[0]?.value.offset).toHaveBeenCalledWith(50);
  });
});
