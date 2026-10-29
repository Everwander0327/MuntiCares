import { describe, it, expect } from 'vitest';
import {
  accessNeedLabel,
  normalizeAccessNeeds,
  toggleAccessNeed,
} from './accessNeeds';
import { DEFAULT_CONSENT_PERMS, normalizePermissions } from './consent';

describe('normalizeAccessNeeds', () => {
  it('drops unknown and duplicate values', () => {
    expect(normalizeAccessNeeds(['stairs', 'stairs', 'teleport', 'wheelchair'])).toEqual([
      'stairs',
      'wheelchair',
    ]);
  });

  it('returns an empty list for non-array input', () => {
    expect(normalizeAccessNeeds(null)).toEqual([]);
    expect(normalizeAccessNeeds('stairs')).toEqual([]);
  });
});

describe('toggleAccessNeed', () => {
  it('adds a missing need', () => {
    expect(toggleAccessNeed(['stairs'], 'oxygen')).toEqual(['stairs', 'oxygen']);
  });

  it('removes an existing need and ignores junk input', () => {
    expect(toggleAccessNeed(['stairs', 'nonsense', 'oxygen'], 'stairs')).toEqual(['oxygen']);
  });
});

describe('accessNeedLabel', () => {
  it('maps values to their labels and falls back to the raw value', () => {
    expect(accessNeedLabel('lift')).toBe('Needs lift');
    expect(accessNeedLabel('custom')).toBe('custom');
  });
});

describe('consent permissions', () => {
  it('shares only the medical summary by default', () => {
    expect(DEFAULT_CONSENT_PERMS).toEqual({
      medical_history: true,
      documents: false,
      visit_notes: false,
    });
  });

  it('keeps stored opt-ins and fills missing keys with defaults', () => {
    expect(normalizePermissions({ documents: true })).toEqual({
      medical_history: true,
      documents: true,
      visit_notes: false,
    });
  });

  it('falls back to defaults for missing or malformed data', () => {
    expect(normalizePermissions(null)).toEqual(DEFAULT_CONSENT_PERMS);
    expect(normalizePermissions('on')).toEqual(DEFAULT_CONSENT_PERMS);
  });
});
