import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [dark, setDark] = useState(() => {
    try {
      const stored = typeof localStorage !== 'undefined' ? localStorage?.getItem('mc_theme') : null;
      if (stored) return stored === 'dark';
      if (typeof window !== 'undefined' && window.matchMedia) {
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
      }
    } catch {
      // fallback
    }
    return false;
  });

  useEffect(() => {
    const root = document.documentElement;
    // Add disable-transitions temporarily so thousands of elements don't simultaneously compute transition interpolations
    root.classList.add('disable-transitions');
    
    if (dark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('mc_theme', dark ? 'dark' : 'light');
      }
    } catch {
      // ignore
    }

    // Force style flush then restore interactive transitions on next frame
    const timer = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root.classList.remove('disable-transitions');
      });
    });

    return () => cancelAnimationFrame(timer);
  }, [dark]);

  const toggle = useCallback(() => setDark(prev => !prev), []);

  return (
    <ThemeContext.Provider value={{ dark, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
