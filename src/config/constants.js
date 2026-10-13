/**
 * MuntiCares Application Constants & Configuration
 */

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
  SLOT_DURATION_MINUTES: 60,
};

export const APPOINTMENT_STATUSES = {
  PENDING: 'pending',
  APPROVED: 'approved',
  CONFIRMED: 'confirmed',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  DECLINED: 'declined',
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
