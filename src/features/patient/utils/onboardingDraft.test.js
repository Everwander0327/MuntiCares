import { describe, expect, it } from 'vitest';
import { buildOnboardingDraft } from './onboardingDraft';

describe('buildOnboardingDraft', () => {
  it('returns null when nothing has been entered', () => {
    expect(buildOnboardingDraft()).toBeNull();
    expect(buildOnboardingDraft({ fullName: '   ', accessNeeds: [] })).toBeNull();
  });

  it('keeps contact details without medical answers before consent', () => {
    const draft = buildOnboardingDraft({
      phone: '09171234567',
      baseAddress: 'Sampaguita St.',
      accessNeeds: ['stairs'],
      allergies: 'Penicillin',
      dateOfBirth: '1952-04-11',
    });

    expect(draft.phone).toBe('09171234567');
    expect(draft.accessNeeds).toEqual(['stairs']);
    expect(draft).not.toHaveProperty('allergies');
    expect(draft).not.toHaveProperty('dateOfBirth');
    expect(draft).not.toHaveProperty('privacyConsent');
  });

  it('drops medical answers when they are the only content and consent is off', () => {
    expect(buildOnboardingDraft({ allergies: 'Penicillin', bloodType: 'O+' })).toBeNull();
  });

  it('stores medical answers once consent is checked', () => {
    const draft = buildOnboardingDraft({
      phone: '09171234567',
      privacyConsent: true,
      allergies: 'Penicillin',
      chronicConditions: 'Hypertension',
      medications: 'Amlodipine 5mg',
      bloodType: 'O+',
      dateOfBirth: '1952-04-11',
      medicalHistory: 'Post-stroke recovery',
    });

    expect(draft.privacyConsent).toBe(true);
    expect(draft.allergies).toBe('Penicillin');
    expect(draft.bloodType).toBe('O+');
    expect(draft.medicalHistory).toBe('Post-stroke recovery');
  });
});
