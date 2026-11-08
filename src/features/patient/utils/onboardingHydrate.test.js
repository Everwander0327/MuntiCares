import { describe, expect, it } from 'vitest';
import {
  parseMedicalNotes,
  resolveOnboardingMedicalFields,
} from './onboardingHydrate';

const patData = {
  date_of_birth: '1952-04-11',
  medical_notes: 'DOB: 1952-04-11 | Post-stroke recovery',
  privacy_consent_at: '2026-01-01T00:00:00Z',
};

const history = {
  allergies: 'Penicillin',
  chronic_conditions: 'Hypertension',
  medications: 'Amlodipine',
  blood_type: 'O+',
};

describe('parseMedicalNotes', () => {
  it('splits a DOB prefix from the remaining notes', () => {
    expect(parseMedicalNotes('DOB: 1952-04-11 | Post-stroke recovery')).toEqual({
      dateOfBirth: '1952-04-11',
      medicalHistory: 'Post-stroke recovery',
    });
  });

  it('keeps notes with no DOB prefix intact', () => {
    expect(parseMedicalNotes('Just notes')).toEqual({
      dateOfBirth: '',
      medicalHistory: 'Just notes',
    });
  });

  it('handles empty and null input', () => {
    expect(parseMedicalNotes('')).toEqual({ dateOfBirth: '', medicalHistory: '' });
    expect(parseMedicalNotes(null)).toEqual({ dateOfBirth: '', medicalHistory: '' });
  });
});

describe('resolveOnboardingMedicalFields', () => {
  it('uses database values when the draft has no medical keys', () => {
    const result = resolveOnboardingMedicalFields({
      draft: { phone: '09171234567', baseAddress: 'Sampaguita St.' },
      patData,
      history,
    });

    expect(result.allergies).toBe('Penicillin');
    expect(result.chronicConditions).toBe('Hypertension');
    expect(result.medications).toBe('Amlodipine');
    expect(result.bloodType).toBe('O+');
    expect(result.dateOfBirth).toBe('1952-04-11');
    expect(result.medicalHistory).toBe('Post-stroke recovery');
    expect(result.privacyConsent).toBe(true);
  });

  it('lets a consented draft win over database values', () => {
    const result = resolveOnboardingMedicalFields({
      draft: {
        phone: '09171234567',
        privacyConsent: true,
        allergies: 'Shellfish',
        chronicConditions: '',
        medications: '',
        bloodType: 'A+',
        dateOfBirth: '1990-01-01',
        medicalHistory: '',
      },
      patData,
      history,
    });

    expect(result.allergies).toBe('Shellfish');
    expect(result.bloodType).toBe('A+');
    expect(result.dateOfBirth).toBe('1990-01-01');
    expect(result.chronicConditions).toBe('');
  });

  it('uses database values when there is no draft', () => {
    const result = resolveOnboardingMedicalFields({ draft: null, patData, history });
    expect(result.allergies).toBe('Penicillin');
    expect(result.privacyConsent).toBe(true);
  });

  it('returns empty defaults when nothing is available', () => {
    expect(
      resolveOnboardingMedicalFields({ draft: null, patData: null, history: null })
    ).toEqual({
      dateOfBirth: '',
      medicalHistory: '',
      privacyConsent: false,
      allergies: '',
      chronicConditions: '',
      medications: '',
      bloodType: '',
    });
  });
});
