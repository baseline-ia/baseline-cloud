// ---------------------------------------------------------------------------
// Theme Palette System
// Similar to shadcn: base (neutral), accent (primary), chart colors
// ---------------------------------------------------------------------------

export interface BaseColor {
  id: string;
  label: string;
  light: { bg: string; bgElevated: string; bgSubtle: string; border: string; borderStrong: string; text: string; textMuted: string; textFaint: string };
  dark: { bg: string; bgElevated: string; bgSubtle: string; border: string; borderStrong: string; text: string; textMuted: string; textFaint: string };
}

export interface AccentColor {
  id: string;
  label: string;
  light: { primary: string; primaryHover: string; primarySoft: string };
  dark: { primary: string; primaryHover: string; primarySoft: string };
}

export interface ChartPalette {
  id: string;
  label: string;
  colors: string[]; // 8 colors
}

// ---------------------------------------------------------------------------
// Base Colors (neutrals)
// ---------------------------------------------------------------------------

export const BASE_COLORS: BaseColor[] = [
  {
    id: 'slate',
    label: 'Slate',
    light: { bg: '#f7f8fb', bgElevated: '#ffffff', bgSubtle: '#f1f3f9', border: '#e2e8f0', borderStrong: '#cbd5e1', text: '#0f172a', textMuted: '#64748b', textFaint: '#94a3b8' },
    dark: { bg: '#0b1020', bgElevated: '#131a30', bgSubtle: '#1a2240', border: '#2a3358', borderStrong: '#3a4570', text: '#f1f5f9', textMuted: '#94a3b8', textFaint: '#64748b' },
  },
  {
    id: 'gray',
    label: 'Gray',
    light: { bg: '#f9fafb', bgElevated: '#ffffff', bgSubtle: '#f3f4f6', border: '#e5e7eb', borderStrong: '#d1d5db', text: '#111827', textMuted: '#6b7280', textFaint: '#9ca3af' },
    dark: { bg: '#0a0a0f', bgElevated: '#141418', bgSubtle: '#1f1f26', border: '#2e2e38', borderStrong: '#3f3f4a', text: '#f9fafb', textMuted: '#9ca3af', textFaint: '#6b7280' },
  },
  {
    id: 'zinc',
    label: 'Zinc',
    light: { bg: '#fafafa', bgElevated: '#ffffff', bgSubtle: '#f4f4f5', border: '#e4e4e7', borderStrong: '#d4d4d8', text: '#18181b', textMuted: '#71717a', textFaint: '#a1a1aa' },
    dark: { bg: '#09090b', bgElevated: '#141416', bgSubtle: '#1e1e22', border: '#2c2c32', borderStrong: '#3f3f46', text: '#fafafa', textMuted: '#a1a1aa', textFaint: '#71717a' },
  },
  {
    id: 'stone',
    label: 'Stone',
    light: { bg: '#fafaf9', bgElevated: '#ffffff', bgSubtle: '#f5f5f4', border: '#e7e5e4', borderStrong: '#d6d3d1', text: '#1c1917', textMuted: '#78716c', textFaint: '#a8a29e' },
    dark: { bg: '#0c0a09', bgElevated: '#1a1816', bgSubtle: '#231f1d', border: '#332e2b', borderStrong: '#44403c', text: '#fafaf9', textMuted: '#a8a29e', textFaint: '#78716c' },
  },
  {
    id: 'neutral',
    label: 'Neutral',
    light: { bg: '#fafafa', bgElevated: '#ffffff', bgSubtle: '#f5f5f5', border: '#e5e5e5', borderStrong: '#d4d4d4', text: '#171717', textMuted: '#737373', textFaint: '#a3a3a3' },
    dark: { bg: '#0a0a0a', bgElevated: '#141414', bgSubtle: '#1f1f1f', border: '#2e2e2e', borderStrong: '#404040', text: '#fafafa', textMuted: '#a3a3a3', textFaint: '#737373' },
  },
];

// ---------------------------------------------------------------------------
// Accent Colors (primary/brand)
// ---------------------------------------------------------------------------

export const ACCENT_COLORS: AccentColor[] = [
  {
    id: 'indigo',
    label: 'Indigo',
    light: { primary: '#4f46e5', primaryHover: '#4338ca', primarySoft: '#eef2ff' },
    dark: { primary: '#818cf8', primaryHover: '#a5b4fc', primarySoft: '#312e81' },
  },
  {
    id: 'violet',
    label: 'Violet',
    light: { primary: '#7c3aed', primaryHover: '#6d28d9', primarySoft: '#f5f3ff' },
    dark: { primary: '#a78bfa', primaryHover: '#c4b5fd', primarySoft: '#3b0764' },
  },
  {
    id: 'blue',
    label: 'Blue',
    light: { primary: '#2563eb', primaryHover: '#1d4ed8', primarySoft: '#eff6ff' },
    dark: { primary: '#60a5fa', primaryHover: '#93c5fd', primarySoft: '#1e3a5f' },
  },
  {
    id: 'emerald',
    label: 'Emerald',
    light: { primary: '#059669', primaryHover: '#047857', primarySoft: '#ecfdf5' },
    dark: { primary: '#34d399', primaryHover: '#6ee7b7', primarySoft: '#064e3b' },
  },
  {
    id: 'rose',
    label: 'Rose',
    light: { primary: '#e11d48', primaryHover: '#be123c', primarySoft: '#fff1f2' },
    dark: { primary: '#fb7185', primaryHover: '#fda4af', primarySoft: '#4c0519' },
  },
  {
    id: 'orange',
    label: 'Orange',
    light: { primary: '#ea580c', primaryHover: '#c2410c', primarySoft: '#fff7ed' },
    dark: { primary: '#fb923c', primaryHover: '#fdba74', primarySoft: '#431407' },
  },
  {
    id: 'amber',
    label: 'Amber',
    light: { primary: '#d97706', primaryHover: '#b45309', primarySoft: '#fffbeb' },
    dark: { primary: '#fbbf24', primaryHover: '#fcd34d', primarySoft: '#451a03' },
  },
  {
    id: 'cyan',
    label: 'Cyan',
    light: { primary: '#0891b2', primaryHover: '#0e7490', primarySoft: '#ecfeff' },
    dark: { primary: '#22d3ee', primaryHover: '#67e8f9', primarySoft: '#083344' },
  },
];

// ---------------------------------------------------------------------------
// Chart Palettes
// ---------------------------------------------------------------------------

export const CHART_PALETTES: ChartPalette[] = [
  {
    id: 'vibrant',
    label: 'Vibrant',
    colors: ['#4f46e5', '#10b981', '#f59e0b', '#f43f5e', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'],
  },
  {
    id: 'pastel',
    label: 'Pastel',
    colors: ['#a5b4fc', '#6ee7b7', '#fcd34d', '#fda4af', '#93c5fd', '#c4b5fd', '#f9a8d4', '#5eead4'],
  },
  {
    id: 'ocean',
    label: 'Ocean',
    colors: ['#0ea5e9', '#06b6d4', '#14b8a6', '#10b981', '#0891b2', '#2563eb', '#3b82f6', '#0284c7'],
  },
  {
    id: 'sunset',
    label: 'Sunset',
    colors: ['#f97316', '#ef4444', '#f59e0b', '#ec4899', '#e11d48', '#d97706', '#dc2626', '#f43f5e'],
  },
  {
    id: 'forest',
    label: 'Forest',
    colors: ['#059669', '#16a34a', '#65a30d', '#0d9488', '#047857', '#4d7c0f', '#15803d', '#0f766e'],
  },
  {
    id: 'monochrome',
    label: 'Monochrome',
    colors: ['#1e293b', '#334155', '#475569', '#64748b', '#94a3b8', '#cbd5e1', '#3b82f6', '#6366f1'],
  },
];

// ---------------------------------------------------------------------------
// Theme config type (stored in localStorage)
// ---------------------------------------------------------------------------

export interface ThemeConfig {
  base: string;   // BaseColor id
  accent: string; // AccentColor id
  chart: string;  // ChartPalette id
}

export const DEFAULT_THEME: ThemeConfig = {
  base: 'slate',
  accent: 'indigo',
  chart: 'vibrant',
};

// ---------------------------------------------------------------------------
// Apply theme to CSS variables
// ---------------------------------------------------------------------------

export function getThemeCSSVariables(config: ThemeConfig, mode: 'light' | 'dark'): Record<string, string> {
  const base = BASE_COLORS.find((b) => b.id === config.base) ?? BASE_COLORS[0];
  const accent = ACCENT_COLORS.find((a) => a.id === config.accent) ?? ACCENT_COLORS[0];
  const chart = CHART_PALETTES.find((c) => c.id === config.chart) ?? CHART_PALETTES[0];

  const baseTokens = mode === 'dark' ? base.dark : base.light;
  const accentTokens = mode === 'dark' ? accent.dark : accent.light;

  return {
    '--bg': baseTokens.bg,
    '--bg-elevated': baseTokens.bgElevated,
    '--bg-subtle': baseTokens.bgSubtle,
    '--border-color': baseTokens.border,
    '--border-strong': baseTokens.borderStrong,
    '--text': baseTokens.text,
    '--text-muted': baseTokens.textMuted,
    '--text-faint': baseTokens.textFaint,
    '--cl-primary': accentTokens.primary,
    '--cl-primary-hover': accentTokens.primaryHover,
    '--cl-primary-soft': accentTokens.primarySoft,
    '--chart-1': chart.colors[0],
    '--chart-2': chart.colors[1],
    '--chart-3': chart.colors[2],
    '--chart-4': chart.colors[3],
    '--chart-5': chart.colors[4],
    '--chart-6': chart.colors[5],
    '--chart-7': chart.colors[6],
    '--chart-8': chart.colors[7],
  };
}
