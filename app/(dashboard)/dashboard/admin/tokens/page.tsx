import { KeyRound } from 'lucide-react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { resolveSession } from '@/lib/auth'
import {
  listAdminTokens,
  parseAdminTokenListParams,
} from '@/lib/services/admin-tokens'
import { revokeTokenAction } from './actions'
import { CreateTokenForm } from './create-token-form'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--cl-radius)',
  padding: '1.25rem 1.5rem',
  boxShadow: 'var(--shadow-sm)',
}

function tokenListHref(tab: string, search: string, page: number) {
  const params = new URLSearchParams()
  if (tab !== 'active') params.set('tab', tab)
  if (search) params.set('q', search)
  if (page > 1) params.set('page', String(page))
  const query = params.toString()
  return `/dashboard/admin/tokens${query ? `?${query}` : ''}`
}

export default async function TokensPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const cookieStore = await cookies()
  const session = await resolveSession(cookieStore.get('baseline_dashboard_session')?.value)
  if (!session || session.role !== 'admin') redirect('/dashboard')

  const params = await searchParams
  const newRawToken = Array.isArray(params.token) ? params.token[0] : params.token ?? null
  const listParams = parseAdminTokenListParams(params)
  const tokenList = await listAdminTokens(listParams)
  const { rows, total, page, totalPages } = tokenList
  const hasSearch = Boolean(listParams.search)
  const emptyMessage = hasSearch
    ? `No ${listParams.tab} tokens match “${listParams.search}”.`
    : listParams.tab === 'active'
      ? 'No active tokens yet.'
      : 'No revoked tokens yet.'

  return (
    <div>
      <div className="page-header">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <KeyRound size={22} />
          API Tokens
        </h1>
        <p className="subtitle">Manage bearer tokens for CLI authentication.</p>
      </div>

      {newRawToken && (
        <div
          style={{
            background: 'var(--success-soft)',
            border: '1px solid var(--success)',
            borderRadius: 'var(--cl-radius-sm)',
            padding: '1rem 1.25rem',
            marginBottom: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <p style={{ fontWeight: 600, color: 'var(--success)', margin: 0 }}>
            Token created — copy it now. It will never be shown again.
          </p>
          <code
            style={{
              display: 'block',
              background: 'rgba(0,0,0,0.06)',
              borderRadius: '6px',
              padding: '0.5rem 0.75rem',
              fontSize: '0.8125rem',
              wordBreak: 'break-all',
              color: 'var(--text)',
              userSelect: 'all',
            }}
          >
            {newRawToken}
          </code>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>
            Use this token in the{' '}
            <code style={{ fontSize: '0.8125rem' }}>Authorization: Bearer &lt;token&gt;</code>{' '}
            header. Older tokens cannot be recovered; identify them by prefix and metadata, then revoke and replace them if needed.
          </p>
        </div>
      )}

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
            Create new token
          </summary>
          <CreateTokenForm tab={listParams.tab} search={listParams.search} page={page} />
        </details>
      </div>

      <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem 1.5rem 0' }}>
          <nav aria-label="Token status" style={{ display: 'flex', gap: '1.25rem', borderBottom: '1px solid var(--border-color)' }}>
            {(['active', 'revoked'] as const).map((tab) => (
              <a
                key={tab}
                href={tokenListHref(tab, listParams.search, 1)}
                aria-current={listParams.tab === tab ? 'page' : undefined}
                style={{
                  padding: '0 0 0.75rem',
                  color: listParams.tab === tab ? 'var(--cl-primary)' : 'var(--text-muted)',
                  borderBottom: listParams.tab === tab ? '2px solid var(--cl-primary)' : '2px solid transparent',
                  textDecoration: 'none',
                  fontWeight: 600,
                  textTransform: 'capitalize',
                }}
              >
                {tab}
              </a>
            ))}
          </nav>
          <form method="get" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', padding: '1rem 0' }}>
            <input type="hidden" name="tab" value={listParams.tab} />
            <input type="hidden" name="page" value="1" />
            <label htmlFor="token-search" style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)' }}>
              Search
            </label>
            <input
              id="token-search"
              name="q"
              type="search"
              defaultValue={listParams.search}
              placeholder="Name, prefix, or username"
              aria-label="Search tokens"
              style={{ height: '36px', padding: '0 0.75rem', border: '1px solid var(--border-color)', borderRadius: 'var(--cl-radius-sm)', fontSize: '0.9375rem', color: 'var(--text)', background: 'var(--bg-subtle)', width: 'min(100%, 360px)' }}
            />
            <button type="submit" style={{ height: '36px', padding: '0 1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--cl-radius-sm)', background: 'var(--bg-subtle)', color: 'var(--text)', fontWeight: 600, cursor: 'pointer' }}>
              Search
            </button>
          </form>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Prefix</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Last Used</TableHead>
              <TableHead>Status</TableHead>
              <TableHead style={{ width: '1px' }} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: '0.9375rem' }}>
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
            {rows.map((token) => {
              const isActive = token.revokedAt === null
              return (
                <TableRow key={token.id}>
                  <TableCell style={{ fontWeight: 500, color: 'var(--text)' }}>{token.name}</TableCell>
                  <TableCell style={{ color: 'var(--text-muted)', fontSize: '0.9375rem' }}>{token.username ?? '–'}</TableCell>
                  <TableCell><code style={{ fontFamily: 'monospace', fontSize: '0.8125rem', background: 'var(--bg-subtle)', padding: '0.125rem 0.375rem', borderRadius: '4px' }}>{token.tokenPrefix}</code></TableCell>
                  <TableCell style={{ fontSize: '0.875rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{new Date(token.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell style={{ fontSize: '0.875rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{token.lastUsedAt ? new Date(token.lastUsedAt).toLocaleDateString() : '–'}</TableCell>
                  <TableCell>
                    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.125rem 0.5rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600, background: isActive ? 'var(--success-soft)' : 'var(--danger-soft)', color: isActive ? 'var(--success)' : 'var(--danger)' }}>
                      {isActive ? 'Active' : 'Revoked'}
                    </span>
                    {!isActive && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(token.revokedAt!).toLocaleDateString()}</div>}
                  </TableCell>
                  <TableCell>
                    {isActive && <form action={revokeTokenAction}><input type="hidden" name="tokenId" value={token.id} /><button type="submit" style={{ padding: '0.25rem 0.625rem', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--danger)', background: 'var(--danger-soft)', border: '1px solid color-mix(in srgb, var(--danger) 20%, transparent)', borderRadius: 'var(--cl-radius-sm)', cursor: 'pointer', whiteSpace: 'nowrap' }}>Revoke</button></form>}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          <span>{total} {listParams.tab} token{total === 1 ? '' : 's'} · Page {page} of {totalPages}</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {page > 1 && <a href={tokenListHref(listParams.tab, listParams.search, page - 1)} style={{ color: 'var(--cl-primary)', textDecoration: 'none' }}>Previous</a>}
            {page < totalPages && <a href={tokenListHref(listParams.tab, listParams.search, page + 1)} style={{ color: 'var(--cl-primary)', textDecoration: 'none' }}>Next</a>}
          </div>
        </div>
      </div>
    </div>
  )
}
