import * as DialogPrimitive from '@radix-ui/react-dialog';
import { motion, useReducedMotion } from 'framer-motion';
import { CheckCircle, DownloadSimple, FileCode, SignOut } from '@phosphor-icons/react';
import useBodyScrollLock from '@/hooks/useBodyScrollLock';
import useBottomDrawerDrag from '@/hooks/useBottomDrawerDrag';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Mobile Account Hub bottom sheet consolidating secondary profile details,
 * health data exports (PDF & FHIR JSON), and Sign Out to keep the main profile
 * tabs immediately accessible above the fold on mobile viewports.
 */
export default function ProfileMobileAccountSheet({
  open,
  onClose,
  fullName = '',
  email = '',
  phone = '',
  address = '',
  memberSince = 'N/A',
  isComplete = false,
  completionPercentage = 0,
  generatingPdf = false,
  fhirLoading = false,
  hasUnsavedChanges = false,
  onExportPdf,
  onExportFhir,
  onLogout,
}) {
  const { t } = useLanguage();
  const prefersReducedMotion = useReducedMotion();
  useBodyScrollLock(open);
  const { drawerMotionProps, dragHandleProps } = useBottomDrawerDrag({
    onClose,
    mobileQuery: '(max-width: 1023px)',
  });

  const runActionThenClose = (action) => {
    onClose?.();
    action?.();
  };

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose?.();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-overlay bg-slate-950/70 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content asChild aria-modal="true">
          <motion.div
            className="fixed inset-0 z-overlay flex items-end justify-center p-0 sm:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.16 }}
            onClick={() => onClose?.()}
          >
            <motion.div
              className="neu-flat rounded-t-[2rem] sm:rounded-[2rem] w-full max-w-md flex flex-col relative max-h-[88dvh] overflow-hidden shadow-2xl border-t sm:border border-white/70 dark:border-white/10"
              initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 36 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.24, ease: [0.32, 0.72, 0, 1] }}
              onClick={(e) => e.stopPropagation()}
              {...drawerMotionProps}
            >
              <div
                className="shrink-0 px-5 pt-3 pb-3.5 border-b border-slate-200/75 dark:border-white/10 cursor-grab active:cursor-grabbing"
                {...dragHandleProps}
              >
                <div
                  className="mx-auto mb-2.5 h-1.5 w-11 rounded-full bg-slate-300/90 dark:bg-slate-600/80 shrink-0"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <DialogPrimitive.Title className="text-base font-black text-slate-900 dark:text-slate-100 truncate">
                    {t('patient.accountSheet.title')}
                  </DialogPrimitive.Title>
                  <DialogPrimitive.Description className="text-xs text-tertiary dark:text-tertiary truncate mt-0.5">
                    {fullName || t('patient.accountSheet.defaultName')} • {email}
                  </DialogPrimitive.Description>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="neu-flat-sm px-3 py-1 text-link font-black text-2xs uppercase tracking-widest rounded-md">
                    {t('patient.accountSheet.roleLabel')}
                  </span>
                  {isComplete ? (
                    <span className="neu-flat-sm px-3 py-1 text-success dark:text-success-dark font-black text-2xs uppercase tracking-widest rounded-md flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> {t('patient.accountSheet.completeBadge')}
                    </span>
                  ) : (
                    <span className="neu-flat-sm px-3 py-1 text-warning dark:text-warning-dark font-black text-2xs uppercase tracking-widest rounded-md">
                      {t('patient.accountSheet.setupPct', { pct: completionPercentage })}
                    </span>
                  )}
                </div>

                {/* Account Quick Info */}
                <div className="neu-inset p-4 rounded-2xl space-y-2.5 text-xs sm:text-sm text-slate-700 dark:text-slate-200">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-2xs uppercase font-extrabold text-tertiary">{t('patient.accountSheet.email')}</span>
                    <span className="truncate font-semibold max-w-[68%] text-right">{email}</span>
                  </div>
                  <div className="border-t border-slate-200/50 dark:border-white/5" />
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-2xs uppercase font-extrabold text-tertiary">{t('patient.accountSheet.phone')}</span>
                    <span className="font-semibold text-right">{phone || t('patient.accountSheet.notSet')}</span>
                  </div>
                  <div className="border-t border-slate-200/50 dark:border-white/5" />
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-2xs uppercase font-extrabold text-tertiary shrink-0 pt-0.5">{t('patient.accountSheet.homePin')}</span>
                    <span className="font-semibold text-right leading-relaxed max-w-[70%] break-words">
                      {address || t('patient.accountSheet.notSet')}
                    </span>
                  </div>
                  <div className="border-t border-slate-200/50 dark:border-white/5" />
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-2xs uppercase font-extrabold text-tertiary">{t('patient.accountSheet.memberSince')}</span>
                    <span className="font-semibold">{memberSince}</span>
                  </div>
                </div>

                {/* Health Data Export */}
                <div className="space-y-2">
                  <p className="text-2xs font-extrabold text-tertiary dark:text-tertiary uppercase tracking-widest ml-1">
                    {t('patient.accountSheet.exportsHeading')}
                  </p>
                  <div className="neu-inset p-2 rounded-2xl space-y-2">
                    <button
                      type="button"
                      onClick={() => runActionThenClose(onExportPdf)}
                      disabled={generatingPdf}
                      aria-busy={generatingPdf}
                      className="neu-btn w-full min-h-[2.75rem] flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl font-bold text-link transition-all text-xs sm:text-sm cursor-pointer disabled:opacity-50"
                    >
                      <DownloadSimple className="w-4 h-4" aria-hidden="true" />
                      <span>{generatingPdf ? t('patient.accountSheet.generatingPdf') : t('patient.accountSheet.pdfBtn')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => runActionThenClose(onExportFhir)}
                      disabled={fhirLoading}
                      aria-busy={fhirLoading}
                      className="neu-btn w-full min-h-[2.75rem] flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl font-bold text-success dark:text-success-dark transition-all text-xs sm:text-sm cursor-pointer disabled:opacity-50"
                    >
                      <FileCode className="w-4 h-4" aria-hidden="true" />
                      <span>{fhirLoading ? t('patient.accountSheet.exportingFhir') : t('patient.accountSheet.fhirBtn')}</span>
                    </button>
                  </div>
                </div>

                {/* Sign Out */}
                <div className="pt-1 pb-2 space-y-2">
                  {hasUnsavedChanges && (
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 text-center">
                      {t('patient.accountSheet.unsavedWarning')}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => runActionThenClose(onLogout)}
                    className="neu-btn w-full min-h-[2.75rem] flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-danger dark:text-danger-dark transition-all text-xs sm:text-sm cursor-pointer"
                  >
                    <SignOut className="w-4 h-4" />
                    <span>{t('patient.accountSheet.signOut')}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
