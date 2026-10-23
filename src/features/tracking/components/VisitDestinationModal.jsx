import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, Loader2, AlertTriangle } from 'lucide-react';
import LocationPicker from './LocationPicker';
import { reverseGeocode } from '../services/geocoding';

/**
 * Reusable per-visit destination picker.
 * props: isOpen, onClose, initial, homeAddress, title, description,
 *        confirmLabel, onConfirm({lat,lng,address})
 */
export default function VisitDestinationModal({
  isOpen,
  onClose,
  initial,
  homeAddress = '',
  title = 'Visit location',
  description = 'Confirm exactly where the provider should go for this visit.',
  confirmLabel = 'Use this location',
  onConfirm,
}) {
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setAddress(initial?.address || homeAddress || '');
    setSaving(false);
    setError(null);
  }, [isOpen, initial?.address, homeAddress]);

  const handleSave = async (pos) => {
    setSaving(true);
    setError(null);
    try {
      let label = address.trim();
      if (!label) {
        label = (await reverseGeocode(pos.lat, pos.lng)) || '';
      }
      await onConfirm?.({ lat: pos.lat, lng: pos.lng, address: label || null });
      onClose?.();
    } catch (err) {
      setError(err?.message || 'Could not save the visit location. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-sm p-0 sm:p-4 md:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="relative w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-[2rem] sm:rounded-[2rem] neu-flat border border-white/60 dark:border-white/10 shadow-2xl"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-20 flex items-start justify-between gap-3 p-4 sm:p-5 bg-[var(--neu-bg,#EEF3F8)]/95 dark:bg-[#132233]/95 backdrop-blur-md border-b border-white/50 dark:border-white/10">
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center text-primary dark:text-[#8CBDF0] shrink-0">
                  <MapPin className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-display font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                    {title}
                  </h2>
                  <p className="text-3xs sm:text-2xs text-slate-500 dark:text-slate-400 font-medium leading-snug mt-0.5">
                    {description}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                title="Close"
                className="w-9 h-9 rounded-xl neu-btn flex items-center justify-center text-slate-500 dark:text-slate-300 shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-3">
              <div className="space-y-1.5">
                <label htmlFor="visit-destination-address" className="text-3xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Address or landmark
                </label>
                <input
                  id="visit-destination-address"
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="House number, street, barangay…"
                  className="w-full neu-inset rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none placeholder:text-slate-400"
                />
              </div>

              <LocationPicker
                address={address}
                initial={initial?.lat != null ? { lat: initial.lat, lng: initial.lng } : null}
                onSave={handleSave}
                saveLabel={saving ? 'Saving…' : confirmLabel}
                locateLabel="Use current location"
                emptyHint="Tap the map to place the visit pin"
              />

              {error && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-2xs font-semibold text-rose-600 dark:text-rose-400">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {saving && (
                <div className="flex items-center justify-center gap-2 text-2xs font-semibold text-slate-500 dark:text-slate-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving visit location…
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
