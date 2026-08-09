import { Activity } from 'lucide-react';
import { getRecentEvents } from '@/lib/services/metrics';

function formatDateTime(date: Date): string {
  const d = new Date(date);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function eventCategoryBadge(eventType: string) {
  let bg: string;
  let color: string;

  if (eventType.startsWith('change.')) {
    bg = 'var(--cl-primary-soft)';
    color = 'var(--cl-primary)';
  } else if (eventType.startsWith('skill.')) {
    bg = 'var(--success-soft)';
    color = 'var(--success)';
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

function payloadSummary(payload: Record<string, unknown>): string {
  const candidates: Array<[string, string]> = [
    ['changeName', String(payload.changeName ?? '')],
    ['verdict', String(payload.verdict ?? '')],
    ['skillName', String(payload.skillName ?? '')],
    ['command', String(payload.command ?? '')],
    ['message', String(payload.message ?? '')],
  ];
  const parts: string[] = [];
  for (const [key, val] of candidates) {
    if (val && val !== 'undefined' && val !== 'null') {
      parts.push(`${key}: ${val}`);
    }
    if (parts.length >= 2) break;
  }
  return parts.length > 0 ? parts.join(' · ') : '';
}

export default async function ActivityPage() {
  const feed = await getRecentEvents(100);

  return (
    <div>
      <div className="page-header">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Activity size={22} />
          Activity
        </h1>
        <p className="subtitle">Recent events from all developers</p>
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
        {feed.length === 0 ? (
          <div className="empty-state">
            <p style={{ fontSize: '1rem', fontWeight: 500, marginBottom: '0.5rem' }}>
              No events recorded yet.
            </p>
            <p style={{ fontSize: '0.9375rem' }}>
              Events will appear here as developers use baseline tools.
            </p>
          </div>
        ) : (
          <div>
            {feed.map((evt) => {
              const summary = payloadSummary(evt.payload);
              return (
                <div
                  key={evt.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '0.75rem 1.25rem',
                    borderBottom: '1px solid var(--border-color)',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-subtle)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background = '';
                  }}
                >
                  {/* Event type badge */}
                  <div style={{ flexShrink: 0 }}>{eventCategoryBadge(evt.eventType)}</div>

                  {/* Username */}
                  <code
                    style={{
                      fontFamily: 'var(--font-jetbrains-mono), monospace',
                      fontSize: '0.8125rem',
                      color: 'var(--text)',
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    {evt.username}
                  </code>

                  {/* Project */}
                  {evt.project && (
                    <span
                      style={{
                        fontSize: '0.8125rem',
                        color: 'var(--text-muted)',
                        flexShrink: 0,
                        maxWidth: '200px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {evt.project}
                    </span>
                  )}

                  {/* Payload summary */}
                  {summary && (
                    <span
                      style={{
                        fontSize: '0.8125rem',
                        color: 'var(--text-faint)',
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {summary}
                    </span>
                  )}
                  {!summary && <div style={{ flex: 1 }} />}

                  {/* Timestamp */}
                  <span
                    style={{
                      fontSize: '0.8125rem',
                      color: 'var(--text-faint)',
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatDateTime(evt.occurredAt)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
