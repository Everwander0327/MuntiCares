import { isValidPhPhone } from '@/features/patient/utils/phone';
import { isCoordinateAddress } from '@/features/tracking/services/addressFormat';

export const TOTAL_STEPS = 5;
export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_ID_FILE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_ID_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

export const SUGGESTED_SERVICES = [
  'Wound Care',
  'Elderly Care',
  'Post-Surgery Recovery',
  'Physical Therapy',
  'Vital Signs Monitoring',
  'Medication Administration',
  'Dementia Care',
  'Stroke Rehab',
];

export const SERVICE_RADIUS_PRESETS = [3, 5, 10, 15, 25];

export const getProviderDraftKey = (userId) =>
  `mc_provider_onboarding_draft:${userId || 'guest'}`;

export const getProviderDeferredKey = (userId) =>
  `mc_provider_onboarding_deferred:${userId || 'guest'}`;

export const parseStepParam = (raw) => {
  const num = Number.parseInt(raw || '', 10);
  if (Number.isNaN(num) || num < 1 || num > TOTAL_STEPS) return 1;
  return num;
};

export const parseServiceList = (text) => {
  const seen = new Set();
  const out = [];
  String(text || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => {
      const lower = part.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        out.push(part);
      }
    });
  return out;
};

export const hasServiceItem = (list, value) => {
  const target = value.toLowerCase();
  return (Array.isArray(list) ? list : parseServiceList(list)).some(
    (item) => item.toLowerCase() === target
  );
};

export const toggleServiceItem = (list, value) => {
  const items = Array.isArray(list) ? [...list] : parseServiceList(list);
  const target = value.toLowerCase();
  if (items.some((item) => item.toLowerCase() === target)) {
    return items.filter((item) => item.toLowerCase() !== target);
  }
  return [...items, value];
};

export function buildProviderOnboardingDraft({
  fullName = '',
  phone = '',
  bio = '',
  coords = null,
  baseAddress = '',
  serviceRadiusKm = 10,
  services = [],
  licenseNumber = '',
  licenseExpiry = '',
  existingIdPaths = [],
  privacyConsent = false,
} = {}) {
  const hasContent = Boolean(
    String(fullName).trim() ||
      String(phone).trim() ||
      String(bio).trim() ||
      coords ||
      String(baseAddress).trim() ||
      services.length > 0 ||
      String(licenseNumber).trim() ||
      String(licenseExpiry).trim() ||
      existingIdPaths.length > 0 ||
      privacyConsent
  );
  if (!hasContent) return null;

  return {
    fullName,
    phone,
    bio,
    coords,
    baseAddress,
    serviceRadiusKm,
    services,
    licenseNumber,
    licenseExpiry,
    existingIdPaths,
    privacyConsent: Boolean(privacyConsent),
  };
}

export function loadProviderOnboardingDraft(userId, ttlMs = DRAFT_TTL_MS) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(getProviderDraftKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.savedAt && Date.now() - parsed.savedAt > ttlMs) {
      window.localStorage.removeItem(getProviderDraftKey(userId));
      return null;
    }
    return parsed.data || null;
  } catch {
    return null;
  }
}

export function clearProviderOnboardingDraft(userId) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(getProviderDraftKey(userId));
  } catch {
    // Storage may be unavailable in restricted contexts.
  }
}

export function validateIdFile(file, t) {
  if (!file) return '';
  if (!ALLOWED_ID_MIME_TYPES.has(file.type)) {
    return t('provider.onboarding.errIdFileType');
  }
  if (file.size > MAX_ID_FILE_BYTES) {
    return t('provider.onboarding.errIdFileSize');
  }
  return '';
}

export function validateProviderStep(step, state, t, { isPreview = false } = {}) {
  const errors = {};
  if (step === 1) {
    if (!isPreview && !String(state.fullName || '').trim()) {
      errors.fullName = t('provider.onboarding.errFullNameRequired');
    }
    if (!isValidPhPhone(state.phone)) {
      errors.phone = t('patient.phone.invalid');
    }
    if (String(state.bio || '').trim().length < 15) {
      errors.bio = t('provider.onboarding.errBioRequired');
    }
  } else if (step === 2) {
    const radius = Number(state.serviceRadiusKm);
    if (!state.coords && !String(state.baseAddress || '').trim()) {
      errors.coords = t('provider.onboarding.errCoordsRequired');
    } else if (
      String(state.baseAddress || '').trim() &&
      isCoordinateAddress(state.baseAddress) &&
      !state.coords
    ) {
      errors.coords = t('provider.onboarding.errCoordsRequired');
    }
    if (!Number.isFinite(radius) || radius < 1 || radius > 100) {
      errors.serviceRadiusKm = t('provider.profile.validationRadiusRange');
    }
  } else if (step === 3) {
    if (!Array.isArray(state.services) || state.services.length === 0) {
      errors.services = t('provider.profile.validationMinSpec');
    }
  } else if (step === 4) {
    if (!String(state.licenseNumber || '').trim()) {
      errors.licenseNumber = t('provider.onboarding.errLicenseRequired');
    }
    const hasExistingDocs =
      Array.isArray(state.existingIdPaths) && state.existingIdPaths.length > 0;
    const hasPendingFile = Boolean(state.idFile);
    if (!hasPendingFile && !hasExistingDocs) {
      errors.idFile = t('provider.onboarding.errIdFileRequired');
    } else if (hasPendingFile) {
      const fileError = validateIdFile(state.idFile, t);
      if (fileError) errors.idFile = fileError;
    }
  } else if (step === 5) {
    if (!state.privacyConsent) {
      errors.consent = t('provider.onboarding.errConsentRequired');
    }
  }
  return errors;
}
