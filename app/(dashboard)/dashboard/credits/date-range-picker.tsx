'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

interface DateRangePickerProps {
  from: string;
  to: string;
}

export function DateRangePicker({ from, to }: DateRangePickerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const navigate = useCallback(
    (newFrom: string, newTo: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('from', newFrom);
      params.set('to', newTo);
      router.push(`/dashboard/credits?${params.toString()}`);
    },
    [router, searchParams],
  );

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        flexWrap: 'wrap',
      }}
    >
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
          fontSize: '0.8125rem',
          color: 'var(--text-muted)',
        }}
      >
        From
        <input
          type="date"
          defaultValue={from}
          onChange={(e) => {
            if (e.target.value) navigate(e.target.value, to);
          }}
          style={{
            padding: '0.375rem 0.5rem',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--cl-radius-sm)',
            background: 'var(--bg-elevated)',
            color: 'var(--text)',
            fontSize: '0.8125rem',
          }}
        />
      </label>
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
          fontSize: '0.8125rem',
          color: 'var(--text-muted)',
        }}
      >
        To
        <input
          type="date"
          defaultValue={to}
          onChange={(e) => {
            if (e.target.value) navigate(from, e.target.value);
          }}
          style={{
            padding: '0.375rem 0.5rem',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--cl-radius-sm)',
            background: 'var(--bg-elevated)',
            color: 'var(--text)',
            fontSize: '0.8125rem',
          }}
        />
      </label>
    </div>
  );
}
