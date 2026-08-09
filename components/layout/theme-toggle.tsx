'use client';

import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const saved = (localStorage.getItem('baseline-cloud-theme') ?? 'light') as 'light' | 'dark';
    setTheme(saved);
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  function toggle() {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('baseline-cloud-theme', next);
  }

  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      title="Toggle theme"
      aria-label="Toggle color theme"
    >
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  );
}
