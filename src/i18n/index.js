import { common } from './common';
import { navigation } from './navigation';
import { settings } from './settings';
import { chat } from './chat';
import { tracking } from './tracking';
import { patient } from './patient';
import { provider } from './provider';
import { admin } from './admin';

export const SUPPORTED_LANGUAGES = ['en', 'tl'];
export const DEFAULT_LANGUAGE = 'en';
export const LANGUAGE_STORAGE_KEY = 'mc_language';

const NAMESPACES = {
  common,
  navigation,
  settings,
  chat,
  tracking,
  patient,
  provider,
  admin,
};

export const NAMESPACE_MAP = NAMESPACES;

export const TRANSLATIONS = {
  en: Object.assign(
    {},
    common.en,
    navigation.en,
    settings.en,
    chat.en,
    tracking.en,
    patient.en,
    provider.en,
    admin.en
  ),
  tl: Object.assign(
    {},
    common.tl,
    navigation.tl,
    settings.tl,
    chat.tl,
    tracking.tl,
    patient.tl,
    provider.tl,
    admin.tl
  ),
};

export function normalizeLanguage(value) {
  return value === 'tl' ? 'tl' : 'en';
}

export function getStoredLanguage() {
  try {
    if (typeof localStorage !== 'undefined') {
      return normalizeLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY));
    }
  } catch {
    // ignore storage access errors
  }
  return DEFAULT_LANGUAGE;
}

export function isPortalPath(pathname = '') {
  return (
    pathname.startsWith('/patient') ||
    pathname.startsWith('/provider') ||
    pathname.startsWith('/admin')
  );
}

export function translate(language, key, paramsOrFallback, maybeParams) {
  const lang = normalizeLanguage(language);
  const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;

  let fallback;
  let params;
  if (typeof paramsOrFallback === 'string') {
    fallback = paramsOrFallback;
    params = maybeParams;
  } else {
    params = paramsOrFallback;
  }

  let template = dict[key];
  if (template === undefined) {
    template = TRANSLATIONS.en[key] ?? fallback ?? key;
  }

  if (!params || typeof template !== 'string') {
    return template;
  }

  return template.replace(/\{\{(\w+)\}\}/g, (_, token) =>
    params[token] !== undefined && params[token] !== null ? String(params[token]) : ''
  );
}

export function getIntlLocale(language) {
  return normalizeLanguage(language) === 'tl' ? 'fil-PH' : 'en-US';
}

export function formatLocalizedDate(dateInput, language = DEFAULT_LANGUAGE, options) {
  if (!dateInput) return '';
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(getIntlLocale(language), options);
}

export function formatLocalizedTime(dateInput, language = DEFAULT_LANGUAGE, options) {
  if (!dateInput) return '';
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(getIntlLocale(language), options);
}

const SERVICE_KEY_MAP = {
  'general consultation': 'common.services.generalConsultation',
  'general care': 'common.services.generalCare',
  'nursing care': 'common.services.nursingCare',
  'physical therapy': 'common.services.physicalTherapy',
  'wound dressing': 'common.services.woundDressing',
  'wound care': 'common.services.woundCare',
  'complex wound care': 'common.services.complexWoundCare',
  'elderly care': 'common.services.elderlyCare',
  'post-operative care': 'common.services.postOperativeCare',
  'post-operative nursing': 'common.services.postOperativeNursing',
  'vital signs monitoring': 'common.services.vitalSignsMonitoring',
  'vital signs & wellness': 'common.services.vitalSignsWellness',
  'medication administration': 'common.services.medicationAdministration',
};

export function translateServiceName(serviceName, language = DEFAULT_LANGUAGE) {
  if (!serviceName || typeof serviceName !== 'string') return '';
  const normalized = serviceName.trim().toLowerCase();
  const key = SERVICE_KEY_MAP[normalized];
  return key ? translate(language, key) : serviceName;
}

const STATUS_KEY_MAP = {
  pending: 'common.status.pending',
  accepted: 'common.status.accepted',
  confirmed: 'common.status.confirmed',
  rejected: 'common.status.rejected',
  declined: 'common.status.declined',
  cancelled: 'common.status.cancelled',
  'on the way': 'common.status.onTheWay',
  on_the_way: 'common.status.onTheWay',
  arrived: 'common.status.arrived',
  'in progress': 'common.status.inProgress',
  in_progress: 'common.status.inProgress',
  completed: 'common.status.completed',
  verified: 'common.status.verified',
  active: 'common.status.active',
  approved: 'common.status.approved',
  'pending approval': 'common.status.pendingApproval',
  incomplete: 'common.status.incomplete',
  banned: 'common.status.banned',
  revoked: 'common.status.revoked',
  expired: 'common.status.expired',
};

export function translateStatus(status, language = DEFAULT_LANGUAGE) {
  if (!status || typeof status !== 'string') return '';
  const normalized = status.trim().toLowerCase();
  const key = STATUS_KEY_MAP[normalized];
  return key ? translate(language, key) : status;
}

export function translateRole(role, language = DEFAULT_LANGUAGE) {
  if (!role || typeof role !== 'string') return '';
  const normalized = role.trim().toLowerCase();
  if (normalized === 'patient') return translate(language, 'common.roles.patient');
  if (normalized === 'provider') return translate(language, 'common.roles.provider');
  if (normalized === 'admin') return translate(language, 'common.roles.admin');
  return role;
}
