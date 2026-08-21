'use client';

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DayData {
  date: string;
  credits: number;
  sessions: number;
}

interface DevData {
  username: string;
  credits: number;
  sessions: number;
}

interface CreditsChartsProps {
  byDay: DayData[];
  byDeveloper: DevData[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateLabel(date: string): string {
  const d = new Date(date + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

interface TooltipPayloadItem {
  value: number;
  dataKey: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

function DayTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--cl-radius-sm)',
        padding: '0.5rem 0.75rem',
        boxShadow: 'var(--shadow)',
        fontSize: '0.8125rem',
      }}
    >
      <p style={{ margin: 0, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
        {label ? formatDateLabel(label) : ''}
      </p>
      <p style={{ margin: 0, fontWeight: 600, color: 'var(--text)' }}>
        {payload[0].value.toFixed(1)} credits
      </p>
      {payload[1] && (
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.75rem' }}>
          {payload[1].value} sessions
        </p>
      )}
    </div>
  );
}

function DevTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--cl-radius-sm)',
        padding: '0.5rem 0.75rem',
        boxShadow: 'var(--shadow)',
        fontSize: '0.8125rem',
      }}
    >
      <p style={{ margin: 0, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
        {label}
      </p>
      <p style={{ margin: 0, fontWeight: 600, color: 'var(--text)' }}>
        {payload[0].value.toFixed(1)} credits
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CreditsCharts({ byDay, byDeveloper }: CreditsChartsProps) {
  const tickIndices = new Set(
    byDay.map((_, i) => i).filter((i) => i === 0 || i === byDay.length - 1 || i % 5 === 0),
  );

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gap: '1.5rem',
      }}
    >
      {/* Daily credits chart */}
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
          Daily Credits
        </p>
        {byDay.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem' }}>No data in this range.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={byDay} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="creditsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: 'var(--text-faint)' }}
                tickFormatter={(val, i) => (tickIndices.has(i) ? formatDateLabel(val) : '')}
                interval={0}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: 'var(--text-faint)' }}
              />
              <Tooltip content={<DayTooltip />} />
              <Area
                type="monotone"
                dataKey="credits"
                stroke="var(--chart-1)"
                strokeWidth={2}
                fill="url(#creditsGradient)"
                dot={false}
                activeDot={{ r: 4, fill: 'var(--chart-1)', strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* By developer bar chart */}
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
          By Developer
        </p>
        {byDeveloper.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem' }}>No data.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byDeveloper} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
              <XAxis
                dataKey="username"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: 'var(--text-faint)' }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: 'var(--text-faint)' }}
              />
              <Tooltip content={<DevTooltip />} />
              <Bar dataKey="credits" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <style>{`
        @media (max-width: 900px) {
          div:has(> [data-credits-grid]) { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
