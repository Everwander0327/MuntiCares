/**
 * Pure presentation and status helpers strictly for the admin/providers page.
 */
import { DEFAULT_LANGUAGE, translate } from '@/i18n';

export function needsProviderAction(provider) {
  return Boolean(
    provider &&
      (provider.status === 'Pending Approval' || provider.professional_id_status === 'pending')
  );
}

export function getProviderInitials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'PR';
  return parts
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function getProviderStatusClasses(status) {
  switch (status) {
    case 'Approved':
      return 'text-success dark:text-success-dark';
    case 'Pending Approval':
      return 'text-warning dark:text-warning-dark';
    case 'Banned':
      return 'text-danger dark:text-danger-dark';
    default:
      return 'text-tertiary dark:text-tertiary';
  }
}

export function getIdStatusMeta(idStatus, language = DEFAULT_LANGUAGE) {
  switch (idStatus) {
    case 'verified':
      return {
        label: translate(language, 'admin.idStatus.verifiedLabel'),
        shortLabel: translate(language, 'admin.idStatus.verifiedShort'),
        toneClass: 'text-success dark:text-success-dark',
      };
    case 'pending':
      return {
        label: translate(language, 'admin.idStatus.pendingLabel'),
        shortLabel: translate(language, 'admin.idStatus.pendingShort'),
        toneClass: 'text-warning dark:text-warning-dark',
      };
    case 'rejected':
      return {
        label: translate(language, 'admin.idStatus.rejectedLabel'),
        shortLabel: translate(language, 'admin.idStatus.rejectedShort'),
        toneClass: 'text-danger dark:text-danger-dark',
      };
    default:
      return {
        label: translate(language, 'admin.idStatus.unverifiedLabel'),
        shortLabel: translate(language, 'admin.idStatus.unverifiedShort'),
        toneClass: 'text-tertiary dark:text-tertiary',
      };
  }
}
