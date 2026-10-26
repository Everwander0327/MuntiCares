import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  MapPin,
  Loader2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Check,
  Building,
  Home,
  FileText,
  Navigation,
} from 'lucide-react';
import ModernLocationPicker from './ModernLocationPicker';
import AddressAutocomplete from './AddressAutocomplete';
import { reverseGeocode } from '../services/geocoding';
import { formatFullVisitAddress } from '../services/addressFormat';
import useBodyScrollLock from '@/hooks/useBodyScrollLock';
import useFocusTrap from '@/hooks/useFocusTrap';

/**
 * VisitDestinationModal
 * Next-generation Foodpanda / Grab-style two-stage address & arrival details picker.
 * Stage 1: Interactive Map with center pin, autocomplete, and GPS snap.
 * Stage 2: Granular Unit/Floor, Subdivision Gate, and Provider Arrival Instructions.
 */
export default function VisitDestinationModal({
  isOpen,
  onClose,
  initial,
  homeAddress = '',
  confirmLabel = 'Save visit location',
  onConfirm,
}) {
  const [step, setStep] = useState('pin'); // 'pin' | 'details'
  const [currentPin, setCurrentPin] = useState(initial || null);
  const [baseAddress, setBaseAddress] = useState('');
  const [unit, setUnit] = useState('');
  const [subdivision, setSubdivision] = useState('');
  const [instructions, setInstructions] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const pickerRef = useRef(null);
  const dialogRef = useRef(null);
  const closeRef = useRef(null);

  useBodyScrollLock(isOpen);
  useFocusTrap(isOpen, dialogRef, closeRef);

  useEffect(() => {
    if (!isOpen) return;
    setStep('pin');
    setCurrentPin(initial || null);
    setBaseAddress(initial?.address || homeAddress || '');
    setUnit('');
    setSubdivision('');
    setInstructions('');
    setSaving(false);
    setError(null);
  }, [isOpen, initial, homeAddress]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const handlePinUpdate = (pos) => {
    setCurrentPin(pos);
    if (pos.address) {
      setBaseAddress(pos.address);
    }
  };

  const handleAutocompleteSelect = (place) => {
    setCurrentPin({ lat: place.lat, lng: place.lng, address: place.displayName });
    setBaseAddress(place.displayName);
    pickerRef.current?.flyToLocation({ lat: place.lat, lng: place.lng });
  };

  const handleAdvanceToDetails = async () => {
    let pin = currentPin;
    if (!pin && pickerRef.current) {
      const center = pickerRef.current.getCenter();
      if (center) {
        const resolved = await reverseGeocode(center.lat, center.lng);
        pin = { ...center, address: resolved || '' };
        setCurrentPin(pin);
        setBaseAddress(resolved || '');
      }
    }

    if (!pin?.lat || !pin?.lng) {
      setError('Please position the map pin to select a visit location.');
      return;
    }
    setError(null);
    setStep('details');
  };

  const handleFinalSave = async (quickOnly = false) => {
    setSaving(true);
    setError(null);
    try {
      let pin = currentPin;
      if (!pin?.lat || !pin?.lng) {
        const center = pickerRef.current?.getCenter();
        if (center?.lat != null && center?.lng != null) {
          const resolved = await reverseGeocode(center.lat, center.lng);
          pin = { ...center, address: resolved || '' };
          setCurrentPin(pin);
          if (!baseAddress.trim() && resolved) {
            setBaseAddress(resolved);
          }
        }
      }

      if (!pin?.lat || !pin?.lng) {
        setError('Please position the map pin to select a visit location.');
        setSaving(false);
        return;
      }

      let finalAddress = quickOnly
        ? (baseAddress.trim() || pin.address || '')
        : (formatFullVisitAddress({
            unit,
            subdivision,
            baseAddress: baseAddress.trim() || pin.address || '',
            instructions,
          }) || baseAddress.trim() || pin.address || '');

      if (!finalAddress) {
        finalAddress = (await reverseGeocode(pin.lat, pin.lng)) || '';
      }

      await onConfirm?.({
        lat: pin.lat,
        lng: pin.lng,
        address: finalAddress || null,
      });

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
            className="mc-tracker mc-modal w-full max-h-[94dvh] overflow-hidden flex flex-col rounded-t-[var(--trk-radius-xl)] sm:max-w-lg sm:rounded-[var(--trk-radius-lg)] shadow-2xl"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="mc-modal__head shrink-0 border-b border-slate-200/60 dark:border-white/10 px-5 py-4">
              <div className="min-w-0 flex-1">
                <p className="text-3xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  {step === 'pin' ? '01 / 02 · Pin Location' : '02 / 02 · Arrival Details'}
                </p>
                <h2 id="visit-destination-title" className="mc-title text-base sm:text-lg mt-0.5">
                  {step === 'pin' ? 'Move map to place pin' : 'Exact visit & gate details'}
                </h2>
                <p className="mc-muted text-xs mt-0.5">
                  {step === 'pin'
                    ? 'Position the center pin at your house or entrance gate.'
                    : 'Provide unit, subdivision, or gate instructions for your arriving provider.'}
                </p>
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

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {step === 'pin' ? (
                /* STAGE 1: MAP PIN SELECTION */
                <div className="space-y-3">
                  {/* Autocomplete Search & Barangay Chips */}
                  <AddressAutocomplete
                    onSelect={handleAutocompleteSelect}
                    initialQuery={baseAddress}
                  />

                  {/* 3D MapLibre Vector Map with Center Pin */}
                  <ModernLocationPicker
                    ref={pickerRef}
                    initial={currentPin}
                    onPinChange={handlePinUpdate}
                    className="h-[300px] sm:h-[360px]"
                  />

                  {/* Pinned Location Card */}
                  <div className="neu-flat-sm p-3 rounded-xl flex items-center justify-between gap-3 bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-white/5">
                    <div className="min-w-0 flex-1 flex items-start gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center text-primary shrink-0 mt-0.5">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-3xs font-extrabold uppercase tracking-wider text-slate-400">
                          Pinned Location
                        </p>
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {baseAddress || (currentPin ? `${currentPin.lat.toFixed(5)}, ${currentPin.lng.toFixed(5)}` : 'Move map to pinpoint')}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleFinalSave(true)}
                      className="text-2xs font-bold text-slate-500 hover:text-primary dark:text-slate-400 underline shrink-0 px-2"
                    >
                      Quick Save
                    </button>
                  </div>
                </div>
              ) : (
                /* STAGE 2: EXACT ARRIVAL DETAILS FORM */
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-3.5"
                >
                  {/* Pinned Location Mini Summary with "Adjust Pin" */}
                  <div className="p-3 rounded-xl bg-primary/5 dark:bg-primary/10 border border-primary/20 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1 flex items-center gap-2.5">
                      <Navigation className="w-4 h-4 text-primary shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-2xs font-extrabold text-primary dark:text-[#8CBDF0]">
                          GPS Pin Confirmed
                        </p>
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                          {baseAddress || `${currentPin?.lat.toFixed(5)}, ${currentPin?.lng.toFixed(5)}`}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStep('pin')}
                      className="px-2.5 py-1 rounded-lg text-2xs font-extrabold bg-white dark:bg-slate-800 text-primary dark:text-[#8CBDF0] shadow-sm shrink-0 border border-slate-200/60 dark:border-white/10 hover:bg-slate-50"
                    >
                      Adjust Pin
                    </button>
                  </div>

                  {/* House / Building / Lot */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 ml-1">
                      <Home className="w-3.5 h-3.5 text-primary" />
                      House No. / Building Name
                    </label>
                    <input
                      type="text"
                      value={baseAddress}
                      onChange={(e) => setBaseAddress(e.target.value)}
                      placeholder="e.g. Block 14 Lot 8, Sampaguita St. or Civic Prime Bldg"
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                    />
                  </div>

                  {/* Unit / Floor / Room */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 ml-1">
                      <Building className="w-3.5 h-3.5 text-primary" />
                      Unit / Floor / Apt (Optional)
                    </label>
                    <input
                      type="text"
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      placeholder="e.g. Unit 402, 4th Floor, or Room 3B"
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                    />
                  </div>

                  {/* Subdivision / Compound / Security Gate */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 ml-1">
                      <MapPin className="w-3.5 h-3.5 text-primary" />
                      Subdivision, Village, or Gate Access
                    </label>
                    <input
                      type="text"
                      value={subdivision}
                      onChange={(e) => setSubdivision(e.target.value)}
                      placeholder="e.g. Ayala Alabang (Mindanao Gate), Victoria Homes Phase 2"
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                    />
                  </div>

                  {/* Arrival Notes & Instructions for Healthcare Worker */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 ml-1">
                      <FileText className="w-3.5 h-3.5 text-primary" />
                      Arrival & Gate Instructions for Provider
                    </label>
                    <textarea
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      rows={2}
                      placeholder="e.g. Yellow gate beside sari-sari store. Please tell guard you are visiting Santos residence. Doorbell is on the right pillar."
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/40 resize-none transition-all"
                    />
                  </div>
                </motion.div>
              )}

              {error && (
                <div className="mc-note mc-note--problem flex items-center gap-2 p-3 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 text-xs" role="alert">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="shrink-0 p-4 border-t border-slate-200/60 dark:border-white/10 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/50">
              {step === 'pin' ? (
                <>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAdvanceToDetails}
                    className="neu-btn-primary px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2"
                  >
                    <span>Confirm Pin & Details</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setStep('pin')}
                    disabled={saving}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Map
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFinalSave(false)}
                    disabled={saving}
                    className="neu-btn-primary px-6 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 disabled:opacity-50"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving…
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        {confirmLabel}
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
