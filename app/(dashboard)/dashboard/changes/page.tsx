import { GitMerge } from 'lucide-react';
import { listChangesPage, parseChangesParams } from '@/lib/services/metrics';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

function formatMin(min: number | null): string {
  if (min === null || min === undefined) return '–';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

const WORK_TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  feature: { bg: 'var(--cl-primary-soft)', color: 'var(--cl-primary)' },
  fix: { bg: 'var(--danger-soft)', color: 'var(--danger)' },
  migration: { bg: 'var(--warning-soft)', color: 'var(--warning)' },
  refactor: { bg: 'var(--info-soft)', color: 'var(--info)' },
  docs: { bg: 'var(--bg-subtle)', color: 'var(--text-muted)' },
  chore: { bg: 'var(--bg-subtle)', color: 'var(--text-muted)' },
  'new-project': { bg: 'var(--success-soft)', color: 'var(--success)' },
};

function workTypeBadge(workType: string) {
  const c = WORK_TYPE_COLORS[workType] ?? { bg: 'var(--bg-subtle)', color: 'var(--text-muted)' };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.125rem 0.5rem',
        borderRadius: '999px',
        fontSize: '0.75rem',
        fontWeight: 600,
        background: c.bg,
        color: c.color,
        whiteSpace: 'nowrap',
      }}
    >
      {workType}
    </span>
  );
}

function statusBadge(closed: boolean) {
  if (closed) {
    return (
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
        Closed
      </span>
    );
  }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.125rem 0.5rem',
        borderRadius: '999px',
        fontSize: '0.75rem',
        fontWeight: 600,
        background: 'var(--bg-subtle)',
        color: 'var(--text-muted)',
      }}
    >
      Open
    </span>
  );
}

function roiColor(pct: number | null): string {
  if (pct === null) return 'var(--text-muted)';
  if (pct >= 50) return 'var(--success)';
  if (pct >= 20) return 'var(--warning)';
  return 'var(--text-muted)';
}

export default async function ChangesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const listParams = parseChangesParams(await searchParams);
  const changeList = await listChangesPage(listParams);
  const { rows: changes, total, closed, open, page, totalPages } = changeList;

  function changesListHref(nextPage: number) {
    const params = new URLSearchParams();
    if (listParams.search) params.set('q', listParams.search);
    if (nextPage > 1) params.set('page', String(nextPage));
    const query = params.toString();
    return `/dashboard/changes${query ? `?${query}` : ''}`;
  }

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <GitMerge size={22} />
          Changes &amp; ROI
        </h1>
        <p className="subtitle">Track time saved across all development changes</p>
      </div>

      {/* Summary bar */}
      <div
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--cl-radius)',
          padding: '0.875rem 1.5rem',
          marginBottom: '1.5rem',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          gap: '2rem',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        {[
          { label: 'Total', value: total, color: 'var(--text)' },
          { label: 'Closed', value: closed, color: 'var(--success)' },
          { label: 'Open', value: open, color: 'var(--info)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'baseline', gap: '0.375rem' }}>
            <span style={{ fontSize: '1.375rem', fontWeight: 700, color }}>{value}</span>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Table */}
      <div
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--cl-radius)',
          boxShadow: 'var(--shadow-sm)',
          overflow: 'hidden',
        }}
      >
        <form method="get" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', padding: '1.25rem 1.5rem' }}>
          <label htmlFor="changes-search" style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)' }}>
            Search
          </label>
          <input
            id="changes-search"
            name="q"
            type="search"
            defaultValue={listParams.search}
            placeholder="Project, change name, or developer"
            aria-label="Search changes"
            style={{ height: '36px', padding: '0 0.75rem', border: '1px solid var(--border-color)', borderRadius: 'var(--cl-radius-sm)', fontSize: '0.9375rem', color: 'var(--text)', background: 'var(--bg-subtle)', width: 'min(100%, 360px)' }}
          />
          <input type="hidden" name="page" value="1" />
          <button type="submit" style={{ height: '36px', padding: '0 1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--cl-radius-sm)', background: 'var(--bg-subtle)', color: 'var(--text)', fontWeight: 600, cursor: 'pointer' }}>
            Search
          </button>
        </form>
        <Table>
          <TableHeader>
            <TableRow style={{ borderBottom: '1px solid var(--border-color)' }}>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead style={{ textAlign: 'right' }}>Duration</TableHead>
              <TableHead style={{ textAlign: 'right' }}>Saved</TableHead>
              <TableHead style={{ textAlign: 'right' }}>ROI</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {changes.length === 0 && (
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
                  No changes recorded yet.
                </TableCell>
              </TableRow>
            )}
            {changes.map((c) => (
              <TableRow key={`${c.changeName}-${String(c.openedAt)}`}>
                <TableCell>
                  <div>
                    <code
                      style={{
                        fontFamily: 'var(--font-jetbrains-mono), monospace',
                        fontSize: '0.8125rem',
                        color: 'var(--cl-primary)',
                        background: 'var(--cl-primary-soft)',
                        padding: '0.125rem 0.375rem',
                        borderRadius: '4px',
                      }}
                    >
                      {c.changeName}
                    </code>
                    {c.title && (
                      <p
                        style={{
                          margin: '0.25rem 0 0',
                          fontSize: '0.8125rem',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {c.title}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell>{workTypeBadge(c.workType)}</TableCell>
                <TableCell>{statusBadge(c.closedAt !== null)}</TableCell>
                <TableCell style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.9375rem' }}>
                  {formatMin(c.actualMin)}
                </TableCell>
                <TableCell
                  style={{
                    textAlign: 'right',
                    fontWeight: c.savedMin !== null && c.savedMin > 0 ? 600 : 400,
                    color: c.savedMin !== null && c.savedMin > 0 ? 'var(--success)' : 'var(--text-muted)',
                    fontSize: '0.9375rem',
                  }}
                >
                  {formatMin(c.savedMin)}
                </TableCell>
                <TableCell
                  style={{
                    textAlign: 'right',
                    fontWeight: c.roiPct !== null ? 600 : 400,
                    color: roiColor(c.roiPct),
                    fontSize: '0.9375rem',
                  }}
                >
                  {c.roiPct !== null ? `${c.roiPct}%` : '–'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          <span>{total} change{total === 1 ? '' : 's'} · Page {page} of {totalPages}</span>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {page > 1 && <a href={changesListHref(page - 1)} style={{ color: 'var(--cl-primary)', textDecoration: 'none' }}>Previous</a>}
            {page < totalPages && <a href={changesListHref(page + 1)} style={{ color: 'var(--cl-primary)', textDecoration: 'none' }}>Next</a>}
          </div>
        </div>
      </div>
    </div>
  );
}
