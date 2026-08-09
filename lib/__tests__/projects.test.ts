import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// vi.mock calls are hoisted — factory functions must not reference outer vars
// ============================================================================

vi.mock('@/lib/db/client', () => {
  const mockSelect = vi.fn()
  const mockInsert = vi.fn()
  const mockUpdate = vi.fn()
  const mockDelete = vi.fn()

  return {
    db: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: mockSelect,
          orderBy: vi.fn(() => Promise.resolve([])),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: mockInsert,
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: mockUpdate,
        })),
      })),
      delete: vi.fn(() => ({
        where: mockDelete,
      })),
    },
  }
})

vi.mock('@/lib/auth/index', () => ({
  writeAudit: vi.fn().mockResolvedValue(undefined),
}))

// ============================================================================
// Import AFTER mocks
// ============================================================================

import { db } from '@/lib/db/client'
import { writeAudit } from '@/lib/auth/index'
import {
  SLUG_RE,
  normalizeSlug,
  enrollProject,
  listProjects,
  disableProject,
  enableProject,
  deleteProject,
  isProjectEnrolled,
  checkProjectsEnrolled,
  __resetProjectsCacheForTests,
} from '@/lib/services/projects'

// ============================================================================
// Helpers
// ============================================================================

function makeProject(slug: string, enabled = true) {
  return {
    slug,
    name: slug.charAt(0).toUpperCase() + slug.slice(1),
    enabled,
    createdAt: new Date('2024-01-01'),
    createdByUserId: 'user-1',
    disabledAt: enabled ? null : new Date('2024-01-02'),
    disabledByUserId: enabled ? null : 'user-1',
  }
}

// ============================================================================
// normalizeSlug
// ============================================================================

describe('normalizeSlug', () => {
  it('matches the exported SLUG_RE pattern', () => {
    expect(SLUG_RE.test('alpha')).toBe(true)
    expect(SLUG_RE.test('my-project')).toBe(true)
    expect(SLUG_RE.test('my.project_v2')).toBe(true)
    expect(SLUG_RE.test('my project')).toBe(false)
    expect(SLUG_RE.test('')).toBe(false)
  })

  it('lowercases mixed-case input', () => {
    expect(normalizeSlug('MyProject')).toBe('myproject')
  })

  it('trims leading and trailing whitespace', () => {
    expect(normalizeSlug('  backend  ')).toBe('backend')
  })

  it('accepts slug of exactly 128 characters', () => {
    const slug = 'a'.repeat(128)
    expect(normalizeSlug(slug)).toBe(slug)
  })

  it('throws on invalid characters after normalization', () => {
    expect(() => normalizeSlug('my project!')).toThrow()
  })

  it('throws on empty string', () => {
    expect(() => normalizeSlug('')).toThrow()
  })

  it('throws on slug exceeding 128 characters', () => {
    expect(() => normalizeSlug('a'.repeat(129))).toThrow()
  })
})

// ============================================================================
// Cache and isProjectEnrolled
// ============================================================================

describe('cache + isProjectEnrolled', () => {
  beforeEach(() => {
    __resetProjectsCacheForTests()
    vi.clearAllMocks()
  })

  it('queries DB on first call', async () => {
    const row = makeProject('alpha', true)
    // The .where() fn on the select chain returns the rows
    const mockWhere = vi.fn().mockResolvedValueOnce([row])
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: mockWhere,
        orderBy: vi.fn().mockResolvedValue([]),
      }),
    } as any)

    const result = await isProjectEnrolled('alpha')
    expect(result).toBe(true)
    expect(mockWhere).toHaveBeenCalledTimes(1)
  })

  it('returns cached value on second call without hitting DB', async () => {
    const row = makeProject('alpha', true)
    const mockWhere = vi.fn().mockResolvedValueOnce([row])
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: mockWhere,
        orderBy: vi.fn().mockResolvedValue([]),
      }),
    } as any)

    await isProjectEnrolled('alpha')
    vi.clearAllMocks()

    const result = await isProjectEnrolled('alpha')
    expect(result).toBe(true)
    expect(db.select).not.toHaveBeenCalled()
  })

  it('returns false for missing project', async () => {
    const mockWhere = vi.fn().mockResolvedValueOnce([])
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: mockWhere,
        orderBy: vi.fn().mockResolvedValue([]),
      }),
    } as any)
    const result = await isProjectEnrolled('missing')
    expect(result).toBe(false)
  })

  it('returns false for disabled project', async () => {
    const row = makeProject('disabled-proj', false)
    const mockWhere = vi.fn().mockResolvedValueOnce([row])
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: mockWhere,
        orderBy: vi.fn().mockResolvedValue([]),
      }),
    } as any)
    const result = await isProjectEnrolled('disabled-proj')
    expect(result).toBe(false)
  })

  it('__resetProjectsCacheForTests clears all cache entries', async () => {
    const row = makeProject('alpha', true)
    const mockWhere = vi.fn().mockResolvedValue([row])
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: mockWhere,
        orderBy: vi.fn().mockResolvedValue([]),
      }),
    } as any)

    await isProjectEnrolled('alpha')
    __resetProjectsCacheForTests()
    vi.clearAllMocks()

    const mockWhere2 = vi.fn().mockResolvedValueOnce([row])
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: mockWhere2,
        orderBy: vi.fn().mockResolvedValue([]),
      }),
    } as any)
    await isProjectEnrolled('alpha')
    expect(mockWhere2).toHaveBeenCalledTimes(1)
  })
})

// ============================================================================
// enrollProject
// ============================================================================

describe('enrollProject', () => {
  beforeEach(() => {
    __resetProjectsCacheForTests()
    vi.clearAllMocks()
  })

  it('inserts a project with enabled=true and writes audit', async () => {
    const project = makeProject('alpha', true)
    const mockReturning = vi.fn().mockResolvedValueOnce([project])
    const mockValues = vi.fn().mockReturnValue({ returning: mockReturning })
    vi.mocked(db.insert).mockReturnValueOnce({ values: mockValues } as any)
    vi.mocked(writeAudit).mockResolvedValueOnce(undefined)

    const result = await enrollProject('alpha', 'Alpha Service', 'user-1')
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'alpha', enabled: true }),
    )
    expect(writeAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'project.enrolled' }),
    )
    expect(result).toMatchObject({ slug: 'alpha', enabled: true })
  })

  it('normalizes slug before insert', async () => {
    const project = makeProject('alpha', true)
    const mockReturning = vi.fn().mockResolvedValueOnce([project])
    const mockValues = vi.fn().mockReturnValue({ returning: mockReturning })
    vi.mocked(db.insert).mockReturnValueOnce({ values: mockValues } as any)
    vi.mocked(writeAudit).mockResolvedValueOnce(undefined)

    await enrollProject('Alpha', 'Alpha Service', 'user-1')
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'alpha' }),
    )
  })

  it('throws on empty slug before DB call', async () => {
    await expect(enrollProject('', 'Alpha', 'user-1')).rejects.toThrow()
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('propagates DB conflict error on duplicate slug', async () => {
    const mockReturning = vi.fn().mockRejectedValueOnce(new Error('duplicate key value violates unique constraint'))
    const mockValues = vi.fn().mockReturnValue({ returning: mockReturning })
    vi.mocked(db.insert).mockReturnValueOnce({ values: mockValues } as any)

    await expect(enrollProject('alpha', 'Alpha', 'user-1')).rejects.toThrow()
  })
})

// ============================================================================
// listProjects
// ============================================================================

describe('listProjects', () => {
  beforeEach(() => {
    __resetProjectsCacheForTests()
    vi.clearAllMocks()
  })

  it('returns all projects', async () => {
    const rows = [makeProject('beta'), makeProject('alpha')]
    const mockOrderBy = vi.fn().mockResolvedValue(rows)
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        orderBy: mockOrderBy,
        where: vi.fn().mockResolvedValue([]),
      }),
    } as any)

    const result = await listProjects()
    expect(result).toEqual(rows)
    expect(mockOrderBy).toHaveBeenCalledTimes(1)
  })
})

// ============================================================================
// disableProject
// ============================================================================

describe('disableProject', () => {
  beforeEach(() => {
    __resetProjectsCacheForTests()
    vi.clearAllMocks()
  })

  it('updates enabled=false and writes audit', async () => {
    const mockWhere = vi.fn().mockResolvedValueOnce([{ slug: 'alpha' }])
    const mockSet = vi.fn().mockReturnValue({ where: mockWhere })
    vi.mocked(db.update).mockReturnValueOnce({ set: mockSet } as any)
    vi.mocked(writeAudit).mockResolvedValueOnce(undefined)

    await disableProject('alpha', 'user-1')

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false }),
    )
    expect(writeAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'project.disabled' }),
    )
  })
})

// ============================================================================
// enableProject
// ============================================================================

describe('enableProject', () => {
  beforeEach(() => {
    __resetProjectsCacheForTests()
    vi.clearAllMocks()
  })

  it('updates enabled=true and writes audit', async () => {
    const mockWhere = vi.fn().mockResolvedValueOnce([{ slug: 'alpha' }])
    const mockSet = vi.fn().mockReturnValue({ where: mockWhere })
    vi.mocked(db.update).mockReturnValueOnce({ set: mockSet } as any)
    vi.mocked(writeAudit).mockResolvedValueOnce(undefined)

    await enableProject('alpha', 'user-1')

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true }),
    )
    expect(writeAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'project.enabled' }),
    )
  })
})

// ============================================================================
// deleteProject
// ============================================================================

describe('deleteProject', () => {
  beforeEach(() => {
    __resetProjectsCacheForTests()
    vi.clearAllMocks()
  })

  it('writes audit then hard deletes the project', async () => {
    const mockWhere = vi.fn().mockResolvedValueOnce(undefined)
    vi.mocked(db.delete).mockReturnValueOnce({ where: mockWhere } as any)
    vi.mocked(writeAudit).mockResolvedValueOnce(undefined)

    await deleteProject('alpha', 'user-1')

    expect(writeAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'project.deleted' }),
    )
    expect(mockWhere).toHaveBeenCalledTimes(1)
  })
})

// ============================================================================
// checkProjectsEnrolled
// ============================================================================

describe('checkProjectsEnrolled', () => {
  beforeEach(() => {
    __resetProjectsCacheForTests()
    vi.clearAllMocks()
  })

  it('returns ok: true when all slugs are enrolled and enabled', async () => {
    const rows = [makeProject('alpha', true), makeProject('beta', true)]
    const mockWhere = vi.fn().mockResolvedValueOnce(rows)
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: mockWhere,
        orderBy: vi.fn().mockResolvedValue([]),
      }),
    } as any)

    const result = await checkProjectsEnrolled(['alpha', 'beta'])
    expect(result).toEqual({ ok: true })
  })

  it('returns ok: false with missing when slug not found', async () => {
    const rows = [makeProject('alpha', true)]
    const mockWhere = vi.fn().mockResolvedValueOnce(rows)
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: mockWhere,
        orderBy: vi.fn().mockResolvedValue([]),
      }),
    } as any)

    const result = await checkProjectsEnrolled(['alpha', 'unknown'])
    expect(result).toMatchObject({ ok: false })
    if (!result.ok) {
      expect(result.missing).toContain('unknown')
    }
  })

  it('returns ok: false with missing when slug is disabled', async () => {
    const rows = [makeProject('alpha', false)]
    const mockWhere = vi.fn().mockResolvedValueOnce(rows)
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: mockWhere,
        orderBy: vi.fn().mockResolvedValue([]),
      }),
    } as any)

    const result = await checkProjectsEnrolled(['alpha'])
    expect(result).toMatchObject({ ok: false })
    if (!result.ok) {
      expect(result.missing).toContain('alpha')
    }
  })

  it('normalizes case variants before lookup', async () => {
    const rows = [makeProject('alpha', true)]
    const mockWhere = vi.fn().mockResolvedValueOnce(rows)
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: mockWhere,
        orderBy: vi.fn().mockResolvedValue([]),
      }),
    } as any)

    const result = await checkProjectsEnrolled(['ALPHA'])
    expect(result).toEqual({ ok: true })
  })
})
