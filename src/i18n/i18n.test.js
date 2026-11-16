import { describe, it, expect } from 'vitest';
import {
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  NAMESPACE_MAP,
  TRANSLATIONS,
  normalizeLanguage,
  isPortalPath,
  translate,
  translateStatus,
  translateServiceName,
  translateRole,
} from './index';

const extractPlaceholders = (text) => {
  if (typeof text !== 'string') return [];
  const matches = text.match(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g) || [];
  return matches.map((m) => m.replace(/\{\{|\}\}|\s+/g, '')).sort();
};

describe('i18n dictionary & helpers', () => {
  it('supports en and tl with en as default', () => {
    expect(SUPPORTED_LANGUAGES).toEqual(['en', 'tl']);
    expect(DEFAULT_LANGUAGE).toBe('en');
    expect(normalizeLanguage('tl')).toBe('tl');
    expect(normalizeLanguage('en')).toBe('en');
    expect(normalizeLanguage('fr')).toBe('en');
    expect(normalizeLanguage(null)).toBe('en');
  });

  it('maintains 100% key parity, non-empty string values, and matching interpolation placeholders across all namespaces', () => {
    for (const [namespace, mod] of Object.entries(NAMESPACE_MAP)) {
      const enDict = mod.en || {};
      const tlDict = mod.tl || {};

      const enKeys = Object.keys(enDict).sort();
      const tlKeys = Object.keys(tlDict).sort();

      expect(tlKeys, `Key mismatch in namespace "${namespace}"`).toEqual(enKeys);

      for (const key of enKeys) {
        const enVal = enDict[key];
        const tlVal = tlDict[key];

        expect(typeof enVal, `en["${key}"] must be a string`).toBe('string');
        expect(typeof tlVal, `tl["${key}"] must be a string`).toBe('string');
        expect(enVal.trim().length, `en["${key}"] must not be empty`).toBeGreaterThan(0);
        expect(tlVal.trim().length, `tl["${key}"] must not be empty`).toBeGreaterThan(0);

        const enVars = extractPlaceholders(enVal);
        const tlVars = extractPlaceholders(tlVal);
        expect(tlVars, `Placeholder mismatch for key "${key}" in namespace "${namespace}"`).toEqual(enVars);
      }
    }

    expect(Object.keys(TRANSLATIONS.tl).sort()).toEqual(Object.keys(TRANSLATIONS.en).sort());
  });

  it('interpolates {{placeholders}} and falls back gracefully', () => {
    expect(
      translate('en', 'patient.onboarding.stepCounter', { step: 2, total: 5 })
    ).toBe('Step 2 of 5');
    expect(
      translate('tl', 'patient.onboarding.stepCounter', { step: 2, total: 5 })
    ).toBe('Hakbang 2 sa 5');
    expect(translate('tl', 'non.existent.key', 'Custom Fallback')).toBe('Custom Fallback');
  });

  it('translates canonical statuses, service names, and roles without mutating canonical inputs', () => {
    expect(translateStatus('Pending', 'en')).toBe('Pending');
    expect(translateStatus('Pending', 'tl')).toBe('Naghihintay');
    expect(translateStatus('On The Way', 'tl')).toBe('Papunta Na');

    expect(translateServiceName('General Consultation', 'en')).toBe('General Consultation');
    expect(translateServiceName('General Consultation', 'tl')).toBe('Pangkalahatang Konsultasyon');
    expect(translateServiceName('Custom Specialty', 'tl')).toBe('Custom Specialty');

    expect(translateRole('patient', 'tl')).toBe('Pasyente');
    expect(translateRole('provider', 'tl')).toBe('Provider');
    expect(translateRole('admin', 'tl')).toBe('Admin');
  });

  it('scopes portal paths accurately and excludes landing/public routes', () => {
    expect(isPortalPath('/patient/dashboard')).toBe(true);
    expect(isPortalPath('/provider/schedule')).toBe(true);
    expect(isPortalPath('/admin/verifications')).toBe(true);
    expect(isPortalPath('/patient/onboarding')).toBe(true);

    expect(isPortalPath('/')).toBe(false);
    expect(isPortalPath('/auth')).toBe(false);
    expect(isPortalPath('/privacy')).toBe(false);
    expect(isPortalPath('/terms')).toBe(false);
  });
});
