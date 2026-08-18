import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/client', () => ({
  db: { select: vi.fn() },
}));

import { db } from '@/lib/db/client';
import { getRecentEventsPage, parseRecentEventsParams } from '@/lib/services/metrics';

describe('parseRecentEventsParams', () => {
  it('defaults to page one with no search', () => {
    expect(parseRecentEventsParams({})).toEqual({ search: '', page: 1 });
  });

  it('trims search and parses a positive page', () => {
    expect(parseRecentEventsParams({ q: '  cli.doctor  ', page: '3' })).toEqual({
      search: 'cli.doctor',
      page: 3,
    });
  });

  it('rejects invalid pages and uses the first repeated parameter', () => {
    expect(parseRecentEventsParams({ q: ['api', 'ignored'], page: '-2' })).toEqual({
      search: 'api',
      page: 1,
    });
  });
});

describe('getRecentEventsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('counts filtered events and limits the requested page', async () => {
    const countWhere = vi.fn().mockResolvedValue([{ c: '51' }]);
    const rowsWhere = vi.fn().mockReturnValue({
      orderBy: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          offset: vi.fn().mockResolvedValue([
            {
              id: 'event-1',
              username: 'alice',
              eventType: 'cli.doctor',
              project: 'api',
              payload: { success: true },
              occurredAt: new Date('2024-01-01'),
            },
          ]),
        }),
      }),
    });

    vi.mocked(db.select)
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: countWhere }) } as any)
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: rowsWhere }) } as any);

    const result = await getRecentEventsPage({ search: 'api', page: 2 });

    expect(result).toMatchObject({ total: 51, page: 2, totalPages: 2 });
    const orderBy = rowsWhere.mock.results[0]?.value.orderBy;
    const limit = orderBy.mock.results[0]?.value.limit;
    expect(limit).toHaveBeenCalledWith(50);
    expect(limit.mock.results[0]?.value.offset).toHaveBeenCalledWith(50);
  });
});
