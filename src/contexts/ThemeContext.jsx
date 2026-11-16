import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

const ThemeContext = createContext();

export const UI_SCALE_STORAGE_KEY = 'mc_ui_scale';
export const COLOR_THEME_STORAGE_KEY = 'mc_color_theme';
export const DEFAULT_COLOR_THEME = 'trust-blue';

export const COLOR_THEMES = [
  {
    id: 'trust-blue',
    label: 'Trust Blue',
    badge: 'Default',
    summary: 'Civic clinical authority with cool slate surfaces',
    light: { page: '#F4F8FC', card: '#FFFFFF', primary: '#2F6FB5', accent: '#C4623F', border: '#D2E0EE' },
    dark: { page: '#0E1620', card: '#16212E', primary: '#8CBDF0', accent: '#F2A98E', border: '#2D3F54' },
  },
  {
    id: 'botanical-sage',
    label: 'Botanical Sage',
    badge: 'Calm',
    summary: 'Low-glare eucalyptus teal for gentle clinical focus',
    light: { page: '#F3F8F6', card: '#FFFFFF', primary: '#1E6B60', accent: '#B85D3B', border: '#C9DDD4' },
    dark: { page: '#0D1917', card: '#132220', primary: '#72CFC0', accent: '#F0A388', border: '#2C4843' },
  },
  {
    id: 'warm-hearth',
    label: 'Warm Hearth',
    badge: 'Homey',
    summary: 'Warm oat linen and terracotta for welcoming care',
    light: { page: '#FAF6F1', card: '#FFFFFF', primary: '#9E472A', accent: '#236B78', border: '#E2D2C2' },
    dark: { page: '#1A1412', card: '#231B18', primary: '#F0A184', accent: '#79C9D6', border: '#4A3932' },
  },
  {
    id: 'harbor-dusk',
    label: 'Harbor Dusk',
    badge: 'Serene',
    summary: 'Soft periwinkle-indigo slate with evening calm',
    light: { page: '#F5F6FB', card: '#FFFFFF', primary: '#4C56A1', accent: '#B95D48', border: '#CFD5E8' },
    dark: { page: '#101322', card: '#191D2E', primary: '#A9B2F5', accent: '#F1A491', border: '#3B4363' },
  },
  {
    id: 'laguna-coastal',
    label: 'Laguna Coastal',
    badge: 'Crisp',
    summary: 'Fresh bay cerulean-cyan with warm sand highlights',
    light: { page: '#F2F8FA', card: '#FFFFFF', primary: '#0E6884', accent: '#B0621B', border: '#C6DCE6' },
    dark: { page: '#0B171D', card: '#112028', primary: '#6ED0EB', accent: '#F2B872', border: '#2A4756' },
  },
  {
    id: 'sampaguita-moss',
    label: 'Sampaguita Moss',
    badge: 'Herbal',
    summary: 'Soft olive-leaf botanical palette for quiet balance',
    light: { page: '#F6F8F2', card: '#FFFFFF', primary: '#456728', accent: '#B65C3A', border: '#D4DEC5' },
    dark: { page: '#12170E', card: '#192113', primary: '#A3CF7B', accent: '#F0A388', border: '#38482C' },
  },
  {
    id: 'narra-amber',
    label: 'Narra Amber',
    badge: 'Warm',
    summary: 'Golden timber warmth and mahogany bronze accents',
    light: { page: '#FBF8F3', card: '#FFFFFF', primary: '#8A5316', accent: '#236E63', border: '#E3D5C0' },
    dark: { page: '#19140E', card: '#211B13', primary: '#EEB86D', accent: '#75D0C1', border: '#483B2A' },
  },
  {
    id: 'alabang-rosewood',
    label: 'Alabang Rosewood',
    badge: 'Gentle',
    summary: 'Muted berry-rose surfaces paired with civic blue',
    light: { page: '#FAF5F7', card: '#FFFFFF', primary: '#943B57', accent: '#2F6FB5', border: '#E3CED7' },
    dark: { page: '#1A1115', card: '#22171B', primary: '#ED9BB3', accent: '#8CBDF0', border: '#4A323B' },
  },
  {
    id: 'monochrome-ink',
    label: 'Monochrome Ink',
    badge: 'Minimal',
    summary: 'Architectural graphite neutral with copper focus',
    light: { page: '#F6F7F9', card: '#FFFFFF', primary: '#2C3646', accent: '#B85A34', border: '#CFD5DF' },
    dark: { page: '#111317', card: '#181B21', primary: '#CBD5E1', accent: '#F0A184', border: '#353C49' },
  },
];

const COLOR_THEME_MAP = Object.fromEntries(COLOR_THEMES.map((theme) => [theme.id, theme]));

const isValidColorTheme = (value) => Boolean(value && Object.prototype.hasOwnProperty.call(COLOR_THEME_MAP, value));

const readStoredColorTheme = () => {
  try {
    const stored = typeof localStorage !== 'undefined' ? localStorage?.getItem(COLOR_THEME_STORAGE_KEY) : null;
    if (isValidColorTheme(stored)) return stored;
  } catch {
    // fallback to default
  }
  return DEFAULT_COLOR_THEME;
};

export const UI_SCALE_PRESETS = [
  {
    id: 'extra-compact',
    label: 'Extra Compact',
    percentage: '80%',
    scale: 0.8,
    summary: 'Fits maximum content on compact phones',
  },
  {
    id: 'compact',
    label: 'Compact',
    percentage: '90%',
    scale: 0.9,
    summary: 'Balanced mobile density (phone default)',
  },
  {
    id: 'standard',
    label: 'Standard',
    percentage: '100%',
    scale: 1,
    summary: 'Default desktop and tablet proportions',
  },
  {
    id: 'large',
    label: 'Large',
    percentage: '115%',
    scale: 1.15,
    summary: 'Larger text and controls for effortless reading',
  },
];

const UI_SCALE_MAP = Object.fromEntries(UI_SCALE_PRESETS.map((preset) => [preset.id, preset.scale]));

const isValidUiScalePreset = (value) => Boolean(value && Object.prototype.hasOwnProperty.call(UI_SCALE_MAP, value));

const getIsMobileViewport = () => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(max-width: 767px)').matches;
};

const readStoredUiScalePreset = () => {
  try {
    const stored = typeof localStorage !== 'undefined' ? localStorage?.getItem(UI_SCALE_STORAGE_KEY) : null;
    if (isValidUiScalePreset(stored)) return stored;
  } catch {
    // fallback to responsive auto default
  }
  return 'auto';
};

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

  const [reducedMotion, setReducedMotion] = useState(() => {
    try {
      const stored = typeof localStorage !== 'undefined' ? localStorage?.getItem('mc_reduced_motion') : null;
      if (stored === 'true') return true;
      if (stored === 'false') return false;
    } catch {
      // fallback
    }
    return false;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (reducedMotion) {
      root.setAttribute('data-reduced-motion', 'true');
    } else {
      root.removeAttribute('data-reduced-motion');
    }
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('mc_reduced_motion', String(reducedMotion));
      }
    } catch {
      // ignore
    }
  }, [reducedMotion]);

  const [colorTheme, setColorThemeState] = useState(readStoredColorTheme);

  const [uiScalePreset, setUiScalePreset] = useState(readStoredUiScalePreset);
  const [isMobileViewport, setIsMobileViewport] = useState(getIsMobileViewport);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('disable-transitions');
    root.setAttribute('data-color-theme', colorTheme);

    const activeMeta = COLOR_THEME_MAP[colorTheme] || COLOR_THEME_MAP[DEFAULT_COLOR_THEME];
    const themeColorHex = dark ? activeMeta.dark.page : activeMeta.light.page;
    const metaTag = typeof document !== 'undefined' ? document.querySelector('meta[name="theme-color"]') : null;
    if (metaTag && themeColorHex) {
      metaTag.setAttribute('content', themeColorHex);
    }

    const faviconHref =
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='" +
      encodeURIComponent(activeMeta.light.primary) +
      "'/%3E%3Cg transform='translate(4,4)'%3E%3Cpath d='M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z' fill='%23fff'/%3E%3C/g%3E%3C/svg%3E";
    const iconLink = typeof document !== 'undefined' ? document.querySelector('link[rel="icon"]') : null;
    if (iconLink) {
      iconLink.setAttribute('href', faviconHref);
    }

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(COLOR_THEME_STORAGE_KEY, colorTheme);
      }
    } catch {
      // ignore
    }

    const timer = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root.classList.remove('disable-transitions');
      });
    });

    return () => cancelAnimationFrame(timer);
  }, [colorTheme, dark]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mq = window.matchMedia('(max-width: 767px)');
    const handleChange = (e) => setIsMobileViewport(Boolean(e?.matches ?? mq.matches));
    setIsMobileViewport(mq.matches);
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', handleChange);
      return () => mq.removeEventListener('change', handleChange);
    }
    if (typeof mq.addListener === 'function') {
      mq.addListener(handleChange);
      return () => mq.removeListener(handleChange);
    }
    return undefined;
  }, []);

  // Keep scale, theme mode, and color theme synced across open tabs
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleStorage = (e) => {
      if (e.key === UI_SCALE_STORAGE_KEY) {
        setUiScalePreset(isValidUiScalePreset(e.newValue) ? e.newValue : 'auto');
      } else if (e.key === COLOR_THEME_STORAGE_KEY) {
        setColorThemeState(isValidColorTheme(e.newValue) ? e.newValue : DEFAULT_COLOR_THEME);
      } else if (e.key === 'mc_theme' && (e.newValue === 'dark' || e.newValue === 'light')) {
        setDark(e.newValue === 'dark');
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const setColorTheme = useCallback((nextTheme) => {
    setColorThemeState(isValidColorTheme(nextTheme) ? nextTheme : DEFAULT_COLOR_THEME);
  }, []);

  const resolvedUiScalePreset = useMemo(() => {
    if (isValidUiScalePreset(uiScalePreset)) return uiScalePreset;
    return isMobileViewport ? 'compact' : 'standard';
  }, [uiScalePreset, isMobileViewport]);

  const uiScale = UI_SCALE_MAP[resolvedUiScalePreset] ?? 1;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('disable-transitions');
    root.style.setProperty('--ui-scale', String(uiScale));
    root.setAttribute('data-ui-scale', resolvedUiScalePreset);
    root.setAttribute('data-ui-scale-mode', uiScalePreset === 'auto' ? 'auto' : 'custom');

    const timer = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root.classList.remove('disable-transitions');
      });
    });

    return () => cancelAnimationFrame(timer);
  }, [uiScale, resolvedUiScalePreset, uiScalePreset]);

  const setUiScale = useCallback((nextPreset) => {
    const normalized = isValidUiScalePreset(nextPreset) ? nextPreset : 'auto';
    setUiScalePreset(normalized);
    try {
      if (typeof localStorage !== 'undefined') {
        if (normalized === 'auto') {
          localStorage.removeItem(UI_SCALE_STORAGE_KEY);
        } else {
          localStorage.setItem(UI_SCALE_STORAGE_KEY, normalized);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const toggle = useCallback(() => setDark((prev) => !prev), []);
  const setThemeMode = useCallback((mode) => {
    setDark(mode === 'dark');
  }, []);

  const activeColorTheme = COLOR_THEME_MAP[colorTheme] || COLOR_THEME_MAP[DEFAULT_COLOR_THEME];

  return (
    <ThemeContext.Provider
      value={{
        dark,
        toggle,
        setThemeMode,
        colorTheme,
        setColorTheme,
        colorThemes: COLOR_THEMES,
        activeColorTheme,
        reducedMotion,
        setReducedMotion,
        uiScalePreset,
        resolvedUiScalePreset,
        uiScale,
        isMobileViewport,
        setUiScale,
        uiScalePresets: UI_SCALE_PRESETS,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};

export const useOptionalTheme = () => useContext(ThemeContext);
