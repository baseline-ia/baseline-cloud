import { UserCog } from 'lucide-react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { resolveSession } from '@/lib/auth'
import { listAdminUsers, parseAdminUserListParams } from '@/lib/services/admin-users'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { CreateUserForm } from './create-user-form'

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--cl-radius)',
  padding: '1.25rem 1.5rem',
  boxShadow: 'var(--shadow-sm)',
}

function roleBadge(role: 'admin' | 'member') {
  const isAdmin = role === 'admin'
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.125rem 0.5rem',
        borderRadius: '999px',
        fontSize: '0.75rem',
        fontWeight: 600,
        background: isAdmin
          ? 'color-mix(in srgb, var(--cl-primary) 12%, transparent)'
          : 'var(--bg-subtle)',
        color: isAdmin ? 'var(--cl-primary)' : 'var(--text-muted)',
        border: isAdmin
          ? '1px solid color-mix(in srgb, var(--cl-primary) 25%, transparent)'
          : '1px solid var(--border-color)',
      }}
    >
      {role}
    </span>
  )
}

function statusBadge(enabled: boolean) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.125rem 0.5rem',
        borderRadius: '999px',
        fontSize: '0.75rem',
        fontWeight: 600,
        background: enabled ? 'var(--success-soft)' : 'var(--danger-soft)',
        color: enabled ? 'var(--success)' : 'var(--danger)',
      }}
    >
      {enabled ? 'Active' : 'Disabled'}
    </span>
  )
}

function userListHref(search: string, page: number) {
  const params = new URLSearchParams()
  if (search) params.set('q', search)
  if (page > 1) params.set('page', String(page))
  const query = params.toString()
  return `/dashboard/admin/users${query ? `?${query}` : ''}`
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const cookieStore = await cookies()
  const session = await resolveSession(cookieStore.get('baseline_dashboard_session')?.value)
  if (!session || session.role !== 'admin') redirect('/dashboard')

  const listParams = parseAdminUserListParams(await searchParams)
  const userList = await listAdminUsers(listParams)
  const { rows, total, page, totalPages } = userList

  return (
    <div>
      <div className="page-header">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <UserCog size={22} />
          Users
        </h1>
        <p className="subtitle">Manage dashboard and CLI access for your team.</p>
      </div>

      {/* Create user accordion */}
      <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
        <details>
          <summary
            style={{
              cursor: 'pointer',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'var(--cl-primary)',
              listStyle: 'none',
            }}
          >
            <span
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                background: 'color-mix(in srgb, var(--cl-primary) 12%, transparent)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1rem',
                lineHeight: 1,
                flexShrink: 0,
              }}
            >
              +
            </span>
            Create new user
          </summary>
          <CreateUserForm />
        </details>
      </div>

      {/* Users table */}
      <div
        style={{
          ...cardStyle,
          padding: 0,
          overflow: 'hidden',
        }}
      >
        <form method="get" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', padding: '1.25rem 1.5rem' }}>
          <label htmlFor="user-search" style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)' }}>
            Search
          </label>
          <input
            id="user-search"
            name="q"
            type="search"
            defaultValue={listParams.search}
            placeholder="Username or email"
            aria-label="Search users"
            style={{ height: '36px', padding: '0 0.75rem', border: '1px solid var(--border-color)', borderRadius: 'var(--cl-radius-sm)', fontSize: '0.9375rem', color: 'var(--text)', background: 'var(--bg-subtle)', width: 'min(100%, 360px)' }}
          />
          <input type="hidden" name="page" value="1" />
          <button type="submit" style={{ height: '36px', padding: '0 1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--cl-radius-sm)', background: 'var(--bg-subtle)', color: 'var(--text)', fontWeight: 600, cursor: 'pointer' }}>
            Search
          </button>
        </form>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Last Login</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  style={{
                    textAlign: 'center',
                    padding: '3rem',
                    color: 'var(--text-muted)',
                    fontSize: '0.9375rem',
                  }}
                >
                  {listParams.search ? `No users match “${listParams.search}”.` : 'No users found.'}
                </TableCell>
              </TableRow>
            )}
            {rows.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--cl-primary), #8b5cf6)',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        flexShrink: 0,
                      }}
                    >
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                    <span
                      style={{
                        fontWeight: 500,
                        fontSize: '0.9375rem',
                        color: 'var(--text)',
                      }}
                    >
                      {user.username}
                    </span>
                  </div>
                </TableCell>
                <TableCell style={{ fontSize: '0.9375rem', color: 'var(--text-muted)' }}>
                  {user.email}
                </TableCell>
                <TableCell>{roleBadge(user.role)}</TableCell>
                <TableCell>{statusBadge(user.enabled)}</TableCell>
                <TableCell
                  style={{ fontSize: '0.875rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}
                >
                  {new Date(user.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell
                  style={{ fontSize: '0.875rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}
                >
                  {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : '–'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          <span>{total} user{total === 1 ? '' : 's'} · Page {page} of {totalPages}</span>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {page > 1 && <a href={userListHref(listParams.search, page - 1)} style={{ color: 'var(--cl-primary)', textDecoration: 'none' }}>Previous</a>}
            {page < totalPages && <a href={userListHref(listParams.search, page + 1)} style={{ color: 'var(--cl-primary)', textDecoration: 'none' }}>Next</a>}
          </div>
        </div>
      </div>
    </div>
  )
}
