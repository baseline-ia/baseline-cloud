import { getDeveloperStats } from '@/lib/services/metrics';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

function relativeTime(date: Date | null): string {
  if (!date) return 'never';
  const now = Date.now();
  const diffMs = now - new Date(date).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 30) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths} month${diffMonths !== 1 ? 's' : ''} ago`;
}

function errorRateBadge(rate: number) {
  let bg: string;
  let color: string;

  if (rate > 10) {
    bg = 'var(--danger-soft)';
    color = 'var(--danger)';
  } else if (rate >= 5) {
    bg = 'var(--warning-soft)';
    color = 'var(--warning)';
  } else {
    bg = 'var(--success-soft)';
    color = 'var(--success)';
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
        background: bg,
        color,
      }}
    >
      {rate.toFixed(1)}%
    </span>
  );
}

export default async function DevelopersPage() {
  const devs = await getDeveloperStats();

  return (
    <div>
      <div className="page-header">
        <h1>Developers</h1>
        <p className="subtitle">Activity and stats for the last 30 days</p>
      </div>

      <div
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--cl-radius)',
          boxShadow: 'var(--shadow-sm)',
          overflow: 'hidden',
        }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Developer</TableHead>
              <TableHead style={{ textAlign: 'right' }}>Events (30d)</TableHead>
              <TableHead>Last Seen</TableHead>
              <TableHead>Top Commands</TableHead>
              <TableHead style={{ textAlign: 'center' }}>Error Rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {devs.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  style={{
                    textAlign: 'center',
                    padding: '3rem',
                    color: 'var(--text-muted)',
                    fontSize: '0.9375rem',
                  }}
                >
                  No developer activity recorded yet.
                </TableCell>
              </TableRow>
            )}
            {devs.map((dev) => (
              <TableRow key={dev.username}>
                <TableCell>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--cl-primary), #8b5cf6)',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 600,
                        fontSize: '0.8125rem',
                        flexShrink: 0,
                      }}
                    >
                      {dev.username.charAt(0).toUpperCase()}
                    </div>
                    <span
                      style={{
                        fontWeight: 500,
                        fontSize: '0.9375rem',
                        color: 'var(--text)',
                      }}
                    >
                      {dev.username}
                    </span>
                  </div>
                </TableCell>
                <TableCell
                  style={{
                    textAlign: 'right',
                    fontSize: '0.9375rem',
                    fontWeight: 600,
                    color: 'var(--text)',
                  }}
                >
                  {dev.totalEvents.toLocaleString()}
                </TableCell>
                <TableCell
                  style={{
                    fontSize: '0.9375rem',
                    color: 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {relativeTime(dev.lastSeenAt)}
                </TableCell>
                <TableCell
                  style={{
                    fontSize: '0.8125rem',
                    color: 'var(--text-muted)',
                    maxWidth: '260px',
                  }}
                >
                  {dev.topCommands.map((c) => c.eventType).join(', ') || '–'}
                </TableCell>
                <TableCell style={{ textAlign: 'center' }}>
                  {errorRateBadge(dev.errorRate)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
