import { describe, it, expect } from 'vitest';
import {
  buildStaticCatalog,
  filterCatalogItems,
  splitHighlightSegments,
} from './searchCatalog';

const mockT = (key) => {
  const map = {
    'nav.search.pageConsent': 'Consent Management',
    'nav.search.pageConsentKeywords': 'consent privacy data sharing',
    'nav.search.pageProfile': 'Profile',
    'nav.search.pageProfileKeywords': 'profile account personal info',
    'nav.search.pageSettings': 'Settings',
    'nav.search.pageSettingsKeywords': 'settings preferences',
    'nav.search.actionToggleDark': 'Switch to Dark Mode',
    'nav.search.actionToggleLight': 'Switch to Light Mode',
    'nav.search.actionThemeKeywords': 'theme dark light',
    'nav.search.actionSwitchToTagalog': 'Switch Language to Tagalog',
    'nav.search.actionSwitchToEnglish': 'Switch Language to English',
    'nav.search.actionLanguageKeywords': 'language tagalog english',
    'nav.search.actionWeeklyUpdates': 'Open Weekly Updates',
    'nav.search.actionWeeklyKeywords': 'weekly updates news events',
    'nav.search.actionSignOut': 'Sign Out',
    'nav.search.actionSignOutKeywords': 'logout sign out',
    'settings.sections.appearance.label': 'Appearance',
    'settings.sections.appearance.keywords': 'theme color scale',
    'settings.sections.personalization.label': 'Personalization',
    'settings.sections.personalization.keywords': 'language motion accessibility',
    'settings.sections.notifications.label': 'Notifications',
    'settings.sections.notifications.keywords': 'push sound alerts',
    'settings.sections.privacy.label': 'Privacy & Consent',
    'settings.sections.privacy.keywords': 'cookies consent data',
  };
  return map[key] || key;
};

const basePatientLinks = [
  { label: 'Dashboard', shortLabel: 'Dashboard', to: '/patient/dashboard' },
  { label: 'Find Providers', shortLabel: 'Find', to: '/patient/providers' },
  { label: 'Profile', shortLabel: 'Profile', to: '/patient/profile' },
];

const baseProviderLinks = [
  { label: 'Dashboard', shortLabel: 'Dashboard', to: '/provider/dashboard' },
  { label: 'My Schedule', shortLabel: 'Schedule', to: '/provider/schedule' },
];

const baseAdminLinks = [
  { label: 'Overview', shortLabel: 'Dashboard', to: '/admin/dashboard' },
  { label: 'Patients', shortLabel: 'Patients', to: '/admin/patients' },
];

describe('searchCatalog', () => {
  it('includes hidden pages without duplicating sidebar links and scopes Weekly Updates by role', () => {
    const patient = buildStaticCatalog({
      role: 'patient',
      links: basePatientLinks,
      t: mockT,
      dark: false,
      language: 'en',
    });
    const patientRoutes = patient.pages.map((p) => p.to);
    expect(patientRoutes).toContain('/patient/consent');
    expect(patientRoutes).toContain('/patient/settings');
    expect(patientRoutes.filter((r) => r === '/patient/profile')).toHaveLength(1);
    expect(patient.actions.map((a) => a.actionId)).toEqual([
      'toggle-theme',
      'toggle-language',
      'weekly-updates',
      'sign-out',
    ]);
    expect(patient.actions[0].label).toBe('Switch to Dark Mode');
    expect(patient.actions[1].label).toBe('Switch Language to Tagalog');

    const provider = buildStaticCatalog({
      role: 'provider',
      links: baseProviderLinks,
      t: mockT,
      dark: true,
      language: 'tl',
    });
    expect(provider.pages.map((p) => p.to)).toEqual(
      expect.arrayContaining(['/provider/profile', '/provider/settings'])
    );
    expect(provider.actions.map((a) => a.actionId)).toContain('weekly-updates');
    expect(provider.actions[0].label).toBe('Switch to Light Mode');
    expect(provider.actions[1].label).toBe('Switch Language to English');

    const admin = buildStaticCatalog({
      role: 'admin',
      links: baseAdminLinks,
      t: mockT,
      dark: false,
      language: 'en',
    });
    expect(admin.pages.map((p) => p.to)).toEqual(
      expect.arrayContaining(['/admin/profile', '/admin/settings'])
    );
    expect(admin.actions.map((a) => a.actionId)).not.toContain('weekly-updates');
  });

  it('builds role-scoped Settings tab deep links and filters by label or keywords', () => {
    const { settings } = buildStaticCatalog({
      role: 'provider',
      links: baseProviderLinks,
      t: mockT,
      dark: false,
      language: 'en',
    });
    expect(settings.map((s) => s.to)).toEqual([
      '/provider/settings?tab=appearance',
      '/provider/settings?tab=personalization',
      '/provider/settings?tab=notifications',
      '/provider/settings?tab=privacy',
    ]);

    const hits = filterCatalogItems(settings, 'push');
    expect(hits).toHaveLength(1);
    expect(hits[0].to).toBe('/provider/settings?tab=notifications');
  });

  it('splits highlight segments case-insensitively without mutating original casing', () => {
    expect(splitHighlightSegments('Home Nursing Care', 'nurs')).toEqual([
      { text: 'Home ', match: false },
      { text: 'Nurs', match: true },
      { text: 'ing Care', match: false },
    ]);

    expect(splitHighlightSegments('Home Nursing Care', '')).toEqual([
      { text: 'Home Nursing Care', match: false },
    ]);

    expect(splitHighlightSegments('Home Nursing Care', 'xyz')).toEqual([
      { text: 'Home Nursing Care', match: false },
    ]);
  });
});
