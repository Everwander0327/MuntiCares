import { useState, useEffect, useRef } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { motion } from 'framer-motion';
import {
  ShieldCheck,
  ShieldWarning,
  Star,
  X,
  MapPin,
  Phone,
  Envelope,
  Check,
  Prohibit,
  Clock,
  ArrowSquareOut,
  FileText,
  Warning,
} from '@phosphor-icons/react';
import useBodyScrollLock from '@/hooks/useBodyScrollLock';
import useBottomDrawerDrag from '@/hooks/useBottomDrawerDrag';
import { useLanguage } from '@/contexts/LanguageContext';
import { canApproveProvider } from '@/features/admin/utils/providerEligibility';
import {
  getIdStatusMeta,
  getProviderInitials,
  getProviderStatusClasses,
} from './providerDisplay';

const MODAL_TABS = [
  { id: 'profile', labelKey: 'admin.providerModal.tabProfile', buttonId: 'provider-tab-profile', panelId: 'provider-panel-profile' },
  { id: 'actions', labelKey: 'admin.providerModal.tabActions', buttonId: 'provider-tab-actions', panelId: 'provider-panel-actions' },
];

const CONFIRM_SPECS = {
  verify_id: (provider, t) => ({
    title: t('admin.providerModal.confirmVerifyTitle', { name: provider.name }),
    message: t('admin.providerModal.confirmVerifyMsg', { name: provider.name }),
    confirmLabel: t('admin.providerModal.confirmVerifyBtn'),
    destructive: false,
  }),
  reject_id: (provider, t) => ({
    title: t('admin.providerModal.confirmRejectTitle', { name: provider.name }),
    message: t('admin.providerModal.confirmRejectMsg', { name: provider.name }),
    confirmLabel: t('admin.providerModal.confirmRejectBtn'),
    destructive: true,
  }),
  revoke_approval: (provider, t) => ({
    title: t('admin.providerModal.confirmRevokeTitle', { name: provider.name }),
    message: t('admin.providerModal.confirmRevokeMsg', { name: provider.name }),
    confirmLabel: t('admin.providerModal.confirmRevokeBtn'),
    destructive: true,
  }),
  ban: (provider, t) => ({
    title: provider.is_banned
      ? t('admin.providerModal.confirmUnbanTitle', { name: provider.name })
      : t('admin.providerModal.confirmBanTitle', { name: provider.name }),
    message: provider.is_banned
      ? t('admin.providerModal.confirmUnbanMsg', { name: provider.name })
      : t('admin.providerModal.confirmBanMsg', { name: provider.name }),
    confirmLabel: provider.is_banned ? t('admin.providerModal.confirmUnbanBtn') : t('admin.providerModal.confirmBanBtn'),
    destructive: !provider.is_banned,
  }),
  remove: (provider, t) => ({
    title: t('admin.providerModal.confirmRemoveTitle', { name: provider.name }),
    message: t('admin.providerModal.confirmRemoveMsg', { name: provider.name }),
    confirmLabel: t('admin.providerModal.confirmRemoveBtn'),
    destructive: true,
  }),
};

function IdStatusIcon({ status, className = 'w-4 h-4 shrink-0' }) {
  if (status === 'verified') return <ShieldCheck className={className} aria-hidden="true" />;
  if (status === 'pending') return <Clock className={className} aria-hidden="true" />;
  if (status === 'rejected') return <X className={className} aria-hidden="true" />;
  return <ShieldWarning className={className} aria-hidden="true" />;
}

/**
 * Centered 2-tab accessible verification modal for admin/providers.
 * Uses Radix Dialog for role="dialog", aria-modal, focus trap, Esc, backdrop dismiss,
 * and focus return, paired with useBodyScrollLock to lock scroll & hide mobile nav.
 */
export default function ProviderVerificationModal({
  provider,
  professionalIdPreviews,
  actionLoading,
  docActionLoading,
  onClose,
  onApprove,
  onRevokeApproval,
  onBanToggle,
  onVerifyDocument,
  onRejectDocument,
  onRemove,
}) {
  const { t, language, translateService, translateStatus } = useLanguage();
  const [activeTab, setActiveTab] = useState('profile');
  const [pendingConfirmType, setPendingConfirmType] = useState(null);
  const cancelConfirmRef = useRef(null);
  const tabRefs = useRef({});

  const isOpen = Boolean(provider);
  const isBusy = actionLoading || docActionLoading;
  useBodyScrollLock(isOpen);
  const { drawerMotionProps, dragHandleProps } = useBottomDrawerDrag({
    onClose: () => {
      if (!isBusy) {
        setPendingConfirmType(null);
        onClose();
      }
    },
    disabled: isBusy,
  });

  useEffect(() => {
    setActiveTab('profile');
    setPendingConfirmType(null);
  }, [provider?.id]);

  useEffect(() => {
    if (pendingConfirmType && cancelConfirmRef.current) {
      cancelConfirmRef.current.focus();
    }
  }, [pendingConfirmType]);

  const switchTab = (nextTabId) => {
    setActiveTab(nextTabId);
    setPendingConfirmType(null);
  };

  const handleTabKeyDown = (event, currentIndex) => {
    let nextIndex = null;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % MODAL_TABS.length;
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + MODAL_TABS.length) % MODAL_TABS.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = MODAL_TABS.length - 1;

    if (nextIndex !== null) {
      event.preventDefault();
      const targetTab = MODAL_TABS[nextIndex];
      switchTab(targetTab.id);
      tabRefs.current[targetTab.id]?.focus();
    }
  };

  const handleConfirmExecute = async () => {
    if (!provider || !pendingConfirmType) return;
    const currentType = pendingConfirmType;
    setPendingConfirmType(null);

    if (currentType === 'verify_id') await onVerifyDocument(provider);
    else if (currentType === 'reject_id') await onRejectDocument(provider);
    else if (currentType === 'revoke_approval') await onRevokeApproval(provider);
    else if (currentType === 'ban') await onBanToggle(provider);
    else if (currentType === 'remove') await onRemove(provider);
  };

  const confirmSpec =
    provider && pendingConfirmType && CONFIRM_SPECS[pendingConfirmType]
      ? CONFIRM_SPECS[pendingConfirmType](provider, t)
      : null;

  const idStatusMeta = provider ? getIdStatusMeta(provider.professional_id_status, language) : null;
  const hasStoredIdRecords = provider
    ? Boolean(
        provider.professional_id_paths?.length > 0 ||
          provider.professional_id_path ||
          provider.professional_id_status === 'verified' ||
          provider.professional_id_status === 'rejected'
      )
    : false;

  return (
    <DialogPrimitive.Root
      open={isOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isBusy) {
          setPendingConfirmType(null);
          onClose();
        }
      }}
    >
      {provider && (
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-overlay bg-slate-900/60 dark:bg-black/75 sm:backdrop-blur-sm" />
          <DialogPrimitive.Content
            aria-modal="true"
            onEscapeKeyDown={(event) => {
              if (isBusy) {
                event.preventDefault();
                return;
              }
              if (pendingConfirmType) {
                event.preventDefault();
                setPendingConfirmType(null);
              }
            }}
            onInteractOutside={(event) => {
              if (isBusy) event.preventDefault();
            }}
            onClick={() => {
              if (!isBusy) {
                setPendingConfirmType(null);
                onClose();
              }
            }}
            className="fixed inset-0 z-overlay flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 focus:outline-none"
          >
            <motion.div
              onClick={(event) => event.stopPropagation()}
              className="neu-flat rounded-t-[2rem] sm:rounded-[2rem] w-full max-w-xl max-h-[92dvh] border-t sm:border border-white/70 dark:border-white/10 shadow-2xl bg-surface-shell flex flex-col overflow-hidden"
              {...drawerMotionProps}
            >
            {/* Modal Header */}
            <div
              className="px-4 sm:px-6 pt-3 sm:pt-5 pb-4 border-b border-surface-border bg-surface-shell shrink-0 cursor-grab sm:cursor-auto active:cursor-grabbing sm:active:cursor-auto"
              {...dragHandleProps}
            >
              <div className="mx-auto mb-2.5 h-1.5 w-11 rounded-full bg-slate-300/90 dark:bg-slate-600/80 sm:hidden shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <DialogPrimitive.Title className="text-lg font-display font-black text-ink dark:text-txt-darkPrimary">
                    {t('admin.providerModal.title')}
                  </DialogPrimitive.Title>
                  <span
                    className={`inline-flex items-center text-xs font-extrabold uppercase tracking-wider ${getProviderStatusClasses(
                      provider.status
                    )}`}
                  >
                    {translateStatus(provider.status)}
                  </span>
                </div>
                <DialogPrimitive.Description className="text-xs text-tertiary dark:text-tertiary font-semibold mt-0.5 truncate">
                  {provider.name} — {provider.email}
                </DialogPrimitive.Description>
              </div>
            </div>

            {/* 2-Tab Switcher */}
            <div
              role="tablist"
              aria-label={t('admin.providerModal.tabsAria')}
              className="grid grid-cols-2 gap-2 px-4 sm:px-6 pt-1 border-b border-surface-border bg-surface-shell shrink-0"
            >
              {MODAL_TABS.map((tab, index) => {
                const isSelected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    ref={(el) => {
                      tabRefs.current[tab.id] = el;
                    }}
                    id={tab.buttonId}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    tabIndex={isSelected ? 0 : -1}
                    onClick={() => switchTab(tab.id)}
                    onKeyDown={(event) => handleTabKeyDown(event, index)}
                    className={`relative min-h-[2.75rem] px-3 py-2 text-xs sm:text-sm font-extrabold transition-colors flex items-center justify-center border-b-2 -mb-px ${
                      isSelected
                        ? 'text-link border-primary'
                        : 'text-tertiary hover:text-ink dark:hover:text-txt-darkPrimary border-transparent'
                    }`}
                  >
                    <span>{t(tab.labelKey)}</span>
                  </button>
                );
              })}
            </div>

            {/* Scrollable Body */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 overscroll-contain">
              {/* Inline In-Modal Confirmation Panel (Replaces window.confirm) */}
              {confirmSpec && (
                <div
                  role="alertdialog"
                  aria-labelledby="provider-inline-confirm-title"
                  aria-describedby="provider-inline-confirm-desc"
                  className={`rounded-2xl p-4 space-y-3 border ${
                    confirmSpec.destructive
                      ? 'border-danger/40 bg-danger-soft/70 dark:bg-danger-darkSoft/70'
                      : 'border-primary/35 bg-primary-soft/60 dark:bg-primary-800/40'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Warning
                      className={`w-5 h-5 shrink-0 mt-0.5 ${
                        confirmSpec.destructive
                          ? 'text-danger dark:text-danger-dark'
                          : 'text-link'
                      }`}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 space-y-1">
                      <h3
                        id="provider-inline-confirm-title"
                        className="text-sm font-black text-slate-900 dark:text-white"
                      >
                        {confirmSpec.title}
                      </h3>
                      <p
                        id="provider-inline-confirm-desc"
                        className="text-xs font-medium text-slate-700 dark:text-slate-200 leading-relaxed"
                      >
                        {confirmSpec.message}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                    <button
                      ref={cancelConfirmRef}
                      type="button"
                      disabled={isBusy}
                      onClick={() => setPendingConfirmType(null)}
                      className="neu-btn min-h-[2.75rem] px-4 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 disabled:opacity-50"
                    >
                      {t('admin.providerModal.cancel')}
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={handleConfirmExecute}
                      className={`min-h-[2.75rem] px-4 rounded-xl text-xs font-black text-white transition-opacity disabled:opacity-50 ${
                        confirmSpec.destructive ? 'bg-danger hover:bg-danger/90' : 'bg-primary hover:bg-primary-hover'
                      }`}
                    >
                      {isBusy ? t('admin.providerModal.processing') : confirmSpec.confirmLabel}
                    </button>
                  </div>
                </div>
              )}

              {/* Tab 1: Profile & IDs */}
              <div
                id="provider-panel-profile"
                role="tabpanel"
                aria-labelledby="provider-tab-profile"
                hidden={activeTab !== 'profile'}
                className="space-y-5"
              >
                {/* Provider Summary */}
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-primary-soft dark:bg-primary-800/70 flex items-center justify-center text-base font-extrabold text-link overflow-hidden shrink-0">
                    {provider.avatar_url ? (
                      <img src={provider.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      getProviderInitials(provider.name)
                    )}
                  </div>
                  <div className="min-w-0 space-y-1">
                    <h3 className="text-lg font-display font-black text-ink dark:text-txt-darkPrimary truncate">
                      {provider.name}
                    </h3>
                    <p className="text-link text-xs font-semibold">
                      {provider.bio || t('admin.providerModal.generalProvider')}
                    </p>
                    <p className="text-xs text-tertiary font-medium tabular-nums">
                      {t('admin.providerModal.joinedPrefix', { date: provider.joinDate })}
                    </p>
                  </div>
                </div>

                {/* Contact Info & Trust Score */}
                <div className="border-y border-surface-border/70 py-3.5 space-y-2.5 text-xs">
                  <div className="flex items-center gap-3 text-txt-secondary dark:text-txt-darkSecondary font-medium">
                    <Envelope className="w-4 h-4 text-link shrink-0" aria-hidden="true" />
                    <span className="truncate">{provider.email || t('admin.providerModal.noEmailListed')}</span>
                  </div>
                  <div className="flex items-center gap-3 text-txt-secondary dark:text-txt-darkSecondary font-medium">
                    <Phone className="w-4 h-4 text-link shrink-0" aria-hidden="true" />
                    <span>{provider.phone || t('admin.providerModal.notProvided')}</span>
                  </div>
                  <div className="flex items-center gap-3 text-txt-secondary dark:text-txt-darkSecondary font-medium">
                    <MapPin className="w-4 h-4 text-link shrink-0" aria-hidden="true" />
                    <span>{provider.location}</span>
                  </div>
                  <div className="flex items-center gap-3 text-ink dark:text-txt-darkPrimary font-bold tabular-nums">
                    <Star weight="fill" className="w-4 h-4 text-warning fill-current shrink-0" aria-hidden="true" />
                    <span>
                      {Number(provider.rating) > 0
                        ? t('admin.providerModal.ratingText', { rating: Number(provider.rating).toFixed(1) })
                        : t('admin.providerModal.noReviewsPrefix')}
                      {t('admin.providerModal.trustScoreText', { score: provider.trust_score })}
                    </span>
                  </div>
                </div>

                {/* Specializations */}
                <div>
                  <p className="text-xs text-tertiary dark:text-tertiary font-extrabold uppercase tracking-wider mb-1.5">
                    {t('admin.providerModal.specializations')}
                  </p>
                  {provider.services.length > 0 ? (
                    <p className="text-xs font-semibold text-ink dark:text-txt-darkPrimary leading-relaxed">
                      {provider.services.map((s) => translateService(s)).join(', ')}
                    </p>
                  ) : (
                    <p className="text-tertiary text-xs">{t('admin.providerModal.noSpecializations')}</p>
                  )}
                </div>

                {/* Professional ID Documents */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-tertiary dark:text-tertiary font-extrabold uppercase tracking-wider">
                      {t('admin.providerModal.docSectionTitle')}
                    </p>
                    {idStatusMeta && (
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-extrabold ${idStatusMeta.toneClass}`}
                      >
                        <IdStatusIcon status={provider.professional_id_status} className="w-3.5 h-3.5" />
                        <span>{idStatusMeta.label}</span>
                      </span>
                    )}
                  </div>

                  {hasStoredIdRecords ? (
                    <>
                      {professionalIdPreviews.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {professionalIdPreviews.map((url, index) => (
                            <div key={`${url}-${index}`} className="rounded-2xl overflow-hidden border border-surface-border bg-surface-subtle/40 p-2">
                              {url.endsWith('.pdf') ? (
                                <div className="flex items-center gap-2 p-2">
                                  <FileText className="w-5 h-5 text-link shrink-0" aria-hidden="true" />
                                  <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                                    {t('admin.providerModal.docItem', { index: index + 1 })}
                                  </span>
                                  <a
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label={t('admin.providerModal.openDocAria', { index: index + 1 })}
                                    className="ml-auto shrink-0 neu-btn min-w-[2.75rem] min-h-[2.75rem] flex items-center justify-center rounded-xl"
                                  >
                                    <ArrowSquareOut className="w-4 h-4 text-link" aria-hidden="true" />
                                  </a>
                                </div>
                              ) : (
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block rounded-xl overflow-hidden"
                                >
                                  <img
                                    src={url}
                                    alt={t('admin.providerModal.idPreviewAlt', { index: index + 1 })}
                                    className="w-full h-32 object-contain rounded-xl"
                                  />
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : provider.professional_id_paths?.length > 0 || provider.professional_id_path ? (
                        <p className="text-xs text-tertiary p-2">{t('admin.providerModal.loadingPreview')}</p>
                      ) : null}

                      {provider.professional_id_status === 'pending' && (
                        <div className="grid grid-cols-2 gap-2.5 pt-1">
                          <button
                            type="button"
                            onClick={() => setPendingConfirmType('verify_id')}
                            disabled={isBusy}
                            className="neu-btn min-h-[2.75rem] flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs text-success dark:text-success-dark transition-all disabled:opacity-50"
                          >
                            <Check className="w-4 h-4" aria-hidden="true" />
                            <span>{docActionLoading ? '...' : t('admin.providerModal.verifyIdBtn')}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingConfirmType('reject_id')}
                            disabled={isBusy}
                            className="neu-btn min-h-[2.75rem] flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs text-danger dark:text-danger-dark transition-all disabled:opacity-50"
                          >
                            <X className="w-4 h-4" aria-hidden="true" />
                            <span>{docActionLoading ? '...' : t('admin.providerModal.rejectIdBtn')}</span>
                          </button>
                        </div>
                      )}

                      {provider.professional_id_status === 'verified' && (
                        <div className="flex items-center gap-2 px-3.5 py-2.5 bg-success-soft/70 dark:bg-success-darkSoft/70 text-success dark:text-success-dark rounded-xl text-xs font-bold">
                          <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
                          <span>{t('admin.providerModal.idVerifiedBanner')}</span>
                        </div>
                      )}

                      {provider.professional_id_status === 'rejected' && (
                        <div className="flex items-center gap-2 px-3.5 py-2.5 bg-danger-soft/70 dark:bg-danger-darkSoft/70 text-danger dark:text-danger-dark rounded-xl text-xs font-bold">
                          <X className="w-4 h-4 shrink-0" aria-hidden="true" />
                          <span>{t('admin.providerModal.idRejectedBanner')}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center gap-2.5 p-3.5 border border-surface-border bg-surface-subtle/40 rounded-2xl text-xs font-semibold text-tertiary dark:text-tertiary">
                      <ShieldWarning className="w-4 h-4 text-tertiary shrink-0" aria-hidden="true" />
                      <span>
                        {t('admin.providerModal.noCredsPrefix')}
                        <strong className="text-ink dark:text-txt-darkPrimary">{t('admin.providerModal.unverifiedWord')}</strong>
                        {t('admin.providerModal.noCredsSuffix')}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Tab 2: Account Actions */}
              <div
                id="provider-panel-actions"
                role="tabpanel"
                aria-labelledby="provider-tab-actions"
                hidden={activeTab !== 'actions'}
                className="space-y-5"
              >
                {/* Approval Controls */}
                <div className="border border-surface-border bg-surface-subtle/40 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-ink dark:text-txt-darkPrimary">
                      {t('admin.providerModal.directoryApprovalTitle')}
                    </h3>
                    <span
                      className={`inline-flex items-center text-xs font-extrabold uppercase tracking-wider ${getProviderStatusClasses(
                        provider.status
                      )}`}
                    >
                      {translateStatus(provider.status)}
                    </span>
                  </div>

                  {provider.status === 'Pending Approval' && (
                    <>
                      <button
                        type="button"
                        onClick={() => onApprove(provider)}
                        disabled={isBusy || !canApproveProvider(provider)}
                        className="w-full neu-btn min-h-[2.75rem] flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-black text-xs text-success dark:text-success-dark transition-all disabled:opacity-50"
                      >
                        <Check className="w-4 h-4" aria-hidden="true" />
                        <span>{actionLoading ? t('admin.providerModal.processing') : t('admin.providerModal.approveBtn')}</span>
                      </button>
                      {!canApproveProvider(provider) && (
                        <p className="text-xs text-tertiary font-medium">
                          {t('admin.providerModal.incompleteBeforeApprove')}
                        </p>
                      )}
                    </>
                  )}

                  {provider.status === 'Approved' && (
                    <button
                      type="button"
                      onClick={() => setPendingConfirmType('revoke_approval')}
                      disabled={isBusy}
                      className="w-full neu-btn min-h-[2.75rem] flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-black text-xs text-warning dark:text-warning-dark transition-all disabled:opacity-50"
                    >
                      <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                      <span>{actionLoading ? t('admin.providerModal.processing') : t('admin.providerModal.revokeBtn')}</span>
                    </button>
                  )}

                  {(provider.status === 'Incomplete' || provider.status === 'Banned') && (
                    <p className="text-xs font-medium text-tertiary dark:text-tertiary">
                      {provider.status === 'Banned'
                        ? t('admin.providerModal.bannedHint')
                        : t('admin.providerModal.incompleteHint')}
                    </p>
                  )}
                </div>

                {/* Visually Distinct Danger Zone */}
                <div className="rounded-2xl border border-danger/35 bg-danger/[0.04] dark:bg-danger/[0.08] p-4 space-y-3">
                  <div className="flex items-center gap-2 text-danger dark:text-danger-dark">
                    <ShieldWarning className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <h3 className="text-xs font-black uppercase tracking-wider">{t('admin.providerModal.dangerZoneTitle')}</h3>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                    {t('admin.providerModal.dangerZoneDesc')}
                  </p>

                  <div className="space-y-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setPendingConfirmType('ban')}
                      disabled={isBusy}
                      className={`w-full neu-btn min-h-[2.75rem] flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-black text-xs transition-all disabled:opacity-50 ${
                        provider.is_banned
                          ? 'text-success dark:text-success-dark'
                          : 'text-danger dark:text-danger-dark'
                      }`}
                    >
                      <Prohibit className="w-4 h-4" aria-hidden="true" />
                      <span>
                        {actionLoading
                          ? t('admin.providerModal.processing')
                          : provider.is_banned
                            ? t('admin.providerModal.unbanBtn')
                            : t('admin.providerModal.banBtn')}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPendingConfirmType('remove')}
                      disabled={isBusy}
                      className="w-full neu-btn min-h-[2.75rem] flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-black text-xs text-danger dark:text-danger-dark transition-all disabled:opacity-50"
                    >
                      <X className="w-4 h-4" aria-hidden="true" />
                      <span>{actionLoading ? t('admin.providerModal.processing') : t('admin.providerModal.removeBtn')}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-surface-border bg-surface-shell/80 shrink-0">
              <button
                type="button"
                disabled={isBusy}
                onClick={() => {
                  setPendingConfirmType(null);
                  onClose();
                }}
                className="w-full neu-btn min-h-[2.75rem] py-3 rounded-2xl text-xs sm:text-sm font-black text-slate-700 dark:text-slate-200 hover:text-link transition-all flex items-center justify-center disabled:opacity-50"
              >
                {t('admin.providerModal.closeFooter')}
              </button>
            </div>
            </motion.div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      )}
    </DialogPrimitive.Root>
  );
}
