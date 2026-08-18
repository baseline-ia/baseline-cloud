import { Activity } from 'lucide-react';
import { getRecentEventsPage, parseRecentEventsParams } from '@/lib/services/metrics';

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

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const listParams = parseRecentEventsParams(await searchParams);
  const eventList = await getRecentEventsPage(listParams);
  const { rows: feed, total, page, totalPages } = eventList;

  function activityListHref(nextPage: number) {
    const params = new URLSearchParams();
    if (listParams.search) params.set('q', listParams.search);
    if (nextPage > 1) params.set('page', String(nextPage));
    const query = params.toString();
    return `/dashboard/activity${query ? `?${query}` : ''}`;
  }

  return (
    <div>
      <style>{`.activity-row:hover { background: var(--bg-subtle); }`}</style>
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
        <form method="get" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', padding: '1.25rem 1.25rem 1rem' }}>
          <label htmlFor="activity-search" style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)' }}>
            Search
          </label>
          <input
            id="activity-search"
            name="q"
            type="search"
            defaultValue={listParams.search}
            placeholder="Project, event type, or developer"
            aria-label="Search activity"
            style={{ height: '36px', padding: '0 0.75rem', border: '1px solid var(--border-color)', borderRadius: 'var(--cl-radius-sm)', fontSize: '0.9375rem', color: 'var(--text)', background: 'var(--bg-subtle)', width: 'min(100%, 360px)' }}
          />
          <input type="hidden" name="page" value="1" />
          <button type="submit" style={{ height: '36px', padding: '0 1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--cl-radius-sm)', background: 'var(--bg-subtle)', color: 'var(--text)', fontWeight: 600, cursor: 'pointer' }}>
            Search
          </button>
        </form>
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
                  className="activity-row"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '0.75rem 1.25rem',
                    borderBottom: '1px solid var(--border-color)',
                    transition: 'background 0.15s ease',
                  }}
                >
                  {/* Event type badge */}
                  <div style={{ flexShrink: 0 }}>{eventCategoryBadge(evt.eventType)}</div>

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderTop: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          <span>{total} event{total === 1 ? '' : 's'} · Page {page} of {totalPages}</span>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {page > 1 && <a href={activityListHref(page - 1)} style={{ color: 'var(--cl-primary)', textDecoration: 'none' }}>Previous</a>}
            {page < totalPages && <a href={activityListHref(page + 1)} style={{ color: 'var(--cl-primary)', textDecoration: 'none' }}>Next</a>}
          </div>
        </div>
      </div>
    </div>
  );
}
