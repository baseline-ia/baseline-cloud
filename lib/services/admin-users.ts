import { count, desc, ilike, or } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { users } from '@/lib/db/schema'

export const ADMIN_USER_PAGE_SIZE = 50

export interface AdminUserListParams {
  search: string
  page: number
}

export interface AdminUserList {
  rows: Array<{
    id: string
    username: string
    email: string
    role: 'admin' | 'member'
    enabled: boolean
    createdAt: Date
    lastLoginAt: Date | null
  }>
  total: number
  page: number
  totalPages: number
}

type SearchParams = Record<string, string | string[] | undefined>

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export function parseAdminUserListParams(params: SearchParams): AdminUserListParams {
  const search = firstParam(params.q)?.trim() ?? ''
  const parsedPage = Number.parseInt(firstParam(params.page) ?? '1', 10)

  return {
    search,
    page: Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1,
  }
}

function userListWhere(search: string) {
  if (!search) return undefined

  const searchPattern = `%${search}%`
  return or(ilike(users.username, searchPattern), ilike(users.email, searchPattern))
}

export async function listAdminUsers(params: AdminUserListParams): Promise<AdminUserList> {
  const where = userListWhere(params.search)
  const countRows = await db.select({ total: count() }).from(users).where(where)

  const total = Number(countRows[0]?.total ?? 0)
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_USER_PAGE_SIZE))
  const page = Math.min(params.page, totalPages)

  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      role: users.role,
      enabled: users.enabled,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
    })
    .from(users)
    .where(where)
    .orderBy(desc(users.createdAt))
    .limit(ADMIN_USER_PAGE_SIZE)
    .offset((page - 1) * ADMIN_USER_PAGE_SIZE)

  return { rows, total, page, totalPages }
}
