import { parseFullVisitAddress } from '@/features/tracking/services/addressFormat';

/** Splits the legacy "Name - Phone" emergency contact string into its parts. */
export const parseEmergencyContact = (raw = '') => {
  if (!raw) return { name: '', phone: '' };
  if (raw.includes(' - ')) {
    const [name, phone] = raw.split(' - ');
    return { name: name || '', phone: phone || '' };
  }
  return { name: raw, phone: '' };
};

/** Combines separate emergency contact name and phone into the legacy string format. */
export const formatEmergencyContact = (name = '', phone = '') => {
  const cleanName = String(name || '').trim();
  const cleanPhone = String(phone || '').trim();
  if (cleanName && cleanPhone) return `${cleanName} - ${cleanPhone}`;
  return cleanName || cleanPhone;
};

/**
 * Resolves emergency contact parts from a patient row, preferring dedicated
 * structured columns when populated and falling back to `emergency_contact`.
 */
export const resolveEmergencyContactParts = (patData) => {
  const parsed = parseEmergencyContact(patData?.emergency_contact || '');
  return {
    name: String(patData?.emergency_contact_name || parsed.name || '').trim(),
    phone: String(patData?.emergency_contact_phone || parsed.phone || '').trim(),
  };
};

/** Calculates essential Patient Profile completion across phone, address, and emergency contact. */
export const getProfileCompletion = (profile) => {
  const emergency =
    formatEmergencyContact(profile?.emergency_contact_name, profile?.emergency_contact_phone) ||
    String(profile?.emergency_contact || '').trim();

  const missingFields = [];
  if (!String(profile?.phone || '').trim()) missingFields.push('phone');
  if (!String(profile?.address || '').trim()) missingFields.push('address');
  if (!emergency) missingFields.push('emergency_contact');

  const totalSteps = 3;
  const completedSteps = totalSteps - missingFields.length;
  return {
    isComplete: completedSteps === totalSteps,
    completedSteps,
    totalSteps,
    percentage: Math.round((completedSteps / totalSteps) * 100),
    missingFields,
  };
};

/** Formats saved home address, pin coordinates, and draft metadata for the Overview summary card. */
export const summarizeAddressForCard = (address = '', coords = null, draft = null) => {
  const parsed = parseFullVisitAddress(address || '');
  const trimmedAddress = String(address || '').trim();
  const lat = coords?.lat != null ? Number(coords.lat) : NaN;
  const lng = coords?.lng != null ? Number(coords.lng) : NaN;
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

  return {
    hasAddress: Boolean(trimmedAddress),
    hasCoords,
    street: String(draft?.street || parsed.baseAddress || trimmedAddress).trim(),
    detailsLine: [draft?.unit, draft?.subdivision]
      .map((part) => String(part || '').trim())
      .filter(Boolean)
      .join(' • '),
    instructions: String(draft?.instructions ?? parsed.instructions ?? '').trim(),
    coordsLabel: hasCoords ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : '',
  };
};

/** Serializes editable patient profile fields + coords for reliable dirty-state detection. */
export const buildProfileSnapshot = (profile, homeCoords = null) => {
  const lat = homeCoords?.lat != null ? Number(homeCoords.lat) : NaN;
  const lng = homeCoords?.lng != null ? Number(homeCoords.lng) : NaN;

  return JSON.stringify({
    phone: String(profile?.phone || ''),
    address: String(profile?.address || ''),
    emergency_contact_name: String(profile?.emergency_contact_name || ''),
    emergency_contact_phone: String(profile?.emergency_contact_phone || ''),
    medical_notes: String(profile?.medical_notes || ''),
    allergies: String(profile?.allergies || ''),
    chronic_conditions: String(profile?.chronic_conditions || ''),
    past_surgeries: String(profile?.past_surgeries || ''),
    lat: Number.isFinite(lat) ? Number(lat.toFixed(6)) : null,
    lng: Number.isFinite(lng) ? Number(lng.toFixed(6)) : null,
  });
};

/** Returns true when current form values or pinned coordinates differ from the saved baseline. */
export const isProfileDirty = (savedSnapshot, profile, homeCoords = null) =>
  Boolean(savedSnapshot) && buildProfileSnapshot(profile, homeCoords) !== savedSnapshot;

/**
 * PostgREST reports unknown columns as PGRST204; raw Postgres uses 42703.
 * Lets callers retry a write without optional structured columns on databases
 * where the additive migration has not been applied yet.
 */
export const isMissingColumnError = (error) =>
  error?.code === 'PGRST204' ||
  error?.code === '42703' ||
  /column .* does not exist/i.test(error?.message || '');

/**
 * When the medical history could not be loaded, saving would clobber the
 * stored row with the blank form fields. Skip the write only in that case
 * and only when a row already exists to protect.
 */
export const shouldSkipMedicalHistoryWrite = (historyLoaded, hasExisting) =>
  !historyLoaded && hasExisting;
