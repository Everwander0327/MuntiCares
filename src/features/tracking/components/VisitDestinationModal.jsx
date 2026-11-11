import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';
import ModernLocationPicker from './ModernLocationPicker';
import AddressAutocomplete from './AddressAutocomplete';
import { reverseGeocode } from '../services/geocoding';
import { formatFullVisitAddress } from '../services/addressFormat';
import useBodyScrollLock from '@/hooks/useBodyScrollLock';

/**
 * VisitDestinationModal — Option 1 (Grab / DoorDash Clean 2-Step Pin Picker)
 * Stage 1: Interactive Map with unobstructed center pin, working search bar + instant Muntinlupa barangay drawer, and tactile Pinned Location summary card.
 * Stage 2: Compact 2-column Gate & Arrival Details form.
 */
export default function VisitDestinationModal({
  isOpen,
  onClose,
  initial,
  initialCenter = null,
  homeAddress = '',
  confirmLabel = 'Use this visit location',
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

  useBodyScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    setStep('pin');
    setCurrentPin(initial || null);
    setBaseAddress(initial?.address || initialCenter?.address || homeAddress || '');
    setUnit('');
    setSubdivision('');
    setInstructions('');
    setSaving(false);
    setError(null);
  }, [isOpen, initial, initialCenter, homeAddress]);

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
    if (!pin && pickerRef.current?.hasUserMoved()) {
      const center = pickerRef.current.getCenter();
      if (center) {
        const resolved = await reverseGeocode(center.lat, center.lng);
        pin = { ...center, address: resolved || '' };
        setCurrentPin(pin);
        setBaseAddress(resolved || '');
      }
    }

    if (!pin?.lat || !pin?.lng) {
      setError('Place the pin on your home first: drag the map, search an address, or use the GPS button.');
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
      if ((!pin?.lat || !pin?.lng) && pickerRef.current?.hasUserMoved()) {
        const center = pickerRef.current.getCenter();
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
        setError('Place the pin on your home first: drag the map, search an address, or use the GPS button.');
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
          className="pointer-events-auto fixed inset-0 z-overlay flex items-end sm:items-center justify-center bg-slate-950/70 p-0 sm:p-4"
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
            className="neu-flat w-full max-h-[92dvh] overflow-y-auto no-scrollbar flex flex-col rounded-t-[2rem] sm:max-w-lg sm:rounded-[2rem] p-4 sm:p-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl border-t sm:border border-white/70 dark:border-white/10"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Drag Handle */}
            <div className="mx-auto mb-2.5 h-1.5 w-10 rounded-md bg-slate-300 dark:bg-slate-700 sm:hidden" aria-hidden="true" />

            {/* Option 1 Compact Header */}
            <div className="flex items-center justify-between gap-3 pb-3.5 mb-3.5 border-b border-slate-200/70 dark:border-white/5 shrink-0">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 id="visit-destination-title" className="text-base sm:text-lg font-display font-extrabold text-slate-900 dark:text-white leading-tight truncate">
                    {step === 'pin' ? 'Move map to place pin' : 'Exact visit & gate details'}
                  </h2>
                  <span className="px-2 py-0.5 rounded-md bg-primary/10 text-link text-2xs font-extrabold uppercase tracking-wider shrink-0">
                    {step === 'pin' ? 'Step 1 of 2' : 'Step 2 of 2'}
                  </span>
                </div>
                <p className="text-xs text-tertiary dark:text-tertiary mt-0.5">
                  {step === 'pin'
                    ? 'Position the center pin at your house or subdivision entrance gate.'
                    : 'Provide unit, subdivision, or gate instructions for your arriving provider.'}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                title="Close"
                aria-label="Close visit location"
                className="neu-btn w-9 h-9 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl text-tertiary hover:text-slate-900 dark:hover:text-white transition-colors shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-3.5">
              {step === 'pin' ? (
                /* STAGE 1: MAP PIN SELECTION */
                <div className="space-y-3.5">
                  {/* Working Search Input + Barangay Quick-Jump Drawer */}
                  <AddressAutocomplete
                    onSelect={handleAutocompleteSelect}
                    initialQuery=""
                  />

                  {/* Unobstructed MapLibre Vector Map with Center Pin */}
                  <ModernLocationPicker
                    ref={pickerRef}
                    initial={currentPin}
                    initialCenter={initialCenter}
                    onPinChange={handlePinUpdate}
                    className="h-[240px] sm:h-[290px]"
                  />

                  {/* Single Authoritative Pinned Location Well + Tactile Quick Save Button */}
                  <div className="neu-flat-sm p-3.5 rounded-2xl flex items-center justify-between gap-3 border border-white/80 dark:border-white/5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-md text-2xs font-extrabold uppercase tracking-wider ${
                          currentPin
                            ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20'
                            : 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/20'
                        }`}>
                          {currentPin ? 'Pin Placed' : 'Pin Required'}
                        </span>
                        <span className="text-xs font-semibold text-tertiary tabular-nums">
                          {currentPin
                            ? `${currentPin.lat.toFixed(5)}, ${currentPin.lng.toFixed(5)}`
                            : 'Drag map or search above'}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate mt-1">
                        {baseAddress || (currentPin ? 'Pinned location' : 'Move map to pinpoint your address')}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleFinalSave(true)}
                      disabled={!currentPin || saving}
                      className="neu-btn px-3 py-2 rounded-xl text-xs font-extrabold text-link shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Quick Save
                    </button>
                  </div>

                  {/* Stage 1 Action Row */}
                  <div className="grid grid-cols-[105px_1fr] sm:grid-cols-[120px_1fr] gap-2.5 pt-0.5">
                    <button
                      type="button"
                      onClick={onClose}
                      className="w-full neu-btn py-2.5 sm:py-3 rounded-xl text-xs font-extrabold text-slate-600 dark:text-slate-300 flex items-center justify-center cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAdvanceToDetails}
                      disabled={!currentPin}
                      className="w-full neu-btn-primary py-2.5 sm:py-3 rounded-xl text-xs font-extrabold shadow-md flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Add Gate & Arrival Details
                    </button>
                  </div>
                </div>
              ) : (
                /* STAGE 2: EXACT ARRIVAL & GATE DETAILS FORM (Zero Decorative Icons) */
                <motion.div
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-3.5"
                >
                  {/* Pinned Location Mini Summary with Adjust Pin */}
                  <div className="neu-inset p-3.5 rounded-2xl flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <span className="text-2xs font-extrabold uppercase tracking-wider text-success dark:text-success-dark block">
                        GPS Pin Confirmed
                      </span>
                      <p className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate mt-0.5">
                        {baseAddress || 'Pinned location'}
                      </p>
                      <p className="text-xs font-semibold text-tertiary tabular-nums mt-0.5">
                        {currentPin?.lat.toFixed(5)}, {currentPin?.lng.toFixed(5)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStep('pin')}
                      className="neu-btn px-3 py-1.5 rounded-xl text-xs font-extrabold text-link shrink-0 cursor-pointer"
                    >
                      Adjust Pin
                    </button>
                  </div>

                  {/* House / Building / Street */}
                  <div className="space-y-1">
                    <label className="text-2xs font-extrabold uppercase tracking-wider text-tertiary block ml-0.5">
                      House No. / Street / Building Name
                    </label>
                    <div className="neu-inset rounded-xl px-3.5 py-2.5 border border-white/60 dark:border-white/5">
                      <input
                        type="text"
                        value={baseAddress}
                        onChange={(e) => setBaseAddress(e.target.value)}
                        placeholder="e.g. Block 14 Lot 8, Sampaguita St. or Civic Prime Bldg"
                        className="w-full bg-transparent text-xs sm:text-sm font-semibold text-slate-900 dark:text-white outline-none placeholder:text-tertiary placeholder:font-normal"
                      />
                    </div>
                  </div>

                  {/* 2-Column Split for Unit/Floor & Subdivision/Gate */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-2xs font-extrabold uppercase tracking-wider text-tertiary block ml-0.5">
                        Unit / Floor (Optional)
                      </label>
                      <div className="neu-inset rounded-xl px-3 py-2.5 border border-white/60 dark:border-white/5">
                        <input
                          type="text"
                          value={unit}
                          onChange={(e) => setUnit(e.target.value)}
                          placeholder="e.g. Unit 402, 4th Flr"
                          className="w-full bg-transparent text-xs font-semibold text-slate-900 dark:text-white outline-none placeholder:text-tertiary placeholder:font-normal"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-2xs font-extrabold uppercase tracking-wider text-tertiary block ml-0.5">
                        Subdivision / Gate
                      </label>
                      <div className="neu-inset rounded-xl px-3 py-2.5 border border-white/60 dark:border-white/5">
                        <input
                          type="text"
                          value={subdivision}
                          onChange={(e) => setSubdivision(e.target.value)}
                          placeholder="e.g. Gate 2 near Chapel"
                          className="w-full bg-transparent text-xs font-semibold text-slate-900 dark:text-white outline-none placeholder:text-tertiary placeholder:font-normal"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Arrival Notes & Instructions */}
                  <div className="space-y-1">
                    <label className="text-2xs font-extrabold uppercase tracking-wider text-tertiary block ml-0.5">
                      Arrival Instructions for Provider (Optional)
                    </label>
                    <div className="neu-inset rounded-xl p-3 border border-white/60 dark:border-white/5">
                      <textarea
                        value={instructions}
                        onChange={(e) => setInstructions(e.target.value)}
                        rows={2}
                        placeholder="e.g. Yellow gate beside sari-sari store, doorbell is on the right pillar..."
                        className="w-full bg-transparent text-xs font-semibold text-slate-900 dark:text-white outline-none resize-none placeholder:text-tertiary placeholder:font-normal"
                      />
                    </div>
                  </div>

                  {/* Stage 2 Action Row */}
                  <div className="grid grid-cols-[105px_1fr] sm:grid-cols-[120px_1fr] gap-2.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setStep('pin')}
                      disabled={saving}
                      className="w-full neu-btn py-2.5 sm:py-3 rounded-xl text-xs font-extrabold text-slate-600 dark:text-slate-300 flex items-center justify-center cursor-pointer disabled:opacity-50"
                    >
                      Back to Map
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFinalSave(false)}
                      disabled={saving}
                      className="w-full neu-btn-primary py-2.5 sm:py-3 rounded-xl text-xs font-extrabold shadow-md flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Saving…</span>
                        </>
                      ) : (
                        <span>{confirmLabel}</span>
                      )}
                    </button>
                  </div>
                </motion.div>
              )}

              {error && (
                <div className="p-3 rounded-xl bg-danger/10 text-danger dark:text-danger-dark border border-red-500/20 text-xs font-semibold" role="alert">
                  {error}
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
