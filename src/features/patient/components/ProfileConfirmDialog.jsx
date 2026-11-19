import * as DialogPrimitive from '@radix-ui/react-dialog';
import { motion, useReducedMotion } from 'framer-motion';
import { Warning } from '@phosphor-icons/react';
import useBodyScrollLock from '@/hooks/useBodyScrollLock';
import useBottomDrawerDrag from '@/hooks/useBottomDrawerDrag';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * In-app confirmation sheet/dialog replacing native window.confirm() for
 * permanent actions (such as document deletion or discarding unsaved edits).
 */
export default function ProfileConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  loading = false,
  danger = true,
  onCancel,
  onConfirm,
}) {
  const { t } = useLanguage();
  const resolvedConfirmLabel = confirmLabel || t('patient.common.confirm');
  const resolvedCancelLabel = cancelLabel || t('patient.common.cancel');
  const prefersReducedMotion = useReducedMotion();
  useBodyScrollLock(open);
  const { drawerMotionProps, dragHandleProps } = useBottomDrawerDrag({
    onClose: onCancel,
    disabled: loading,
  });

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !loading) onCancel?.();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-overlay bg-slate-950/70 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          asChild
          aria-modal="true"
          onInteractOutside={(event) => {
            if (loading) event.preventDefault();
          }}
        >
          <motion.div
            className="fixed inset-0 z-overlay flex items-end sm:items-center justify-center p-0 sm:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.16 }}
            onClick={() => {
              if (!loading) onCancel?.();
            }}
          >
            <motion.div
              className="neu-flat rounded-t-[2rem] sm:rounded-[2rem] w-full max-w-md flex flex-col relative overflow-hidden shadow-2xl border-t sm:border border-white/70 dark:border-white/10"
              initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 32, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.24, ease: [0.32, 0.72, 0, 1] }}
              onClick={(e) => e.stopPropagation()}
              {...drawerMotionProps}
              {...dragHandleProps}
            >
              <div className="p-5 sm:p-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-6 space-y-4">
                <div
                  className="mx-auto h-1.5 w-11 rounded-full bg-slate-300/90 dark:bg-slate-600/80 sm:hidden shrink-0"
                  aria-hidden="true"
                />

                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`neu-flat-sm w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                        danger ? 'text-danger dark:text-danger-dark' : 'text-warning dark:text-warning-dark'
                      }`}
                    >
                      <Warning className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <DialogPrimitive.Title className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
                        {title}
                      </DialogPrimitive.Title>
                      <DialogPrimitive.Description className="text-xs sm:text-sm text-tertiary dark:text-tertiary mt-1 leading-relaxed break-words">
                        {description}
                      </DialogPrimitive.Description>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => onCancel?.()}
                    className="neu-btn min-h-[2.75rem] px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 cursor-pointer disabled:opacity-50"
                  >
                    {resolvedCancelLabel}
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    aria-busy={loading}
                    onClick={() => onConfirm?.()}
                    className={`min-h-[2.75rem] px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-all ${
                      danger
                        ? 'bg-danger hover:bg-danger/90 text-white shadow-card'
                        : 'neu-btn-primary'
                    }`}
                  >
                    <span>{resolvedConfirmLabel}</span>
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
