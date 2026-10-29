const trimmed = (value) => String(value ?? '').trim();

/**
 * Builds the localStorage draft for the onboarding flow.
 *
 * Medical answers are only included after the patient ticks the consent box,
 * so a shared device never holds clinical details the patient has not agreed
 * to store. Returns null when there is nothing worth saving.
 */
export function buildOnboardingDraft({
  fullName = '',
  phone = '',
  emergencyContactName = '',
  emergencyContactPhone = '',
  coords = null,
  baseAddress = '',
  unitFloor = '',
  subdivisionGate = '',
  arrivalInstructions = '',
  accessNeeds = [],
  privacyConsent = false,
  dateOfBirth = '',
  allergies = '',
  chronicConditions = '',
  medications = '',
  bloodType = '',
  medicalHistory = '',
} = {}) {
  const hasContactDetails = Boolean(
    trimmed(fullName) ||
      trimmed(phone) ||
      trimmed(emergencyContactName) ||
      trimmed(emergencyContactPhone) ||
      coords ||
      trimmed(baseAddress) ||
      trimmed(unitFloor) ||
      trimmed(subdivisionGate) ||
      trimmed(arrivalInstructions) ||
      accessNeeds.length
  );

  if (!privacyConsent) {
    if (!hasContactDetails) return null;
    return {
      fullName,
      phone,
      emergencyContactName,
      emergencyContactPhone,
      coords,
      baseAddress,
      unitFloor,
      subdivisionGate,
      arrivalInstructions,
      accessNeeds,
    };
  }

  return {
    fullName,
    phone,
    emergencyContactName,
    emergencyContactPhone,
    coords,
    baseAddress,
    unitFloor,
    subdivisionGate,
    arrivalInstructions,
    accessNeeds,
    privacyConsent: true,
    dateOfBirth,
    allergies,
    chronicConditions,
    medications,
    bloodType,
    medicalHistory,
  };
}
