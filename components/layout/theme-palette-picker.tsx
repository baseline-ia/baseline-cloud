'use client';

import { useEffect, useState } from 'react';
import {
  BASE_COLORS,
  ACCENT_COLORS,
  CHART_PALETTES,
  DEFAULT_THEME,
  getThemeCSSVariables,
  type ThemeConfig,
} from '@/lib/themes';

const STORAGE_KEY = 'baseline-cloud-palette';

function loadPalette(): ThemeConfig {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_THEME;
    return { ...DEFAULT_THEME, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_THEME;
  }
}

function savePalette(config: ThemeConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

function applyPalette(config: ThemeConfig): void {
  const mode = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  const vars = getThemeCSSVariables(config, mode);
  const root = document.documentElement;
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
}

// Exported so ThemeToggle can re-apply palette after mode switch
export function reapplyPalette(): void {
  const config = loadPalette();
  applyPalette(config);
}

export function ThemePaletteProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const config = loadPalette();
    applyPalette(config);

    // Watch for theme (light/dark) changes to reapply
    const observer = new MutationObserver(() => {
      const config = loadPalette();
      applyPalette(config);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  return <>{children}</>;
}

// ---------------------------------------------------------------------------
// Picker UI (for admin/settings page)
// ---------------------------------------------------------------------------

export function ThemePalettePicker() {
  const [config, setConfig] = useState<ThemeConfig>(DEFAULT_THEME);

  useEffect(() => {
    setConfig(loadPalette());
  }, []);

  function update(partial: Partial<ThemeConfig>) {
    const next = { ...config, ...partial };
    setConfig(next);
    savePalette(next);
    applyPalette(next);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Base Color */}
      <div>
        <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.5rem' }}>
          Base Color
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {BASE_COLORS.map((base) => (
            <button
              key={base.id}
              onClick={() => update({ base: base.id })}
              title={base.label}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: base.light.bgElevated,
                border: config.base === base.id
                  ? '2px solid var(--cl-primary)'
                  : `2px solid ${base.light.border}`,
                cursor: 'pointer',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: config.base === base.id ? '0 0 0 2px var(--cl-primary-soft)' : 'none',
              }}
            >
              <span style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '50%',
                background: base.dark.bg,
              }} />
            </button>
          ))}
        </div>
      </div>

      {/* Accent Color */}
      <div>
        <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.5rem' }}>
          Accent Color
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {ACCENT_COLORS.map((accent) => (
            <button
              key={accent.id}
              onClick={() => update({ accent: accent.id })}
              title={accent.label}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: accent.light.primary,
                border: config.accent === accent.id
                  ? '3px solid var(--text)'
                  : '2px solid transparent',
                cursor: 'pointer',
                boxShadow: config.accent === accent.id ? '0 0 0 2px var(--cl-primary-soft)' : 'none',
              }}
            />
          ))}
        </div>
      </div>

      {/* Chart Palette */}
      <div>
        <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.5rem' }}>
          Chart Palette
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {CHART_PALETTES.map((palette) => (
            <button
              key={palette.id}
              onClick={() => update({ chart: palette.id })}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.5rem 0.75rem',
                borderRadius: 'var(--cl-radius-sm)',
                border: config.chart === palette.id
                  ? '2px solid var(--cl-primary)'
                  : '1px solid var(--border-color)',
                background: config.chart === palette.id ? 'var(--cl-primary-soft)' : 'var(--bg-elevated)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', gap: '3px' }}>
                {palette.colors.slice(0, 6).map((color, i) => (
                  <div
                    key={i}
                    style={{
                      width: '14px',
                      height: '14px',
                      borderRadius: '3px',
                      background: color,
                    }}
                  />
                ))}
              </div>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text)', fontWeight: 500 }}>
                {palette.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
