import { useState, useEffect, useRef } from 'react';
import ModernLocationPicker from '@/features/tracking/components/ModernLocationPicker';
import AddressAutocomplete from '@/features/tracking/components/AddressAutocomplete';
import { formatFullVisitAddress, parseFullVisitAddress } from '@/features/tracking/services/addressFormat';

/**
 * PermanentAddressSection
 * Foodpanda-style permanent saved address setup for Patient Profile.
 * Combines autocomplete search, 3D vector map with fixed center pin,
 * unit/floor details, and persistent arrival/gate instructions.
 */
export default function PermanentAddressSection({
  initialAddress = '',
  initialCoords = null,
  onChange,
}) {
  const [addressLabel] = useState('Home');
  const [baseAddress, setBaseAddress] = useState('');
  const [unitFloor, setUnitFloor] = useState('');
  const [subdivisionGate, setSubdivisionGate] = useState('');
  const [arrivalInstructions, setArrivalInstructions] = useState('');
  const [coords, setCoords] = useState(initialCoords);

  const pickerRef = useRef(null);
  // Tracks the last address string we emitted to the parent, so that when the
  // parent echoes it back via `initialAddress` we don't re-parse it into
  // `baseAddress` (which would duplicate unit/subdivision on every keystroke).
  const lastEmittedAddressRef = useRef(null);

  // Initialize from initialAddress (only for externally-originated changes)
  useEffect(() => {
    if (initialAddress && initialAddress !== lastEmittedAddressRef.current) {
      const parsed = parseFullVisitAddress(initialAddress);
      setBaseAddress(parsed.baseAddress || initialAddress);
      setArrivalInstructions(parsed.instructions || '');
    }
  }, [initialAddress]);

  useEffect(() => {
    if (initialCoords?.lat != null && initialCoords?.lng != null) {
      setCoords(initialCoords);
    }
  }, [initialCoords]);

  // Notify parent of compiled changes
  const notifyParent = (newBase, newUnit, newSub, newInstr, newCoords) => {
    const formatted = formatFullVisitAddress({
      unit: newUnit,
      subdivision: newSub,
      baseAddress: newBase,
      instructions: newInstr,
    }) || newBase;

    lastEmittedAddressRef.current = formatted || '';
    onChange?.({
      address: formatted,
      coords: newCoords,
      unit: newUnit,
      subdivision: newSub,
      instructions: newInstr,
      label: addressLabel,
    });
  };

  const handleAutocomplete = (place) => {
    setBaseAddress(place.displayName);
    const newCoords = { lat: place.lat, lng: place.lng };
    setCoords(newCoords);
    pickerRef.current?.flyToLocation(newCoords);
    notifyParent(place.displayName, unitFloor, subdivisionGate, arrivalInstructions, newCoords);
  };

  const handlePinChange = (pin) => {
    const newCoords = { lat: pin.lat, lng: pin.lng };
    setCoords(newCoords);
    if (pin.address) {
      setBaseAddress(pin.address);
      notifyParent(pin.address, unitFloor, subdivisionGate, arrivalInstructions, newCoords);
    } else {
      notifyParent(baseAddress, unitFloor, subdivisionGate, arrivalInstructions, newCoords);
    }
  };

  const handleFieldChange = (setter, fieldName) => (e) => {
    const val = e.target.value;
    setter(val);
    // Editing the street/barangay invalidates the previous pin; keep it as
    // text only until the patient confirms the new location on the map.
    const nextCoords = fieldName === 'base' ? null : coords;
    if (fieldName === 'base') setCoords(null);
    const updated = {
      base: fieldName === 'base' ? val : baseAddress,
      unit: fieldName === 'unit' ? val : unitFloor,
      sub: fieldName === 'sub' ? val : subdivisionGate,
      instr: fieldName === 'instr' ? val : arrivalInstructions,
    };
    notifyParent(updated.base, updated.unit, updated.sub, updated.instr, nextCoords);
  };

  return (
    <div className="space-y-4 rounded-2xl p-4 sm:p-5 neu-flat-sm border border-slate-200/70 dark:border-white/5 bg-slate-50/50 dark:bg-slate-900/40">
      {/* Header */}
      <div className="pb-3 border-b border-slate-200/60 dark:border-white/5">
        <label className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 block">
          Permanent Home & Visit Address
        </label>
        <p className="text-sm text-tertiary dark:text-tertiary mt-0.5">
          Saved to your profile. All future home visits default to this location unless changed at booking.
        </p>
      </div>

      {/* Step 1: Search Street / Landmark */}
      <div className="space-y-1.5">
        <label className="text-2xs font-semibold uppercase tracking-wider text-tertiary ml-1">
          Search Street, Subdivision, or Barangay
        </label>
        <AddressAutocomplete
          onSelect={handleAutocomplete}
          initialQuery={baseAddress}
        />
      </div>

      {/* Step 2: 3D Vector Map with Center-Fixed Pin */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between ml-1">
          <label className="text-2xs font-semibold uppercase tracking-wider text-tertiary">
            Pin Location on Map
          </label>
          {coords && (
            <span className="text-xs font-medium text-tertiary dark:text-tertiary">
              {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
            </span>
          )}
        </div>
        <ModernLocationPicker
          ref={pickerRef}
          initial={coords}
          onPinChange={handlePinChange}
          className="h-[260px] sm:h-[300px]"
        />
        {!coords && baseAddress.trim() && (
          <p className="text-2xs font-semibold text-[#B45309] dark:text-[#FCD34D] ml-1">
            Move the map or search an address to confirm this location before saving.
          </p>
        )}
      </div>

      {/* Step 3: Granular Building & Gate Details */}
      <div className="space-y-3 pt-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Base Street / House */}
          <div className="space-y-1 sm:col-span-2">
            <label htmlFor="address-street" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 ml-1">
              Street & Barangay
            </label>
            <input
              id="address-street"
              type="text"
              value={baseAddress}
              onChange={handleFieldChange(setBaseAddress, 'base')}
              placeholder="e.g. Sampaguita St., Brgy. Tunasan, Muntinlupa City"
              className="w-full neu-inset neu-input text-slate-800 dark:text-slate-100 rounded-xl py-2.5 px-3 text-xs font-medium outline-none transition-all"
            />
          </div>

          {/* Unit / Floor */}
          <div className="space-y-1">
            <label htmlFor="address-unit" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 ml-1">
              House / Unit / Lot No.
            </label>
            <input
              id="address-unit"
              type="text"
              value={unitFloor}
              onChange={handleFieldChange(setUnitFloor, 'unit')}
              placeholder="e.g. Block 14 Lot 8"
              className="w-full neu-inset neu-input text-slate-800 dark:text-slate-100 rounded-xl py-2.5 px-3 text-xs font-medium outline-none transition-all"
            />
          </div>

          {/* Subdivision / Gate */}
          <div className="space-y-1">
            <label htmlFor="address-subdivision" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 ml-1">
              Subdivision or Village
            </label>
            <input
              id="address-subdivision"
              type="text"
              value={subdivisionGate}
              onChange={handleFieldChange(setSubdivisionGate, 'sub')}
              placeholder="e.g. Victoria Homes Phase 2"
              className="w-full neu-inset neu-input text-slate-800 dark:text-slate-100 rounded-xl py-2.5 px-3 text-xs font-medium outline-none transition-all"
            />
          </div>

          {/* Gate & Arrival Instructions */}
          <div className="space-y-1 sm:col-span-2">
            <label htmlFor="address-arrival-notes" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 ml-1">
              Gate / Landmark Notes for Provider
            </label>
            <textarea
              id="address-arrival-notes"
              rows={2}
              value={arrivalInstructions}
              onChange={handleFieldChange(setArrivalInstructions, 'instr')}
              placeholder="e.g. Yellow gate beside bakery, ring buzzer on right pillar"
              className="w-full neu-inset neu-input text-slate-800 dark:text-slate-100 rounded-xl p-3 text-xs font-medium outline-none resize-none transition-all leading-relaxed"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

