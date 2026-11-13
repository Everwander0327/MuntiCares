import { useEffect, useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, MapPin, X } from 'lucide-react';
import useBodyScrollLock from '@/hooks/useBodyScrollLock';
import useBottomDrawerDrag from '@/hooks/useBottomDrawerDrag';
import PermanentAddressSection from '@/features/patient/components/PermanentAddressSection';

const createDraftState = (address, coords, draftMeta) => ({
  address: address || '',
  coords: coords || null,
  street: draftMeta?.street || '',
  unit: draftMeta?.unit || '',
  subdivision: draftMeta?.subdivision || '',
  instructions: draftMeta?.instructions || '',
});

/**
 * Scoped responsive dialog/bottom-sheet for editing the patient's permanent home
 * visit address and GPS pin without cluttering the Overview scroll flow.
 */
export default function ProfileAddressModal({
  open,
  onClose,
  address = '',
  coords = null,
  draftMeta = null,
  onApply,
}) {
  const prefersReducedMotion = useReducedMotion();
  const [staged, setStaged] = useState(() => createDraftState(address, coords, draftMeta));
  const [sessionKey, setSessionKey] = useState(0);
  const wasOpenRef = useRef(false);
  const { drawerMotionProps, dragHandleProps } = useBottomDrawerDrag({ onClose });

  useBodyScrollLock(open);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setStaged(createDraftState(address, coords, draftMeta));
      setSessionKey((prev) => prev + 1);
    }
    wasOpenRef.current = open;
  }, [open, address, coords, draftMeta]);

  const handleApply = () => {
    onApply?.(staged);
    onClose?.();
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
        <DialogPrimitive.Content
          asChild
          aria-modal="true"
          onPointerDownOutside={(event) => {
            // Allow clicking autocomplete suggestion portals if rendered on body
            if (event.target?.closest?.('[data-address-suggestions]')) {
              event.preventDefault();
            }
          }}
        >
          <motion.div
            className="fixed inset-0 z-overlay flex items-end sm:items-center justify-center p-0 sm:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.16 }}
            onClick={() => onClose?.()}
          >
            <motion.div
              className="neu-flat rounded-t-[2rem] sm:rounded-[2rem] w-full max-w-2xl flex flex-col relative max-h-[92dvh] overflow-hidden shadow-2xl border-t sm:border border-white/70 dark:border-white/10"
              initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 40, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              {...drawerMotionProps}
            >
              {/* Header */}
              <div
                className="shrink-0 px-4 sm:px-6 pt-3 sm:pt-5 pb-3.5 border-b border-slate-200/75 dark:border-white/10 cursor-grab sm:cursor-auto active:cursor-grabbing sm:active:cursor-auto"
                {...dragHandleProps}
              >
                <div
                  className="mx-auto mb-2.5 h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-600 sm:hidden"
                  aria-hidden="true"
                />
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="neu-flat-sm w-11 h-11 rounded-2xl flex items-center justify-center text-link shrink-0 border border-white/80 dark:border-white/10">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <DialogPrimitive.Title className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 truncate">
                        Edit Home Visit Pin &amp; Address
                      </DialogPrimitive.Title>
                      <DialogPrimitive.Description className="text-xs sm:text-sm text-tertiary dark:text-tertiary mt-0.5">
                        Search your street, center the map pin, and add gate notes.
                      </DialogPrimitive.Description>
                    </div>
                  </div>
                  <DialogPrimitive.Close
                    aria-label="Close address editor"
                    className="neu-btn w-11 h-11 min-w-[44px] min-h-[44px] rounded-full hidden sm:flex items-center justify-center text-tertiary hover:text-slate-900 dark:hover:text-white shrink-0 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </DialogPrimitive.Close>
                </div>
              </div>

              {/* Scrollable Map & Granular Fields */}
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4">
                {open && (
                  <PermanentAddressSection
                    key={sessionKey}
                    hideHeader
                    initialAddress={staged.address}
                    initialCoords={staged.coords}
                    initialBaseAddress={staged.street}
                    initialUnit={staged.unit}
                    initialSubdivision={staged.subdivision}
                    initialInstructions={staged.instructions}
                    onChange={(next) => {
                      setStaged({
                        address: next.address || '',
                        coords: next.coords || null,
                        street: next.street || '',
                        unit: next.unit || '',
                        subdivision: next.subdivision || '',
                        instructions: next.instructions || '',
                      });
                    }}
                  />
                )}
              </div>

              {/* Thumb-Zone Footer */}
              <div className="shrink-0 px-4 sm:px-6 py-3.5 border-t border-slate-200/75 dark:border-white/10 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2.5 bg-surface-shell/95 backdrop-blur-sm">
                <div className="text-xs text-tertiary dark:text-tertiary text-center sm:text-left">
                  {staged.coords ? (
                    <span className="font-semibold text-success dark:text-success-dark">
                      Pin set ({staged.coords.lat.toFixed(5)}, {staged.coords.lng.toFixed(5)})
                    </span>
                  ) : (
                    <span>Drag map or search to set pin coordinates</span>
                  )}
                </div>
                <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => onClose?.()}
                    className="neu-btn min-h-[44px] px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-tertiary dark:text-tertiary hover:text-slate-800 dark:hover:text-slate-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleApply}
                    className="neu-btn-primary min-h-[44px] px-6 py-2.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>Apply Home Address</span>
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
