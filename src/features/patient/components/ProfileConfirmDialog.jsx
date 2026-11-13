import * as DialogPrimitive from '@radix-ui/react-dialog';
import { motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import useBodyScrollLock from '@/hooks/useBodyScrollLock';
import useBottomDrawerDrag from '@/hooks/useBottomDrawerDrag';

/**
 * In-app confirmation sheet/dialog replacing native window.confirm() for
 * permanent actions (such as document deletion or discarding unsaved edits).
 */
export default function ProfileConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  loading = false,
  danger = true,
  onCancel,
  onConfirm,
}) {
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
              transition={{ duration: prefersReducedMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              {...drawerMotionProps}
              {...dragHandleProps}
            >
              <div className="p-5 sm:p-6 space-y-4">
                <div
                  className="mx-auto h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-600 sm:hidden"
                  aria-hidden="true"
                />

                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`neu-flat-sm w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                        danger ? 'text-danger dark:text-rose-400' : 'text-warning dark:text-warning-dark'
                      }`}
                    >
                      <AlertTriangle className="w-5 h-5" />
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
                  <DialogPrimitive.Close
                    aria-label="Close confirmation dialog"
                    disabled={loading}
                    className="neu-btn w-11 h-11 min-w-[44px] min-h-[44px] rounded-full hidden sm:flex items-center justify-center text-tertiary hover:text-slate-900 dark:hover:text-white shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    <X className="w-5 h-5" />
                  </DialogPrimitive.Close>
                </div>

                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => onCancel?.()}
                    className="neu-btn min-h-[44px] px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 cursor-pointer disabled:opacity-50"
                  >
                    {cancelLabel}
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => onConfirm?.()}
                    className={`min-h-[44px] px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-all ${
                      danger
                        ? 'bg-[#BC3030] hover:bg-[#9E2626] text-white shadow-sm'
                        : 'neu-btn-primary'
                    }`}
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>{confirmLabel}</span>
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
