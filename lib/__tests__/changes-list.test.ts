import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/client', () => ({
  db: { select: vi.fn() },
}));

import { db } from '@/lib/db/client';
import { listChangesPage, parseChangesParams } from '@/lib/services/metrics';

describe('parseChangesParams', () => {
  it('defaults to page one with no search', () => {
    expect(parseChangesParams({})).toEqual({ search: '', page: 1 });
  });

  it('trims search and parses a positive page', () => {
    expect(parseChangesParams({ q: '  migration  ', page: '3' })).toEqual({
      search: 'migration',
      page: 3,
    });
  });

  it('rejects invalid pages and uses the first repeated parameter', () => {
    expect(parseChangesParams({ q: ['api', 'ignored'], page: '-2' })).toEqual({
      search: 'api',
      page: 1,
    });
  });
});

describe('listChangesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns filtered summary counts and only the requested page', async () => {
    const settingsLimit = vi.fn().mockResolvedValue([]);
    const countWhere = vi.fn().mockResolvedValue([{ total: '51', closed: '40' }]);
    const rowsWhere = vi.fn().mockReturnValue({
      orderBy: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          offset: vi.fn().mockResolvedValue([
            {
              changeName: 'api-migration',
              username: 'alice',
              project: 'api',
              workType: 'migration',
              title: 'API migration',
              estimateMin: null,
              estimateSource: null,
              estimateBucket: null,
              openedAt: new Date('2024-01-01'),
              closedAt: new Date('2024-01-02'),
              durationMs: 3_600_000,
              totalCommits: 2,
            },
          ]),
        }),
      }),
    });

    vi.mocked(db.select)
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: settingsLimit }) }) } as any)
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: countWhere }) } as any)
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: rowsWhere }) } as any);

    const result = await listChangesPage({ search: 'api', page: 2 });

    expect(result).toMatchObject({ total: 51, closed: 40, open: 11, page: 2, totalPages: 2 });
    const orderBy = rowsWhere.mock.results[0]?.value.orderBy;
    const limit = orderBy.mock.results[0]?.value.limit;
    expect(limit).toHaveBeenCalledWith(50);
    expect(limit.mock.results[0]?.value.offset).toHaveBeenCalledWith(50);
  });
});
