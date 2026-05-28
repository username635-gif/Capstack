'use client';

/**
 * ThemeProvider — applies data-theme="dark" to <html> and persists
 * the user's preference in localStorage.
 *
 * Usage: wrap <body> children in <ThemeProvider> in layout.tsx.
 * The toggle button is exported separately so it can be placed in the sidebar.
 */

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: 'dark',
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark');

  // On mount: read saved preference; if none, default to dark mode
  useEffect(() => {
    const saved = localStorage.getItem('capstack_theme') as Theme | null;
    const preferred: Theme = saved ?? 'dark';

    setTheme(preferred);
    document.documentElement.setAttribute('data-theme', preferred);
  }, []);

  function toggle() {
    const next: Theme = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    localStorage.setItem('capstack_theme', next);
    document.documentElement.setAttribute('data-theme', next);
  }

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function ThemeToggle() {
  const { theme, toggle } = useContext(ThemeContext);
  return (
    <button
      onClick={toggle}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
      style={{
        background: 'var(--color-surface-2)',
        border: '1px solid var(--color-border)',
        color: 'var(--color-muted)',
        cursor: 'pointer',
      }}
    >
      <span style={{ fontSize: '1rem', lineHeight: 1 }}>
        {theme === 'dark' ? '☀' : '☽'}
      </span>
      {theme === 'dark' ? 'Light mode' : 'Dark mode'}
    </button>
  );
}
