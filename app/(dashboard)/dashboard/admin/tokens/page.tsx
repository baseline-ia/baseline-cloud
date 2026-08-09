import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { resolveSession } from '@/lib/auth'
import { db } from '@/lib/db/client'
import { tokens, users } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { revokeTokenAction } from './actions'
import { CreateTokenForm } from './create-token-form'

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--cl-radius)',
  padding: '1.25rem 1.5rem',
  boxShadow: 'var(--shadow-sm)',
}

export default async function TokensPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const cookieStore = await cookies()
  const session = await resolveSession(cookieStore.get('baseline_dashboard_session')?.value)
  if (!session || session.role !== 'admin') redirect('/dashboard')

  const params = await searchParams
  const newRawToken = params.token ?? null

  const rows = await db
    .select({
      token: tokens,
      username: users.username,
    })
    .from(tokens)
    .leftJoin(users, eq(tokens.userId, users.id))
    .orderBy(desc(tokens.createdAt))

  return (
    <div>
      <div className="page-header">
        <h1>API Tokens</h1>
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
            <code style={{ fontSize: '0.8125rem' }}>Authorization: Bearer &lt;token&gt;</code> header.
          </p>
        </div>
      )}

      {/* Create token accordion */}
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
          <CreateTokenForm />
        </details>
      </div>

      {/* Tokens table */}
      <div
        style={{
          ...cardStyle,
          padding: 0,
          overflow: 'hidden',
        }}
      >
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
                <TableCell
                  colSpan={7}
                  style={{
                    textAlign: 'center',
                    padding: '3rem',
                    color: 'var(--text-muted)',
                    fontSize: '0.9375rem',
                  }}
                >
                  No tokens yet.
                </TableCell>
              </TableRow>
            )}
            {rows.map(({ token, username }) => {
              const isActive = token.revokedAt === null
              return (
                <TableRow key={token.id}>
                  <TableCell style={{ fontWeight: 500, color: 'var(--text)' }}>
                    {token.name}
                  </TableCell>
                  <TableCell style={{ color: 'var(--text-muted)', fontSize: '0.9375rem' }}>
                    {username ?? '–'}
                  </TableCell>
                  <TableCell>
                    <code
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '0.8125rem',
                        background: 'var(--bg-subtle)',
                        padding: '0.125rem 0.375rem',
                        borderRadius: '4px',
                      }}
                    >
                      {token.tokenPrefix}
                    </code>
                  </TableCell>
                  <TableCell
                    style={{ fontSize: '0.875rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}
                  >
                    {new Date(token.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell
                    style={{ fontSize: '0.875rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}
                  >
                    {token.lastUsedAt ? new Date(token.lastUsedAt).toLocaleDateString() : '–'}
                  </TableCell>
                  <TableCell>
                    {isActive ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '0.125rem 0.5rem',
                          borderRadius: '999px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          background: 'var(--success-soft)',
                          color: 'var(--success)',
                        }}
                      >
                        Active
                      </span>
                    ) : (
                      <span
                        style={{
                          display: 'inline-flex',
                          flexDirection: 'column',
                          gap: '0.125rem',
                        }}
                      >
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '0.125rem 0.5rem',
                            borderRadius: '999px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            background: 'var(--danger-soft)',
                            color: 'var(--danger)',
                          }}
                        >
                          Revoked
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {new Date(token.revokedAt!).toLocaleDateString()}
                        </span>
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {isActive && (
                      <form action={revokeTokenAction}>
                        <input type="hidden" name="tokenId" value={token.id} />
                        <button
                          type="submit"
                          style={{
                            padding: '0.25rem 0.625rem',
                            fontSize: '0.8125rem',
                            fontWeight: 500,
                            color: 'var(--danger)',
                            background: 'var(--danger-soft)',
                            border: '1px solid color-mix(in srgb, var(--danger) 20%, transparent)',
                            borderRadius: 'var(--cl-radius-sm)',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Revoke
                        </button>
                      </form>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
