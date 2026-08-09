'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface WorkTypeDataPoint {
  workType: string;
  savedMin: number;
  count: number;
}

interface WorktypeChartProps {
  data: WorkTypeDataPoint[];
  height?: number;
}

function formatSavedMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

interface TooltipPayloadItem {
  value: number;
  payload: WorkTypeDataPoint;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
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
      <p style={{ margin: 0, fontWeight: 600, color: 'var(--text)', marginBottom: '0.25rem' }}>
        {d.workType}
      </p>
      <p style={{ margin: 0, color: 'var(--success)', fontWeight: 600 }}>
        {formatSavedMin(d.savedMin)} saved
      </p>
      <p style={{ margin: '0.125rem 0 0', color: 'var(--text-muted)' }}>
        {d.count} change{d.count !== 1 ? 's' : ''}
      </p>
    </div>
  );
}

const BAR_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
];

export function WorktypeChart({ data, height = 260 }: WorktypeChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
        barSize={18}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" horizontal={false} />
        <XAxis
          type="number"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: 'var(--text-faint)' }}
          tickFormatter={(v) => formatSavedMin(v)}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="workType"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
          width={72}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--bg-subtle)' }} />
        <Bar dataKey="savedMin" radius={[0, 4, 4, 0]}>
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
