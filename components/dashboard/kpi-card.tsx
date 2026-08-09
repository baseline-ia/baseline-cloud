import * as React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface KpiCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  icon?: React.ReactNode;
  trend?: { value: number; label: string };
  accent?: 'primary' | 'success' | 'warning' | 'danger';
}

const accentColorMap: Record<NonNullable<KpiCardProps['accent']>, string> = {
  primary: 'var(--cl-primary)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  danger: 'var(--danger)',
};

const accentSoftMap: Record<NonNullable<KpiCardProps['accent']>, string> = {
  primary: 'var(--cl-primary-soft)',
  success: 'var(--success-soft)',
  warning: 'var(--warning-soft)',
  danger: 'var(--danger-soft)',
};

export function KpiCard({ label, value, sublabel, icon, trend, accent = 'primary' }: KpiCardProps) {
  const accentColor = accentColorMap[accent];
  const accentSoft = accentSoftMap[accent];

  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--cl-radius)',
        padding: '1.25rem 1.5rem',
        boxShadow: 'var(--shadow-sm)',
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = '';
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-sm)';
      }}
    >
      {/* Accent top bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: accentColor,
        }}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <p
            style={{
              fontSize: '0.8125rem',
              color: 'var(--text-muted)',
              margin: '0 0 0.375rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontWeight: 500,
            }}
          >
            {label}
          </p>
          <p
            style={{
              fontSize: '1.75rem',
              fontWeight: 700,
              color: 'var(--text)',
              margin: 0,
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
            }}
          >
            {value}
          </p>
          {sublabel && (
            <p
              style={{
                fontSize: '0.8125rem',
                color: 'var(--text-muted)',
                margin: '0.375rem 0 0',
              }}
            >
              {sublabel}
            </p>
          )}
          {trend && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                marginTop: '0.5rem',
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: trend.value >= 0 ? 'var(--success)' : 'var(--danger)',
              }}
            >
              {trend.value >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
              {trend.value >= 0 ? '+' : ''}
              {trend.value}% {trend.label}
            </div>
          )}
        </div>

        {icon && (
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: accentSoft,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: accentColor,
              flexShrink: 0,
              marginLeft: '1rem',
            }}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
