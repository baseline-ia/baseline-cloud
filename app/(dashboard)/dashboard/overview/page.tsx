import { Clock, TrendingUp, Users, Activity, LayoutDashboard } from 'lucide-react';
import {
  getRoiSummary,
  getOverviewStats,
  getEventsPerDay,
  getTimeAggregates,
} from '@/lib/services/metrics';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { ActivityChart } from '@/components/dashboard/activity-chart';
import { WorktypeChart } from '@/components/dashboard/worktype-chart';

function formatMs(ms: number): string {
  const totalMin = ms / 60_000;
  const h = Math.floor(totalMin / 60);
  const m = Math.round(totalMin % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export default async function OverviewPage() {
  const [roi, stats, eventsPerDay, timeAgg] = await Promise.all([
    getRoiSummary(),
    getOverviewStats(),
    getEventsPerDay(30),
    getTimeAggregates(30),
  ]);

  const maxProjectMs = timeAgg.byProject[0]?.totalMs ?? 1;

  return (
    <div>
      <style>{`
        .overview-kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        @media (max-width: 1100px) {
          .overview-kpi-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 540px) {
          .overview-kpi-grid { grid-template-columns: 1fr; }
        }
        .overview-charts-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 1.5rem;
          margin-bottom: 1.5rem;
        }
        @media (max-width: 900px) {
          .overview-charts-grid { grid-template-columns: 1fr; }
        }
        .overview-bottom-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
        }
        @media (max-width: 900px) {
          .overview-bottom-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* Page header */}
      <div className="page-header">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <LayoutDashboard size={22} />
          Overview
        </h1>
        <p className="subtitle">Last 30 days</p>
      </div>

      {/* KPI row */}
      <div className="overview-kpi-grid">
        <KpiCard
          label="Time Saved"
          value={`${Math.round(roi.totalSavedMin / 60)}h`}
          sublabel={`${roi.closedChanges} changes closed`}
          icon={<Clock size={20} />}
          accent="primary"
        />
        <KpiCard
          label="ROI"
          value={`${roi.roiPct}%`}
          sublabel="vs estimated time"
          icon={<TrendingUp size={20} />}
          accent="success"
        />
        <KpiCard
          label="Active Devs"
          value={stats.activeDevsLast7d}
          sublabel="last 7 days"
          icon={<Users size={20} />}
          accent="primary"
        />
        <KpiCard
          label="Total Events"
          value={stats.totalEventsLast30d}
          sublabel="last 30 days"
          icon={<Activity size={20} />}
          accent="primary"
        />
      </div>

      {/* Charts row */}
      <div className="overview-charts-grid">
        {/* Daily activity */}
        <div
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--cl-radius)',
            padding: '1.25rem 1.5rem',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <p
            style={{
              margin: '0 0 1rem',
              fontWeight: 600,
              fontSize: '1.0625rem',
              color: 'var(--text)',
            }}
          >
            Daily Activity
          </p>
          <ActivityChart data={eventsPerDay} height={240} />
        </div>

        {/* By work type */}
        <div
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--cl-radius)',
            padding: '1.25rem 1.5rem',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <p
            style={{
              margin: '0 0 1rem',
              fontWeight: 600,
              fontSize: '1.0625rem',
              color: 'var(--text)',
            }}
          >
            By Work Type
          </p>
          <WorktypeChart data={roi.byWorkType} height={240} />
        </div>
      </div>

      {/* Bottom row */}
      <div className="overview-bottom-grid">
        {/* Top Developers */}
        <div
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--cl-radius)',
            padding: '1.25rem 1.5rem',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <p
            style={{
              margin: '0 0 1rem',
              fontWeight: 600,
              fontSize: '1.0625rem',
              color: 'var(--text)',
            }}
          >
            Top Developers
          </p>
          {roi.byDeveloper.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem' }}>No data yet.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['#', 'Developer', 'Changes', 'Time Saved'].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: h === '#' || h === 'Changes' || h === 'Time Saved' ? 'center' : 'left',
                        padding: '0 0.75rem 0.625rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        borderBottom: '1px solid var(--border-color)',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {roi.byDeveloper.slice(0, 8).map((dev, i) => (
                  <tr key={dev.username}>
                    <td
                      style={{
                        padding: '0.625rem 0.75rem',
                        textAlign: 'center',
                        fontSize: '0.8125rem',
                        color: 'var(--text-faint)',
                        borderBottom: '1px solid var(--border-color)',
                      }}
                    >
                      {i + 1}
                    </td>
                    <td
                      style={{
                        padding: '0.625rem 0.75rem',
                        borderBottom: '1px solid var(--border-color)',
                      }}
                    >
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
                          {dev.username.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 500, fontSize: '0.9375rem', color: 'var(--text)' }}>
                          {dev.username}
                        </span>
                      </div>
                    </td>
                    <td
                      style={{
                        padding: '0.625rem 0.75rem',
                        textAlign: 'center',
                        fontSize: '0.9375rem',
                        color: 'var(--text)',
                        borderBottom: '1px solid var(--border-color)',
                      }}
                    >
                      {dev.changes}
                    </td>
                    <td
                      style={{
                        padding: '0.625rem 0.75rem',
                        textAlign: 'center',
                        fontWeight: 600,
                        fontSize: '0.9375rem',
                        color: 'var(--success)',
                        borderBottom: '1px solid var(--border-color)',
                      }}
                    >
                      {Math.round(dev.savedMin / 60)}h
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Top Projects */}
        <div
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--cl-radius)',
            padding: '1.25rem 1.5rem',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <p
            style={{
              margin: '0 0 1rem',
              fontWeight: 600,
              fontSize: '1.0625rem',
              color: 'var(--text)',
            }}
          >
            Top Projects
          </p>
          {timeAgg.byProject.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem' }}>No data yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {timeAgg.byProject.slice(0, 8).map((proj) => {
                const pct = Math.round((proj.totalMs / maxProjectMs) * 100);
                return (
                  <div key={proj.key}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '0.25rem',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.9375rem',
                          fontWeight: 500,
                          color: 'var(--text)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '70%',
                        }}
                      >
                        {proj.key}
                      </span>
                      <span
                        style={{
                          fontSize: '0.8125rem',
                          color: 'var(--text-muted)',
                          flexShrink: 0,
                          marginLeft: '0.5rem',
                        }}
                      >
                        {formatMs(proj.totalMs)}
                      </span>
                    </div>
                    <div
                      style={{
                        height: '6px',
                        background: 'var(--bg-subtle)',
                        borderRadius: '3px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${pct}%`,
                          background: 'linear-gradient(90deg, var(--cl-primary), #8b5cf6)',
                          borderRadius: '3px',
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
