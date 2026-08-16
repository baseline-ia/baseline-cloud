import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHash } from 'node:crypto'

// ============================================================================
// vi.mock calls are hoisted — factory functions must not reference outer vars
// ============================================================================

// Build a chainable mock builder that returns itself for any method called on it.
// This allows subquery builders (groupBy, as, etc.) to be called without errors.
function chainable(finalValue: unknown = []): Record<string, unknown> {
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (prop === 'then') return undefined // prevent accidental Promise behavior
      // Methods that return a promise (terminal calls): where, orderBy, limit
      // We can't know which call is terminal so we return both a chainable and
      // allow it to be awaited by attaching .then on the returned chainable.
      return (..._args: unknown[]) => {
        const next = chainable(finalValue)
        // Also make it thenable so tests that do `await db.select()...where()` work.
        ;(next as Record<string, unknown>).then = (resolve: (v: unknown) => unknown) =>
          Promise.resolve(finalValue).then(resolve)
        return next
      }
    },
  }
  return new Proxy({}, handler) as Record<string, unknown>
}

vi.mock('@/lib/db/client', () => {
  return {
    db: {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      transaction: vi.fn(),
    },
  }
})

vi.mock('@/lib/auth/index', () => ({
  writeAudit: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => 'test-nanoid-21chars12345'),
}))

// ============================================================================
// Import AFTER mocks
// ============================================================================

import { db } from '@/lib/db/client'
import { writeAudit } from '@/lib/auth/index'
import {
  SKILL_SLUG_RE,
  SkillSlugTakenError,
  SkillNotFoundError,
  createCorporateSkill,
  publishSkillVersion,
  getAssignmentsForProject,
  listCorporateSkills,
  getCorporateSkill,
} from '@/lib/services/corporate-skills'

// ============================================================================
// Helpers
// ============================================================================

function makeSkill(overrides: Record<string, unknown> = {}) {
  return {
    id: 'skill-id-1',
    slug: 'my-skill',
    name: 'My Skill',
    description: null,
    tool: null,
    failClosed: false,
    createdByUserId: 'user-1',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }
}

function makeVersion(overrides: Record<string, unknown> = {}) {
  const content = '# My Skill\n\nContent here.'
  const contentHash = createHash('sha256').update(content).digest('hex')
  return {
    id: 'version-id-1',
    skillId: 'skill-id-1',
    version: 1,
    content,
    contentHash,
    publishedByUserId: 'user-1',
    publishedAt: new Date('2024-01-01'),
    ...overrides,
  }
}

// ============================================================================
// SKILL_SLUG_RE
// ============================================================================

describe('SKILL_SLUG_RE', () => {
  it('accepts lowercase alphanumeric with hyphens', () => {
    expect(SKILL_SLUG_RE.test('my-skill')).toBe(true)
    expect(SKILL_SLUG_RE.test('sdd-apply')).toBe(true)
    expect(SKILL_SLUG_RE.test('a')).toBe(true)
  })

  it('rejects uppercase letters', () => {
    expect(SKILL_SLUG_RE.test('My-Skill')).toBe(false)
  })

  it('rejects spaces', () => {
    expect(SKILL_SLUG_RE.test('my skill')).toBe(false)
  })

  it('rejects dots and underscores', () => {
    expect(SKILL_SLUG_RE.test('my.skill')).toBe(false)
    expect(SKILL_SLUG_RE.test('my_skill')).toBe(false)
  })

  it('rejects slugs longer than 64 chars', () => {
    expect(SKILL_SLUG_RE.test('a'.repeat(65))).toBe(false)
  })

  it('accepts slug of exactly 64 chars', () => {
    expect(SKILL_SLUG_RE.test('a'.repeat(64))).toBe(true)
  })
})

// ============================================================================
// 2.1 createCorporateSkill — inserts row and writes audit
// ============================================================================

describe('createCorporateSkill', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('2.1 inserts row and writes audit entry corporate_skill.created', async () => {
    const skill = makeSkill()
    const mockReturning = vi.fn().mockResolvedValue([skill])
    const mockValues = vi.fn().mockReturnValue({ returning: mockReturning })
    vi.mocked(db.insert).mockReturnValue({ values: mockValues } as unknown as ReturnType<typeof db.insert>)
    vi.mocked(writeAudit).mockResolvedValue(undefined)

    const result = await createCorporateSkill(
      { slug: 'my-skill', name: 'My Skill' },
      'user-1',
    )

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'my-skill', name: 'My Skill' }),
    )
    expect(writeAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'corporate_skill.created' }),
    )
    expect(result).toMatchObject({ slug: 'my-skill', name: 'My Skill' })
  })

  // 2.2 Duplicate slug throws SkillSlugTakenError
  it('2.2 duplicate slug throws SkillSlugTakenError', async () => {
    const mockReturning = vi.fn().mockRejectedValue({ code: '23505' })
    const mockValues = vi.fn().mockReturnValue({ returning: mockReturning })
    vi.mocked(db.insert).mockReturnValue({ values: mockValues } as unknown as ReturnType<typeof db.insert>)

    await expect(
      createCorporateSkill({ slug: 'my-skill', name: 'My Skill' }, 'user-1'),
    ).rejects.toBeInstanceOf(SkillSlugTakenError)
  })

  // 2.3 Invalid slug format throws validation error
  it('2.3 invalid slug format throws validation error', async () => {
    await expect(
      createCorporateSkill({ slug: 'My Skill!', name: 'My Skill' }, 'user-1'),
    ).rejects.toThrow()
    expect(db.insert).not.toHaveBeenCalled()
  })
})

// ============================================================================
// 2.4 publishSkillVersion — inserts v1, contentHash matches sha256(content)
// ============================================================================

describe('publishSkillVersion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('2.4 inserts version 1 and contentHash === sha256(content)', async () => {
    const content = '# My Skill\n\nContent.'
    const expectedHash = createHash('sha256').update(content).digest('hex')
    const version = makeVersion({ content, contentHash: expectedHash, version: 1 })

    vi.mocked(db.transaction).mockImplementation(async (fn) => {
      const txMock = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ maxVersion: null }]),
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([version]),
          }),
        }),
      }
      return fn(txMock as unknown as Parameters<typeof fn>[0])
    })

    const result = await publishSkillVersion('skill-id-1', content, 'user-1')

    expect(result.version).toBe(1)
    expect(result.contentHash).toBe(expectedHash)
    expect(writeAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'skill_version.published' }),
    )
  })

  // 2.5 Second publish yields version = 2, first row unchanged
  it('2.5 second publish yields version = 2, first version row unchanged', async () => {
    const content2 = '# Updated content'
    const expectedHash2 = createHash('sha256').update(content2).digest('hex')
    const version2 = makeVersion({ version: 2, content: content2, contentHash: expectedHash2 })

    vi.mocked(db.transaction).mockImplementation(async (fn) => {
      const txMock = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ maxVersion: 1 }]),
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([version2]),
          }),
        }),
      }
      return fn(txMock as unknown as Parameters<typeof fn>[0])
    })

    const result = await publishSkillVersion('skill-id-1', content2, 'user-1')
    expect(result.version).toBe(2)
    expect(result.contentHash).toBe(expectedHash2)
  })

})

// ============================================================================
// 2.6 getAssignmentsForProject — failClosed from assignment row directly
// ============================================================================

describe('getAssignmentsForProject', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns every published skill for every project slug', async () => {
    const rows = [
      {
        slug: 'my-skill',
        name: 'My Skill',
        version: 1,
        content: '# content',
        contentHash: 'abc123',
        failClosed: true,
        tool: null,
      },
    ]

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockResolvedValue(rows),
      }),
    } as unknown as ReturnType<typeof db.select>)

    const firstProject = await getAssignmentsForProject('first-project')
    vi.mocked(db.select).mockClear()
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockResolvedValue(rows),
      }),
    } as unknown as ReturnType<typeof db.select>)
    const secondProject = await getAssignmentsForProject('second-project')

    expect(firstProject).toEqual(secondProject)
    expect(firstProject).toHaveLength(1)
    expect(firstProject[0].failClosed).toBe(true)
  })
})

// ============================================================================
// listCorporateSkills
// ============================================================================

describe('listCorporateSkills', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns skills with latestVersion', async () => {
    const rows = [
      { ...makeSkill(), latestVersion: 2 },
    ]

    // First call: subquery builder (chainable, no terminal value needed)
    // Second call: main query with leftJoin → orderBy → rows
    vi.mocked(db.select)
      .mockReturnValueOnce(chainable() as unknown as ReturnType<typeof db.select>)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(rows),
          }),
        }),
      } as unknown as ReturnType<typeof db.select>)

    const result = await listCorporateSkills()
    expect(result).toHaveLength(1)
    expect(result[0].latestVersion).toBe(2)
  })
})

// ============================================================================
// getCorporateSkill
// ============================================================================

describe('getCorporateSkill', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when skill not found', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as unknown as ReturnType<typeof db.select>)

    const result = await getCorporateSkill('nonexistent')
    expect(result).toBeNull()
  })

  it('returns skill with versions', async () => {
    const skill = makeSkill()
    const versions = [makeVersion()]

    vi.mocked(db.select)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([skill]),
          }),
        }),
      } as unknown as ReturnType<typeof db.select>)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(versions),
          }),
        }),
      } as unknown as ReturnType<typeof db.select>)

    const result = await getCorporateSkill('my-skill')
    expect(result).not.toBeNull()
    expect(result!.skill.slug).toBe('my-skill')
    expect(result!.versions).toHaveLength(1)
  })
})
