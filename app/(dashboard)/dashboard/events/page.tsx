import { Radio } from 'lucide-react';
import { getRecentEvents } from '@/lib/services/metrics';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

function formatDateTime(date: Date): string {
  const d = new Date(date);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function abbreviatePayload(payload: Record<string, unknown>): string {
  try {
    const str = JSON.stringify(payload);
    if (str.length <= 80) return str;
    return str.slice(0, 77) + '…';
  } catch {
    return '';
  }
}

function eventTypeBadge(eventType: string) {
  let bg: string;
  let color: string;

  if (eventType.startsWith('change.')) {
    bg = 'var(--cl-primary-soft)';
    color = 'var(--cl-primary)';
  } else if (eventType.startsWith('skill.')) {
    bg = 'var(--success-soft)';
    color = 'var(--success)';
  } else if (eventType.startsWith('error') || eventType.includes('fail')) {
    bg = 'var(--danger-soft)';
    color = 'var(--danger)';
  } else {
    bg = 'var(--bg-subtle)';
    color = 'var(--text-muted)';
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.125rem 0.5rem',
        borderRadius: 'var(--cl-radius-sm)',
        fontSize: '0.75rem',
        fontWeight: 500,
        background: bg,
        color,
        fontFamily: 'var(--font-jetbrains-mono), monospace',
        whiteSpace: 'nowrap',
      }}
    >
      {eventType}
    </span>
  );
}

export default async function EventsPage() {
  const evts = await getRecentEvents(200);

  return (
    <div>
      <div className="page-header">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Radio size={22} />
          Events
        </h1>
        <p className="subtitle">Raw event log — last 200 events</p>
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
              <TableHead>Type</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Payload</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {evts.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  style={{
                    textAlign: 'center',
                    padding: '3rem',
                    color: 'var(--text-muted)',
                    fontSize: '0.9375rem',
                  }}
                >
                  No events recorded yet.
                </TableCell>
              </TableRow>
            )}
            {evts.map((evt) => (
              <TableRow key={evt.id}>
                <TableCell style={{ paddingTop: '0.625rem', paddingBottom: '0.625rem' }}>
                  {eventTypeBadge(evt.eventType)}
                </TableCell>
                <TableCell
                  style={{
                    fontSize: '0.9375rem',
                    color: 'var(--text-muted)',
                    maxWidth: '180px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {evt.project || '–'}
                </TableCell>
                <TableCell
                  style={{
                    fontSize: '0.8125rem',
                    color: 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatDateTime(evt.occurredAt)}
                </TableCell>
                <TableCell
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-faint)',
                    fontFamily: 'var(--font-jetbrains-mono), monospace',
                    maxWidth: '340px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={JSON.stringify(evt.payload)}
                >
                  {abbreviatePayload(evt.payload)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
