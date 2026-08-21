'use client';

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
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
// Picker UI
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
    <div className="space-y-6">
      {/* Base Color */}
      <PickerSection title="Base Color">
        <div className="flex flex-wrap gap-2">
          {BASE_COLORS.map((base) => (
            <button
              key={base.id}
              onClick={() => update({ base: base.id })}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border border-[var(--border-color)] px-3 py-1.5 text-xs font-medium transition-all',
                config.base === base.id
                  ? 'bg-[var(--text)] text-[var(--bg-elevated)] border-[var(--text)]'
                  : 'bg-[var(--bg-elevated)] text-[var(--text)] hover:bg-[var(--bg-subtle)]'
              )}
            >
              <span
                className="w-3.5 h-3.5 rounded-full border border-border/50 shadow-sm"
                style={{ background: base.light.bgSubtle }}
              />
              {base.label}
              {config.base === base.id && <Check size={12} />}
            </button>
          ))}
        </div>
      </PickerSection>

      {/* Accent Color */}
      <PickerSection title="Accent Color">
        <div className="flex flex-wrap gap-2">
          {ACCENT_COLORS.map((accent) => (
            <button
              key={accent.id}
              onClick={() => update({ accent: accent.id })}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border border-[var(--border-color)] px-3 py-1.5 text-xs font-medium transition-all',
                config.accent === accent.id
                  ? 'bg-[var(--text)] text-[var(--bg-elevated)] border-[var(--text)]'
                  : 'bg-[var(--bg-elevated)] text-[var(--text)] hover:bg-[var(--bg-subtle)]'
              )}
            >
              <span
                className="w-3.5 h-3.5 rounded-full shadow-sm"
                style={{ background: accent.light.primary }}
              />
              {accent.label}
              {config.accent === accent.id && <Check size={12} />}
            </button>
          ))}
        </div>
      </PickerSection>

      {/* Chart Palette */}
      <PickerSection title="Chart Colors">
        <div className="flex flex-wrap gap-2">
          {CHART_PALETTES.map((palette) => (
            <button
              key={palette.id}
              onClick={() => update({ chart: palette.id })}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border border-[var(--border-color)] px-3 py-1.5 text-xs font-medium transition-all',
                config.chart === palette.id
                  ? 'bg-[var(--text)] text-[var(--bg-elevated)] border-[var(--text)]'
                  : 'bg-[var(--bg-elevated)] text-[var(--text)] hover:bg-[var(--bg-subtle)]'
              )}
            >
              <span className="inline-flex gap-[2px]">
                {palette.colors.slice(0, 4).map((color, i) => (
                  <span
                    key={i}
                    className="w-2 h-3.5 rounded-[2px]"
                    style={{ background: color }}
                  />
                ))}
              </span>
              {palette.label}
              {config.chart === palette.id && <Check size={12} />}
            </button>
          ))}
        </div>
      </PickerSection>
    </div>
  );
}

function PickerSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <h3 className="text-sm font-medium text-[var(--text-muted)]">{title}</h3>
      {children}
    </div>
  );
}
