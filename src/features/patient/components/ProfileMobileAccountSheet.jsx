import * as DialogPrimitive from '@radix-ui/react-dialog';
import { motion, useReducedMotion } from 'framer-motion';
import { CheckCircle2, Download, FileCode, Loader2, LogOut } from 'lucide-react';
import useBodyScrollLock from '@/hooks/useBodyScrollLock';
import useBottomDrawerDrag from '@/hooks/useBottomDrawerDrag';

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
              transition={{ duration: prefersReducedMotion ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              {...drawerMotionProps}
            >
              <div
                className="shrink-0 px-5 pt-3 pb-3.5 border-b border-slate-200/75 dark:border-white/10 cursor-grab active:cursor-grabbing"
                {...dragHandleProps}
              >
                <div
                  className="mx-auto mb-2.5 h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-600"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <DialogPrimitive.Title className="text-base font-black text-slate-900 dark:text-slate-100 truncate">
                    Account &amp; Health Exports
                  </DialogPrimitive.Title>
                  <DialogPrimitive.Description className="text-xs text-tertiary dark:text-tertiary truncate mt-0.5">
                    {fullName || 'Patient'} • {email}
                  </DialogPrimitive.Description>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="neu-flat-sm px-3 py-1 text-link font-black text-2xs uppercase tracking-widest rounded-md">
                    Patient
                  </span>
                  {isComplete ? (
                    <span className="neu-flat-sm px-3 py-1 text-success dark:text-success-dark font-black text-2xs uppercase tracking-widest rounded-md flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Complete
                    </span>
                  ) : (
                    <span className="neu-flat-sm px-3 py-1 text-warning dark:text-warning-dark font-black text-2xs uppercase tracking-widest rounded-md">
                      {completionPercentage}% Setup
                    </span>
                  )}
                </div>

                {/* Account Quick Info */}
                <div className="neu-inset p-4 rounded-2xl space-y-2.5 text-xs sm:text-sm text-slate-700 dark:text-slate-200">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-2xs uppercase font-extrabold text-tertiary">Email</span>
                    <span className="truncate font-semibold max-w-[68%] text-right">{email}</span>
                  </div>
                  <div className="border-t border-slate-200/50 dark:border-white/5" />
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-2xs uppercase font-extrabold text-tertiary">Phone</span>
                    <span className="font-semibold text-right">{phone || 'Not set'}</span>
                  </div>
                  <div className="border-t border-slate-200/50 dark:border-white/5" />
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-2xs uppercase font-extrabold text-tertiary shrink-0 pt-0.5">Home Pin</span>
                    <span className="font-semibold text-right leading-relaxed max-w-[70%] break-words">
                      {address || 'Not set'}
                    </span>
                  </div>
                  <div className="border-t border-slate-200/50 dark:border-white/5" />
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-2xs uppercase font-extrabold text-tertiary">Member Since</span>
                    <span className="font-semibold">{memberSince}</span>
                  </div>
                </div>

                {/* Health Data Export */}
                <div className="space-y-2">
                  <p className="text-2xs font-extrabold text-tertiary dark:text-tertiary uppercase tracking-widest ml-1">
                    Health Data Export
                  </p>
                  <div className="neu-inset p-2 rounded-2xl space-y-2">
                    <button
                      type="button"
                      onClick={() => runActionThenClose(onExportPdf)}
                      disabled={generatingPdf}
                      className="neu-btn w-full min-h-[44px] flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-link transition-all text-xs sm:text-sm cursor-pointer disabled:opacity-50"
                    >
                      {generatingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      <span>{generatingPdf ? 'Generating...' : 'Medical Summary (PDF)'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => runActionThenClose(onExportFhir)}
                      disabled={fhirLoading}
                      className="neu-btn w-full min-h-[44px] flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-success dark:text-success-dark transition-all text-xs sm:text-sm cursor-pointer disabled:opacity-50"
                    >
                      {fhirLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCode className="w-4 h-4" />}
                      <span>{fhirLoading ? 'Exporting...' : 'FHIR Record (JSON)'}</span>
                    </button>
                  </div>
                </div>

                {/* Sign Out */}
                <div className="pt-1 pb-2 space-y-2">
                  {hasUnsavedChanges && (
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 text-center">
                      You have unsaved profile edits.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => runActionThenClose(onLogout)}
                    className="neu-btn w-full min-h-[44px] flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-danger dark:text-danger-dark transition-all text-xs sm:text-sm cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
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
