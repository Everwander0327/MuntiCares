import { describe, it, expect } from 'vitest';
import {
  buildProfileSnapshot,
  formatEmergencyContact,
  getProfileCompletion,
  isMissingColumnError,
  isProfileDirty,
  parseEmergencyContact,
  resolveEmergencyContactParts,
  shouldSkipMedicalHistoryWrite,
  summarizeAddressForCard,
} from './patientProfile';

describe('parseEmergencyContact', () => {
  it('splits the legacy "Name - Phone" format', () => {
    expect(parseEmergencyContact('Maria Cruz - 09187654321')).toEqual({
      name: 'Maria Cruz',
      phone: '09187654321',
    });
  });

  it('keeps a name-only value as the name', () => {
    expect(parseEmergencyContact('Maria Cruz')).toEqual({ name: 'Maria Cruz', phone: '' });
  });

  it('handles empty values', () => {
    expect(parseEmergencyContact('')).toEqual({ name: '', phone: '' });
    expect(parseEmergencyContact()).toEqual({ name: '', phone: '' });
  });
});

describe('isMissingColumnError', () => {
  it('detects PostgREST and Postgres missing-column codes', () => {
    expect(isMissingColumnError({ code: 'PGRST204' })).toBe(true);
    expect(isMissingColumnError({ code: '42703' })).toBe(true);
    expect(isMissingColumnError({ message: 'column "unit" does not exist' })).toBe(true);
  });

  it('ignores unrelated failures', () => {
    expect(isMissingColumnError({ code: '23505', message: 'duplicate key' })).toBe(false);
    expect(isMissingColumnError(null)).toBe(false);
  });
});

describe('shouldSkipMedicalHistoryWrite', () => {
  it('never skips when the history was loaded', () => {
    expect(shouldSkipMedicalHistoryWrite(true, true)).toBe(false);
    expect(shouldSkipMedicalHistoryWrite(true, false)).toBe(false);
  });

  it('skips only when an existing row could be clobbered', () => {
    expect(shouldSkipMedicalHistoryWrite(false, true)).toBe(true);
    expect(shouldSkipMedicalHistoryWrite(false, false)).toBe(false);
  });
});

describe('formatEmergencyContact & resolveEmergencyContactParts', () => {
  it('formats and resolves separate columns or legacy dash-delimited strings', () => {
    expect(formatEmergencyContact('Maria Cruz', '09187654321')).toBe('Maria Cruz - 09187654321');
    expect(formatEmergencyContact('Maria Cruz', '')).toBe('Maria Cruz');
    expect(formatEmergencyContact('', '09187654321')).toBe('09187654321');

    expect(
      resolveEmergencyContactParts({
        emergency_contact: 'Legacy Name - 09170001111',
      }),
    ).toEqual({ name: 'Legacy Name', phone: '09170001111' });

    expect(
      resolveEmergencyContactParts({
        emergency_contact: 'Legacy Name - 09170001111',
        emergency_contact_name: 'Updated Name',
        emergency_contact_phone: '09189992222',
      }),
    ).toEqual({ name: 'Updated Name', phone: '09189992222' });
  });
});

describe('getProfileCompletion', () => {
  it('tracks missing essential fields and reports 100% when all three exist', () => {
    expect(
      getProfileCompletion({
        phone: '',
        address: '123 Sampaguita St, Tunasan',
        emergency_contact_name: '',
        emergency_contact_phone: '',
      }),
    ).toEqual({
      isComplete: false,
      completedSteps: 1,
      totalSteps: 3,
      percentage: 33,
      missingFields: ['phone', 'emergency_contact'],
    });

    expect(
      getProfileCompletion({
        phone: '09171234567',
        address: '123 Sampaguita St, Tunasan',
        emergency_contact_name: 'Maria Cruz',
        emergency_contact_phone: '09187654321',
      }),
    ).toEqual({
      isComplete: true,
      completedSteps: 3,
      totalSteps: 3,
      percentage: 100,
      missingFields: [],
    });
  });
});

describe('summarizeAddressForCard', () => {
  it('extracts base address, gate instructions, and rounded coordinates', () => {
    expect(
      summarizeAddressForCard(
        'Block 14 Lot 8, Victoria Homes, Tunasan (Gate/Notes: Yellow gate beside bakery)',
        { lat: 14.3789123, lng: 121.0456789 },
        { unit: 'Block 14 Lot 8', subdivision: 'Victoria Homes' },
      ),
    ).toEqual({
      hasAddress: true,
      hasCoords: true,
      street: 'Block 14 Lot 8, Victoria Homes, Tunasan',
      detailsLine: 'Block 14 Lot 8 • Victoria Homes',
      instructions: 'Yellow gate beside bakery',
      coordsLabel: '14.37891, 121.04568',
    });

    expect(summarizeAddressForCard('', null)).toEqual({
      hasAddress: false,
      hasCoords: false,
      street: '',
      detailsLine: '',
      instructions: '',
      coordsLabel: '',
    });
  });
});

describe('buildProfileSnapshot & isProfileDirty', () => {
  it('detects edits across profile fields and pin coordinates', () => {
    const baseProfile = {
      phone: '09171234567',
      address: 'Festival Walk, Alabang',
      emergency_contact_name: 'Juan Dela Cruz',
      emergency_contact_phone: '09187654321',
      medical_notes: '',
      allergies: '',
      chronic_conditions: '',
      past_surgeries: '',
    };
    const baseCoords = { lat: 14.41767, lng: 121.04676 };
    const baseline = buildProfileSnapshot(baseProfile, baseCoords);

    expect(isProfileDirty(baseline, baseProfile, baseCoords)).toBe(false);
    expect(
      isProfileDirty(
        baseline,
        { ...baseProfile, emergency_contact_phone: '09189998888' },
        baseCoords,
      ),
    ).toBe(true);
    expect(
      isProfileDirty(baseline, baseProfile, { lat: 14.42, lng: 121.05 }),
    ).toBe(true);
  });
});
