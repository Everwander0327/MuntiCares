/**
 * MuntiCares Application Constants & Configuration
 */

export const SITE_URL =
  import.meta.env.VITE_SITE_URL || 'https://munti-cares-alpha.vercel.app';

export const MUNTINLUPA_BARANGAYS = [
  'Alabang',
  'Bayanan',
  'Buli',
  'Cupang',
  'Poblacion',
  'Putatan',
  'Sucat',
  'Tunasan',
  'Ayala Alabang',
];

export const WORKING_HOURS = {
  START: 9,
  END: 17,
  SLOT_DURATION_MINUTES: 30,
};

export const USER_ROLES = {
  PATIENT: 'patient',
  PROVIDER: 'provider',
  ADMIN: 'admin',
};

export const ROLE_DEFAULT_ROUTES = {
  patient: '/patient/dashboard',
  provider: '/provider/dashboard',
  admin: '/admin/dashboard',
};

export const SERVICE_CATEGORIES = [
  'General Consultation',
  'Nursing Care',
  'Physical Therapy',
  'Wound Dressing',
  'Elderly Care',
  'Post-Operative Care',
  'Vital Signs Monitoring',
  'Medication Administration',
];

/**
 * Service Duration Configuration (Single Source of Truth)
 * Measured in 30-minute slot units.
 * 1 slot = 30 minutes, 2 slots = 60 minutes.
 */
export const SERVICE_SLOT_DURATIONS = {
  'General Consultation': 1,
  'General Care': 1,
  'Vital Signs Monitoring': 1,
  'Vital Signs & Wellness': 1,
  'Medication Administration': 1,
  'Elderly Care': 2,
  'Nursing Care': 2,
  'Post-Operative Care': 2,
  'Post-Operative Nursing': 2,
  'Physical Therapy': 2,
  'Wound Dressing': 2,
  'Wound Care': 2,
  'Complex Wound Care': 2,
};

export const DEFAULT_SERVICE_SLOTS = 1;

/**
 * Returns duration in minutes for a given service.
 * Defaults to 30 minutes if service is unspecified or unrecognized.
 */
export function getServiceDurationMinutes(serviceName) {
  if (!serviceName || typeof serviceName !== 'string') {
    return WORKING_HOURS.SLOT_DURATION_MINUTES;
  }
  const trimmed = serviceName.trim();
  if (SERVICE_SLOT_DURATIONS[trimmed]) {
    return SERVICE_SLOT_DURATIONS[trimmed] * WORKING_HOURS.SLOT_DURATION_MINUTES;
  }
  const lower = trimmed.toLowerCase();
  for (const [key, slots] of Object.entries(SERVICE_SLOT_DURATIONS)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) {
      return slots * WORKING_HOURS.SLOT_DURATION_MINUTES;
    }
  }
  return DEFAULT_SERVICE_SLOTS * WORKING_HOURS.SLOT_DURATION_MINUTES;
}

/**
 * Returns the number of 30-minute slots required for a service.
 */
export function getServiceSlotsCount(serviceName) {
  return getServiceDurationMinutes(serviceName) / WORKING_HOURS.SLOT_DURATION_MINUTES;
}
