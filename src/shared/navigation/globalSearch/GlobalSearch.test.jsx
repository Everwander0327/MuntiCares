import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { SquaresFour, MagnifyingGlass } from '@phosphor-icons/react';

const {
  setThemeModeMock,
  setLanguageMock,
  searchLiveRecordsMock,
  warmRoleSearchCacheMock,
} = vi.hoisted(() => ({
  setThemeModeMock: vi.fn(),
  setLanguageMock: vi.fn(),
  searchLiveRecordsMock: vi.fn(),
  warmRoleSearchCacheMock: vi.fn(),
}));

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({
    dark: false,
    setThemeMode: setThemeModeMock,
    reducedMotion: true,
  }),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'en',
    setLanguage: setLanguageMock,
    t: (key, params) => {
      const map = {
        'nav.search.patientPlaceholder': 'Search providers, requests, or menu...',
        'nav.search.providerPlaceholder': 'Search patient, schedule, or menu...',
        'nav.search.adminPlaceholder': 'Search users, requests, or menu...',
        'nav.search.ariaLabel': 'Search pages, records, and quick actions',
        'nav.search.clearInput': 'Clear search',
        'nav.search.matchingPages': 'Matching Pages',
        'nav.search.quickNavigation': 'Quick Navigation',
        'nav.search.recent': 'Recent',
        'nav.search.clearRecent': 'Clear',
        'nav.search.settings': 'Settings',
        'nav.search.quickActions': 'Quick Actions',
        'nav.search.jump': 'Jump ↵',
        'nav.search.run': 'Run ↵',
        'nav.search.noResultsFor': `No results found for "${params?.query || ''}"`,
        'nav.search.searchingRecords': 'Searching records...',
        'nav.search.actionToggleDark': 'Switch to Dark Mode',
        'nav.search.actionToggleLight': 'Switch to Light Mode',
        'nav.search.actionThemeKeywords': 'theme dark light',
        'nav.search.actionSwitchToTagalog': 'Switch Language to Tagalog',
        'nav.search.actionSwitchToEnglish': 'Switch Language to English',
        'nav.search.actionLanguageKeywords': 'language tagalog english',
        'nav.search.actionWeeklyUpdates': 'Open Weekly Updates',
        'nav.search.actionWeeklyKeywords': 'weekly updates events',
        'nav.search.actionSignOut': 'Sign Out',
        'nav.search.actionSignOutKeywords': 'logout sign out',
        'nav.search.pageConsent': 'Consent Management',
        'nav.search.pageConsentKeywords': 'consent privacy',
        'nav.search.pageProfile': 'Profile',
        'nav.search.pageProfileKeywords': 'profile account',
        'nav.search.pageSettings': 'Settings',
        'nav.search.pageSettingsKeywords': 'settings preferences',
        'settings.sections.appearance.label': 'Appearance',
        'settings.sections.appearance.keywords': 'theme color',
        'settings.sections.personalization.label': 'Personalization',
        'settings.sections.personalization.keywords': 'language motion',
        'settings.sections.notifications.label': 'Notifications',
        'settings.sections.notifications.keywords': 'push alerts',
        'settings.sections.privacy.label': 'Privacy & Consent',
        'settings.sections.privacy.keywords': 'cookies consent',
      };
      return map[key] || key;
    },
    translateService: (s) => s,
    translateStatus: (s) => s,
  }),
}));

vi.mock('./searchDataSource', () => ({
  searchLiveRecords: searchLiveRecordsMock,
  warmRoleSearchCache: warmRoleSearchCacheMock,
}));

import GlobalSearch from './GlobalSearch';

const sampleLinks = [
  { icon: <SquaresFour />, label: 'Dashboard', shortLabel: 'Dashboard', to: '/patient/dashboard' },
  { icon: <MagnifyingGlass />, label: 'Find Providers', shortLabel: 'Find', to: '/patient/providers' },
];

describe('GlobalSearch', () => {
  const store = new Map();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal('localStorage', {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear(),
    });
    setThemeModeMock.mockReset();
    setLanguageMock.mockReset();
    searchLiveRecordsMock.mockReset();
    searchLiveRecordsMock.mockResolvedValue([]);
    warmRoleSearchCacheMock.mockReset();
  });

  it('renders desktop-only combobox without Ctrl+K shortcut/badge, opens on focus, and closes via Escape', () => {
    const { container } = render(
      <GlobalSearch
        currentRole="patient"
        links={sampleLinks}
        authUser={{ id: 'u1' }}
        onNavigate={vi.fn()}
        onLogout={vi.fn()}
      />
    );

    expect(container.firstChild.className).toContain('hidden md:flex');
    expect(screen.queryByText(/Ctrl K|⌘K/)).not.toBeInTheDocument();
    const input = screen.getByRole('combobox', {
      name: 'Search pages, records, and quick actions',
    });
    expect(input).toHaveAttribute('aria-expanded', 'false');

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(input).toHaveAttribute('aria-expanded', 'false');

    fireEvent.focus(input);
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('supports ArrowDown/ArrowUp wrapping and Enter activation while ignoring IME composition Enter', () => {
    const onNavigate = vi.fn();
    render(
      <GlobalSearch
        currentRole="patient"
        links={sampleLinks}
        authUser={{ id: 'u1' }}
        onNavigate={onNavigate}
        onLogout={vi.fn()}
      />
    );

    const input = screen.getByRole('combobox');
    fireEvent.focus(input);

    // Move from Dashboard (0) -> Find Providers (1)
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const options = screen.getAllByRole('option');
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', options[1].id);

    // IME composing Enter and Escape must NOT navigate, close, or preventDefault
    const imeEnter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    Object.defineProperty(imeEnter, 'isComposing', { value: true });
    input.dispatchEvent(imeEnter);
    expect(imeEnter.defaultPrevented).toBe(false);

    const imeEscape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    Object.defineProperty(imeEscape, 'isComposing', { value: true });
    input.dispatchEvent(imeEscape);
    expect(imeEscape.defaultPrevented).toBe(false);

    fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 });
    expect(onNavigate).not.toHaveBeenCalled();
    expect(input).toHaveAttribute('aria-expanded', 'true');

    // Real Enter activates Find Providers and saves to Recent
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onNavigate).toHaveBeenCalledWith('/patient/providers');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(localStorage.getItem('mc_global_search_recent:patient:u1')).toContain(
      '/patient/providers'
    );
  });

  it('executes Quick Actions without persisting them to Recent items', () => {
    const onLogout = vi.fn();
    const weeklySpy = vi.fn();
    window.addEventListener('munticares-open-weekly-updates', weeklySpy);

    render(
      <GlobalSearch
        currentRole="patient"
        links={sampleLinks}
        authUser={{ id: 'u1' }}
        onNavigate={vi.fn()}
        onLogout={onLogout}
      />
    );

    const input = screen.getByRole('combobox');
    fireEvent.focus(input);

    fireEvent.click(screen.getByText('Switch to Dark Mode'));
    expect(setThemeModeMock).toHaveBeenCalledWith('dark');

    fireEvent.focus(input);
    fireEvent.click(screen.getByText('Switch Language to Tagalog'));
    expect(setLanguageMock).toHaveBeenCalledWith('tl');

    fireEvent.focus(input);
    fireEvent.click(screen.getByText('Open Weekly Updates'));
    expect(weeklySpy).toHaveBeenCalledTimes(1);

    fireEvent.focus(input);
    fireEvent.click(screen.getByText('Sign Out'));
    expect(onLogout).toHaveBeenCalledTimes(1);

    expect(localStorage.getItem('mc_global_search_recent:patient:u1')).toBeNull();
    window.removeEventListener('munticares-open-weekly-updates', weeklySpy);
  });

  it('discards stale async live search responses when a newer query resolves first', async () => {
    let resolveFirst;
    let resolveSecond;

    searchLiveRecordsMock
      .mockImplementationOnce(
        () =>
          new Promise((res) => {
            resolveFirst = res;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise((res) => {
            resolveSecond = res;
          })
      );

    render(
      <GlobalSearch
        currentRole="patient"
        links={sampleLinks}
        authUser={{ id: 'u1' }}
        onNavigate={vi.fn()}
        onLogout={vi.fn()}
      />
    );

    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'ma' } });

    await waitFor(() => {
      expect(searchLiveRecordsMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(input, { target: { value: 'maria' } });

    await waitFor(() => {
      expect(searchLiveRecordsMock).toHaveBeenCalledTimes(2);
    });

    // Resolve the NEWER query first
    await act(async () => {
      resolveSecond([
        {
          key: 'providers',
          label: 'Providers',
          items: [
            {
              id: 'prov-new',
              label: 'Nurse Maria New',
              subtitle: 'Home Nursing',
              to: '/patient/providers/p2/profile',
              kind: 'provider',
            },
          ],
        },
      ]);
    });

    expect(await screen.findByText(/New/)).toBeInTheDocument();

    // Now resolve the STALE first query — must NOT overwrite newer results
    await act(async () => {
      resolveFirst([
        {
          key: 'providers',
          label: 'Providers',
          items: [
            {
              id: 'prov-old',
              label: 'Old Stale Match',
              subtitle: 'Old Service',
              to: '/patient/providers/p1/profile',
              kind: 'provider',
            },
          ],
        },
      ]);
    });

    expect(screen.queryByText(/Old Stale Match/)).not.toBeInTheDocument();
    expect(screen.getByText(/New/)).toBeInTheDocument();
  });

  it('saves recentSubtitle instead of live email subtitle when selecting an Admin user match', async () => {
    const onNavigate = vi.fn();
    searchLiveRecordsMock.mockResolvedValue([
      {
        key: 'patients',
        label: 'Patients',
        items: [
          {
            id: 'admin-patient:u9',
            label: 'Ana Reyes',
            subtitle: 'ana@example.com',
            recentSubtitle: 'Patient • Active',
            to: '/admin/patients?q=Ana%20Reyes',
            kind: 'patient',
          },
        ],
      },
    ]);

    render(
      <GlobalSearch
        currentRole="admin"
        links={sampleLinks}
        authUser={{ id: 'admin-1' }}
        onNavigate={onNavigate}
        onLogout={vi.fn()}
      />
    );

    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'ana' } });

    const option = await screen.findByRole('option', { name: /Ana Reyes/i });
    fireEvent.click(option);

    expect(onNavigate).toHaveBeenCalledWith('/admin/patients?q=Ana%20Reyes');
    const saved = localStorage.getItem('mc_global_search_recent:admin:admin-1');
    expect(saved).toContain('Patient • Active');
    expect(saved).not.toContain('ana@example.com');
  });

  it('hides prior liveGroups immediately when query changes so Enter cannot select stale results during debounce', async () => {
    const onNavigate = vi.fn();
    searchLiveRecordsMock
      .mockResolvedValueOnce([
        {
          key: 'patients',
          label: 'Patients',
          items: [
            {
              id: 'admin-patient:u9',
              label: 'Ana Reyes',
              subtitle: 'ana@example.com',
              recentSubtitle: 'Patient • Active',
              to: '/admin/patients?q=Ana%20Reyes',
              kind: 'patient',
            },
          ],
        },
      ])
      .mockImplementationOnce(() => new Promise(() => {})); // stays pending

    render(
      <GlobalSearch
        currentRole="admin"
        links={sampleLinks}
        authUser={{ id: 'admin-1' }}
        onNavigate={onNavigate}
        onLogout={vi.fn()}
      />
    );

    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'ana' } });
    expect(await screen.findByRole('option', { name: /Ana Reyes/i })).toBeInTheDocument();

    // Change query to something with no static matches while live fetch is still debouncing/in-flight
    fireEvent.change(input, { target: { value: 'carlos' } });
    expect(screen.queryByRole('option', { name: /Ana Reyes/i })).not.toBeInTheDocument();

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
