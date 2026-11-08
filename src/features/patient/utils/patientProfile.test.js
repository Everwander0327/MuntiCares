import { describe, it, expect } from 'vitest';
import {
  isMissingColumnError,
  parseEmergencyContact,
  shouldSkipMedicalHistoryWrite,
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
