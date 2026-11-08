const hasOwn = (obj, key) => Boolean(obj && Object.prototype.hasOwnProperty.call(obj, key));

export function parseMedicalNotes(notes) {
  const remaining = notes || '';
  const match = remaining.match(/^DOB:\s*(\d{4}-\d{2}-\d{2})(?:\s*\|\s*)?/);
  if (match) {
    return { dateOfBirth: match[1], medicalHistory: remaining.slice(match[0].length) };
  }
  return { dateOfBirth: '', medicalHistory: remaining };
}

export function resolveOnboardingMedicalFields({ draft, patData, history }) {
  const draftWins = (key) => hasOwn(draft, key);

  const dbDob = patData?.date_of_birth ? String(patData.date_of_birth).slice(0, 10) : '';
  const parsed = parseMedicalNotes(patData?.medical_notes || '');

  return {
    dateOfBirth: draftWins('dateOfBirth') ? draft.dateOfBirth : dbDob || parsed.dateOfBirth,
    medicalHistory: draftWins('medicalHistory') ? draft.medicalHistory : parsed.medicalHistory,
    privacyConsent: draftWins('privacyConsent')
      ? draft.privacyConsent
      : Boolean(patData?.privacy_consent_at),
    allergies: draftWins('allergies') ? draft.allergies : history?.allergies || '',
    chronicConditions: draftWins('chronicConditions')
      ? draft.chronicConditions
      : history?.chronic_conditions || '',
    medications: draftWins('medications') ? draft.medications : history?.medications || '',
    bloodType: draftWins('bloodType') ? draft.bloodType : history?.blood_type || '',
  };
}
