import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, Loader2, AlertTriangle } from 'lucide-react';
import LocationPicker from './LocationPicker';
import { reverseGeocode } from '../services/geocoding';
import useBodyScrollLock from '@/hooks/useBodyScrollLock';
import useFocusTrap from '@/hooks/useFocusTrap';

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
  const dialogRef = useRef(null);
  const closeRef = useRef(null);

  useBodyScrollLock(isOpen);
  useFocusTrap(isOpen, dialogRef, closeRef);

  useEffect(() => {
    if (!isOpen) return;
    setAddress(initial?.address || homeAddress || '');
    setSaving(false);
    setError(null);
  }, [isOpen, initial?.address, homeAddress]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

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
          className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center bg-[var(--trk-map-scrim)] p-0 sm:p-4 md:p-6 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="visit-destination-title"
            className="mc-tracker mc-modal w-full max-h-[92dvh] overflow-y-auto rounded-t-[var(--trk-radius-xl)] sm:max-w-lg sm:rounded-[var(--trk-radius-lg)]"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mc-modal__head">
              <div className="min-w-0 flex-1">
                <h2 id="visit-destination-title" className="mc-title">
                  {title}
                </h2>
                <p className="mc-muted mt-1">{description}</p>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                title="Close"
                aria-label="Close visit location"
                className="mc-icon-btn shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mc-stack p-4 sm:p-5">
              <div className="mc-stack mc-stack--tight">
                <label htmlFor="visit-destination-address" className="mc-kicker flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  Address or landmark
                </label>
                <input
                  id="visit-destination-address"
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="House number, street, barangay…"
                  autoComplete="street-address"
                  enterKeyHint="search"
                  className="mc-input"
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
                <div className="mc-note mc-note--problem" role="alert">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {saving && (
                <div className="mc-muted flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
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
