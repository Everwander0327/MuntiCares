import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import ProfilePopover from '@/shared/navigation/ProfilePopover';
import SettingsPage from './SettingsPage';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'patient-1',
      email: 'juan@munticares.ph',
      full_name: 'Juan Dela Cruz',
      role: 'patient',
    },
    logout: vi.fn(),
  }),
}));

vi.mock('@/layouts/DashboardLayout', () => ({
  default: ({ children }) => <div data-testid="dashboard-layout">{children}</div>,
}));

vi.mock('@/features/patient/pages/Consent', () => ({
  default: ({ embedded }) => (
    <div data-testid="patient-consent" data-embedded={String(Boolean(embedded))}>
      Consent Manager
    </div>
  ),
}));

describe('ProfilePopover', () => {
  const user = {
    name: 'Juan Dela Cruz',
    email: 'juan@munticares.ph',
    initials: 'JD',
    badge: 'Patient',
    avatar_url: '',
  };

  it('opens on click and shows MuntiCares account, settings, personalization, and sign out', () => {
    const onLogout = vi.fn();
    render(
      <MemoryRouter>
        <ThemeProvider>
          <ProfilePopover user={user} currentRole="patient" onLogout={onLogout} />
        </ThemeProvider>
      </MemoryRouter>
    );

    const trigger = screen.getByRole('button', { name: /open profile and settings menu/i });
    fireEvent.click(trigger);

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByText('Juan Dela Cruz')).toBeInTheDocument();
    expect(screen.getByText('juan@munticares.ph')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /view profile/i })).toHaveAttribute('href', '/patient/profile');
    expect(screen.getByRole('menuitem', { name: /settings/i })).toHaveAttribute('href', '/patient/settings');
    expect(screen.getByRole('menuitem', { name: /personalization/i })).toHaveAttribute(
      'href',
      '/patient/settings?tab=personalization'
    );

    fireEvent.click(screen.getByRole('menuitem', { name: /sign out/i }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});

describe('SettingsPage', () => {
  const store = new Map();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal('localStorage', {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear(),
    });
    document.documentElement.classList.remove('dark');
    document.documentElement.style.removeProperty('--ui-scale');
    document.documentElement.removeAttribute('data-ui-scale');
    document.documentElement.removeAttribute('data-ui-scale-mode');
    document.documentElement.removeAttribute('data-color-theme');
  });

  it('renders split-pane settings with search and switches between Light and Dark mode', () => {
    render(
      <MemoryRouter initialEntries={['/patient/settings']}>
        <ThemeProvider>
          <Routes>
            <Route path="/patient/settings" element={<SettingsPage />} />
          </Routes>
        </ThemeProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /^settings$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /general & appearance/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /search settings/i })).toBeInTheDocument();

    const darkCard = screen.getByRole('button', { name: /dark mode/i });
    fireEvent.click(darkCard);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('mc_theme')).toBe('dark');

    const lightCard = screen.getByRole('button', { name: /light mode/i });
    fireEvent.click(lightCard);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('mc_theme')).toBe('light');

    // Search filters to Notifications & Audio
    fireEvent.change(screen.getByRole('textbox', { name: /search settings/i }), {
      target: { value: 'ringtone' },
    });
    expect(screen.getByRole('heading', { name: /notifications & audio/i })).toBeInTheDocument();
  });

  it('renders embedded PatientConsent inside Personalization section', () => {
    render(
      <MemoryRouter initialEntries={['/patient/settings?tab=personalization']}>
        <ThemeProvider>
          <Routes>
            <Route path="/patient/settings" element={<SettingsPage />} />
          </Routes>
        </ThemeProvider>
      </MemoryRouter>
    );

    const consent = screen.getByTestId('patient-consent');
    expect(consent).toBeInTheDocument();
    expect(consent).toHaveAttribute('data-embedded', 'true');
  });

  it('defaults mobile viewports to Compact (0.9) and allows switching and resetting all 4 Display Size presets', () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === '(max-width: 767px)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    try {
      render(
        <MemoryRouter initialEntries={['/patient/settings']}>
          <ThemeProvider>
            <Routes>
              <Route path="/patient/settings" element={<SettingsPage />} />
            </Routes>
          </ThemeProvider>
        </MemoryRouter>
      );

      // Auto mode on mobile (<768px) resolves to Compact (90%)
      expect(document.documentElement.style.getPropertyValue('--ui-scale')).toBe('0.9');
      expect(document.documentElement.getAttribute('data-ui-scale')).toBe('compact');
      expect(document.documentElement.getAttribute('data-ui-scale-mode')).toBe('auto');
      expect(localStorage.getItem('mc_ui_scale')).toBeNull();

      // Switch to Extra Compact (80%)
      fireEvent.click(screen.getByRole('button', { name: /extra compact/i }));
      expect(document.documentElement.style.getPropertyValue('--ui-scale')).toBe('0.8');
      expect(document.documentElement.getAttribute('data-ui-scale')).toBe('extra-compact');
      expect(document.documentElement.getAttribute('data-ui-scale-mode')).toBe('custom');
      expect(localStorage.getItem('mc_ui_scale')).toBe('extra-compact');

      // Switch to Large (115%)
      fireEvent.click(screen.getByRole('button', { name: /large/i }));
      expect(document.documentElement.style.getPropertyValue('--ui-scale')).toBe('1.15');
      expect(document.documentElement.getAttribute('data-ui-scale')).toBe('large');
      expect(localStorage.getItem('mc_ui_scale')).toBe('large');

      // Switch to Standard (100%)
      fireEvent.click(screen.getByRole('button', { name: /standard/i }));
      expect(document.documentElement.style.getPropertyValue('--ui-scale')).toBe('1');
      expect(document.documentElement.getAttribute('data-ui-scale')).toBe('standard');
      expect(localStorage.getItem('mc_ui_scale')).toBe('standard');

      // Reset to Auto restores mobile Compact default and clears storage key
      fireEvent.click(screen.getByRole('button', { name: /reset to auto/i }));
      expect(document.documentElement.style.getPropertyValue('--ui-scale')).toBe('0.9');
      expect(document.documentElement.getAttribute('data-ui-scale')).toBe('compact');
      expect(document.documentElement.getAttribute('data-ui-scale-mode')).toBe('auto');
      expect(localStorage.getItem('mc_ui_scale')).toBeNull();
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it('supports switching all 9 global color themes, updates theme-color meta, and resets to Trust Blue', () => {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }

    render(
      <MemoryRouter initialEntries={['/patient/settings']}>
        <ThemeProvider>
          <Routes>
            <Route path="/patient/settings" element={<SettingsPage />} />
          </Routes>
        </ThemeProvider>
      </MemoryRouter>
    );

    expect(document.documentElement.getAttribute('data-color-theme')).toBe('trust-blue');
    expect(meta.getAttribute('content')).toBe('#F4F8FC');

    const cases = [
      [/botanical sage/i, 'botanical-sage', '#F3F8F6', '#0D1917'],
      [/warm hearth/i, 'warm-hearth', '#FAF6F1', '#1A1412'],
      [/harbor dusk/i, 'harbor-dusk', '#F5F6FB', '#101322'],
      [/laguna coastal/i, 'laguna-coastal', '#F2F8FA', '#0B171D'],
      [/sampaguita moss/i, 'sampaguita-moss', '#F6F8F2', '#12170E'],
      [/narra amber/i, 'narra-amber', '#FBF8F3', '#19140E'],
      [/alabang rosewood/i, 'alabang-rosewood', '#FAF5F7', '#1A1115'],
      [/monochrome ink/i, 'monochrome-ink', '#F6F7F9', '#111317'],
    ];

    for (const [labelRx, id, lightBg] of cases) {
      const btn = screen.getByRole('button', { name: labelRx });
      fireEvent.click(btn);
      expect(document.documentElement.getAttribute('data-color-theme')).toBe(id);
      expect(localStorage.getItem('mc_color_theme')).toBe(id);
      expect(meta.getAttribute('content')).toBe(lightBg);
      expect(btn).toHaveAttribute('aria-pressed', 'true');
    }

    // Dark mode updates theme-color for the selected palette
    fireEvent.click(screen.getByRole('button', { name: /dark mode/i }));
    expect(meta.getAttribute('content')).toBe('#111317');

    // Reset restores Trust Blue
    fireEvent.click(screen.getByRole('button', { name: /reset to trust blue/i }));
    expect(document.documentElement.getAttribute('data-color-theme')).toBe('trust-blue');
    expect(localStorage.getItem('mc_color_theme')).toBe('trust-blue');
    expect(meta.getAttribute('content')).toBe('#0E1620');
  });

  it('switches portal language between English and Tagalog (Filipino) and omits the old static Region card', () => {
    render(
      <MemoryRouter initialEntries={['/patient/settings']}>
        <ThemeProvider>
          <LanguageProvider>
            <Routes>
              <Route path="/patient/settings" element={<SettingsPage />} />
            </Routes>
          </LanguageProvider>
        </ThemeProvider>
      </MemoryRouter>
    );

    expect(screen.queryByText(/philippines \(manila gmt\+8\)/i)).not.toBeInTheDocument();

    const enBtn = screen.getByRole('button', { name: /english/i });
    const tlBtn = screen.getByRole('button', { name: /tagalog \(filipino\)/i });

    expect(enBtn).toHaveAttribute('aria-pressed', 'true');
    expect(tlBtn).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(tlBtn);
    expect(localStorage.getItem('mc_language')).toBe('tl');
    expect(screen.getByRole('heading', { name: /^mga setting$/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /english/i }));
    expect(localStorage.getItem('mc_language')).toBe('en');
    expect(screen.getByRole('heading', { name: /^settings$/i })).toBeInTheDocument();
  });
});
