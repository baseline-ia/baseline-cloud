import { and, count, desc, eq, ilike, isNotNull, isNull, or } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { tokens, users } from '@/lib/db/schema'

export const ADMIN_TOKEN_PAGE_SIZE = 50

export type AdminTokenTab = 'active' | 'revoked'

export interface AdminTokenListParams {
  tab: AdminTokenTab
  search: string
  page: number
}

export interface AdminTokenList {
  rows: Array<{
    id: string
    name: string
    username: string | null
    tokenPrefix: string
    createdAt: Date
    lastUsedAt: Date | null
    revokedAt: Date | null
  }>
  total: number
  page: number
  totalPages: number
}

type SearchParams = Record<string, string | string[] | undefined>

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export function parseAdminTokenListParams(params: SearchParams): AdminTokenListParams {
  const tab = firstParam(params.tab) === 'revoked' ? 'revoked' : 'active'
  const search = firstParam(params.q)?.trim() ?? ''
  const parsedPage = Number.parseInt(firstParam(params.page) ?? '1', 10)

  return {
    tab,
    search,
    page: Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1,
  }
}

function tokenListWhere({ tab, search }: Pick<AdminTokenListParams, 'tab' | 'search'>) {
  const statusPredicate = tab === 'active' ? isNull(tokens.revokedAt) : isNotNull(tokens.revokedAt)
  if (!search) return statusPredicate

  const searchPattern = `%${search}%`
  return and(
    statusPredicate,
    or(
      ilike(tokens.name, searchPattern),
      ilike(tokens.tokenPrefix, searchPattern),
      ilike(users.username, searchPattern),
    ),
  )
}

export async function listAdminTokens(params: AdminTokenListParams): Promise<AdminTokenList> {
  const where = tokenListWhere(params)
  const countRows = await db
    .select({ total: count() })
    .from(tokens)
    .leftJoin(users, eq(tokens.userId, users.id))
    .where(where)

  const total = Number(countRows[0]?.total ?? 0)
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_TOKEN_PAGE_SIZE))
  const page = Math.min(params.page, totalPages)

  const rows = await db
    .select({
      id: tokens.id,
      name: tokens.name,
      username: users.username,
      tokenPrefix: tokens.tokenPrefix,
      createdAt: tokens.createdAt,
      lastUsedAt: tokens.lastUsedAt,
      revokedAt: tokens.revokedAt,
    })
    .from(tokens)
    .leftJoin(users, eq(tokens.userId, users.id))
    .where(where)
    .orderBy(desc(tokens.createdAt))
    .limit(ADMIN_TOKEN_PAGE_SIZE)
    .offset((page - 1) * ADMIN_TOKEN_PAGE_SIZE)

  return { rows, total, page, totalPages }
}
