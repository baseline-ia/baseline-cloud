'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface DataPoint {
  date: string;
  count: number;
}

interface ActivityChartProps {
  data: DataPoint[];
  height?: number;
}

function formatDateLabel(date: string): string {
  const d = new Date(date + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

interface TooltipPayloadItem {
  value: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
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
        {payload[0].value} events
      </p>
    </div>
  );
}

export function ActivityChart({ data, height = 260 }: ActivityChartProps) {
  // Show every 5th label to avoid crowding
  const tickIndices = new Set(
    data
      .map((_, i) => i)
      .filter((i) => i === 0 || i === data.length - 1 || i % 5 === 0),
  );

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">
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
          allowDecimals={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="count"
          stroke="var(--chart-1)"
          strokeWidth={2}
          fill="url(#activityGradient)"
          dot={false}
          activeDot={{ r: 4, fill: 'var(--chart-1)', strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
