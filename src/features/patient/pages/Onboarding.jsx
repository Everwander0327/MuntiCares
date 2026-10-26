import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Loader2, MapPin } from 'lucide-react';
import { Heart } from '@phosphor-icons/react';
import { toast } from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { IMAGES } from '@/lib/images';
import ModernLocationPicker from '@/features/tracking/components/ModernLocationPicker';
import AddressAutocomplete from '@/features/tracking/components/AddressAutocomplete';
import { formatFullVisitAddress, parseFullVisitAddress } from '@/features/tracking/services/addressFormat';

const FLUID = [0.22, 1, 0.36, 1];
const TOTAL_STEPS = 4;

const FIELD_ERRORS = {
  phone: 'Enter a mobile number with at least 7 digits.',
  emergencyContactName: "Enter your emergency contact's name.",
  emergencyContactPhone: 'Enter a reachable emergency contact number.',
  coords: 'Place the pin on your home location before continuing.',
  street: 'Enter your street and barangay.',
};

const FIELD_IDS = {
  phone: 'onboard-phone',
  emergencyContactName: 'onboard-emergency-name',
  emergencyContactPhone: 'onboard-emergency-phone',
  street: 'onboard-street',
};

const stepVariants = {
  enter: (dir) => ({
    x: dir > 0 ? 24 : -24,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.32, ease: FLUID },
  },
  exit: (dir) => ({
    x: dir > 0 ? -24 : 24,
    opacity: 0,
    transition: { duration: 0.22, ease: FLUID },
  }),
};

export default function Onboarding({ isPreview = false }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const pickerRef = useRef(null);

  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [loading, setLoading] = useState(!isPreview && !!user);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [errorAnnouncement, setErrorAnnouncement] = useState('');

  // Step 1: Contact & Emergency
  const [phone, setPhone] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');

  // Step 2 & 3: Map Pin & Address Details
  const [coords, setCoords] = useState(null);
  const [baseAddress, setBaseAddress] = useState('');
  const [unitFloor, setUnitFloor] = useState('');
  const [subdivisionGate, setSubdivisionGate] = useState('');
  const [arrivalInstructions, setArrivalInstructions] = useState('');

  // Step 4: Medical Notes (Optional)
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [allergies, setAllergies] = useState('');
  const [medicalHistory, setMedicalHistory] = useState('');
  const [alreadyComplete, setAlreadyComplete] = useState(false);

  useEffect(() => {
    if (isPreview || !user) {
      setLoading(false);
      return;
    }
    let mounted = true;
    const loadPatient = async () => {
      try {
        const { data: patData } = await supabase
          .from('patients')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!mounted) return;
        if (patData) {
          setAlreadyComplete(Boolean(patData.is_profile_complete));
          setPhone(patData.phone || '');
          const rawEmergency = patData.emergency_contact || '';
          if (rawEmergency.includes(' - ')) {
            const [eName, ePhone] = rawEmergency.split(' - ');
            setEmergencyContactName(eName || '');
            setEmergencyContactPhone(ePhone || '');
          } else {
            setEmergencyContactName(rawEmergency);
          }
          if (patData.address) {
            const parsed = parseFullVisitAddress(patData.address);
            setBaseAddress(parsed.baseAddress || patData.address);
            setArrivalInstructions(parsed.instructions || '');
          }
          if (patData.latitude != null && patData.longitude != null) {
            setCoords({ lat: Number(patData.latitude), lng: Number(patData.longitude) });
          }
          const rawNotes = patData.medical_notes || '';
          const dobMatch = rawNotes.match(/^DOB:\s*(\d{4}-\d{2}-\d{2})(?:\s*\|\s*)?/);
          if (dobMatch) {
            setDateOfBirth(dobMatch[1]);
            setMedicalHistory(rawNotes.slice(dobMatch[0].length));
          } else {
            setMedicalHistory(rawNotes);
          }
        }

        const { data: histRows } = await supabase
          .from('medical_histories')
          .select('allergies')
          .eq('patient_id', user.id);
        if (mounted && histRows?.[0]?.allergies) {
          setAllergies(histRows[0].allergies);
        }
      } catch {
        // ignore if new patient record
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadPatient();
    return () => {
      mounted = false;
    };
  }, [isPreview, user]);

  const goToStep = (nextStep) => {
    setDirection(nextStep > step ? 1 : -1);
    setStep(nextStep);
    setErrors({});
    setErrorAnnouncement('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const clearError = (field) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleAutocompleteSelect = (place) => {
    setBaseAddress(place.displayName);
    const nextCoords = { lat: place.lat, lng: place.lng };
    setCoords(nextCoords);
    clearError('coords');
    pickerRef.current?.flyToLocation(nextCoords);
  };

  const handlePinChange = (pin) => {
    setCoords({ lat: pin.lat, lng: pin.lng });
    clearError('coords');
    if (pin.address) {
      setBaseAddress(pin.address);
    }
  };

  const validateCurrentStep = () => {
    const nextErrors = {};

    if (step === 1) {
      if (!phone.trim() || phone.trim().length < 7) {
        nextErrors.phone = FIELD_ERRORS.phone;
      }
      if (!emergencyContactName.trim()) {
        nextErrors.emergencyContactName = FIELD_ERRORS.emergencyContactName;
      }
      if (!emergencyContactPhone.trim() || emergencyContactPhone.trim().length < 7) {
        nextErrors.emergencyContactPhone = FIELD_ERRORS.emergencyContactPhone;
      }
    }

    if (step === 2 && (!coords || coords.lat == null || coords.lng == null)) {
      nextErrors.coords = FIELD_ERRORS.coords;
    }

    if (step === 3 && !baseAddress.trim()) {
      nextErrors.street = FIELD_ERRORS.street;
    }

    setErrors(nextErrors);
    const firstField = Object.keys(nextErrors)[0];
    if (firstField) {
      setErrorAnnouncement(nextErrors[firstField]);
      const fieldId = FIELD_IDS[firstField];
      if (fieldId) requestAnimationFrame(() => document.getElementById(fieldId)?.focus());
      return false;
    }

    setErrorAnnouncement('');
    return true;
  };

  const handleContinue = () => {
    if (!validateCurrentStep()) return;
    if (step < TOTAL_STEPS) {
      goToStep(step + 1);
    } else {
      handleFinish(false);
    }
  };

  const handleFinish = async (skipMedical = false) => {
    setSaving(true);
    try {
      const compiledAddress =
        formatFullVisitAddress({
          unit: unitFloor,
          subdivision: subdivisionGate,
          baseAddress,
          instructions: arrivalInstructions,
        }) || baseAddress.trim();

      if (isPreview && !user) {
        toast.success('Onboarding preview completed');
        setStep(1);
        setSaving(false);
        return;
      }

      const emergencyCombined = `${emergencyContactName.trim()} - ${emergencyContactPhone.trim()}`;
      const notesCombined = [
        !skipMedical && dateOfBirth ? `DOB: ${dateOfBirth}` : '',
        !skipMedical && medicalHistory.trim() ? medicalHistory.trim() : '',
      ]
        .filter(Boolean)
        .join(' | ');

      const patientPayload = {
        user_id: user.id,
        phone: phone.trim(),
        address: compiledAddress,
        emergency_contact: emergencyCombined,
        medical_notes: notesCombined || null,
        is_profile_complete: true,
        latitude: coords?.lat ?? null,
        longitude: coords?.lng ?? null,
        geocoded_at: coords?.lat != null ? new Date().toISOString() : null,
      };

      const { error: patErr } = await supabase
        .from('patients')
        .upsert(patientPayload, { onConflict: 'user_id' });
      if (patErr) throw patErr;

      if (!skipMedical && allergies.trim()) {
        const { data: existingMH } = await supabase
          .from('medical_histories')
          .select('id')
          .eq('patient_id', user.id);

        if (existingMH && existingMH.length > 0) {
          await supabase
            .from('medical_histories')
            .update({ allergies: allergies.trim() })
            .eq('patient_id', user.id);
        } else {
          await supabase.from('medical_histories').insert({
            patient_id: user.id,
            allergies: allergies.trim(),
            chronic_conditions: '',
            past_surgeries: '',
          });
        }
      }

      toast.success('Profile setup complete');
      navigate('/patient/dashboard', { replace: true });
    } catch (err) {
      toast.error(err.message || 'Could not save setup details');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[var(--bg-main)]">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  const progressPercent = (step / TOTAL_STEPS) * 100;
  const isContinueDisabled = saving || (step === 2 && !coords);

  return (
    <div className="min-h-[100dvh] w-full grid grid-cols-1 lg:grid-cols-2 bg-[var(--bg-main)] text-slate-900 dark:text-slate-100">
      <div aria-live="assertive" aria-atomic="true" className="sr-only">
        {errorAnnouncement}
      </div>

      {/* FORM PANEL: Mobile-App Style Minimalist Onboarding Flow (right on desktop) */}
      <div className="flex flex-col justify-between min-h-[100dvh] bg-[var(--bg-main)] relative z-10 lg:order-2">
        {/* Minimal Top Header + Thin Progress Line */}
        <div>
          <header className="h-16 px-6 sm:px-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={() => goToStep(step - 1)}
                  className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
              ) : alreadyComplete ? (
                <Link
                  to="/patient/dashboard"
                  className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Dashboard</span>
                </Link>
              ) : (
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 font-display text-base font-black text-primary tracking-tight"
                >
                  <Heart size={18} weight="fill" className="text-primary" />
                  <span>MuntiCares</span>
                </Link>
              )}
            </div>

            <div className="flex items-center gap-4">
              {step === 4 && (
                <button
                  type="button"
                  onClick={() => handleFinish(true)}
                  disabled={saving}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
                >
                  Skip
                </button>
              )}
              <span className="text-xs font-medium text-slate-400 dark:text-slate-500 tabular-nums">
                0{step} / 0{TOTAL_STEPS}
              </span>
            </div>
          </header>

          {/* Thin 2px Progress Line */}
          <div className="w-full h-0.5 bg-slate-200/70 dark:bg-slate-800 overflow-hidden">
            <motion.div
              className="h-full bg-primary"
              initial={{ width: '25%' }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.4, ease: FLUID }}
            />
          </div>
        </div>

        {/* Center Stage: Focused Single-Screen Step Content */}
        <main className="flex-1 flex flex-col justify-center px-6 sm:px-12 lg:px-14 xl:px-20 py-8 max-w-xl mx-auto w-full">
          <AnimatePresence mode="wait" custom={direction}>
            {/* STEP 1: CONTACT & EMERGENCY */}
            {step === 1 && (
              <motion.div
                key="step-1"
                custom={direction}
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="space-y-6"
              >
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                    Step 01
                  </p>
                  <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                    How can providers reach you?
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                    Used by your assigned healthcare provider for visit coordination and emergencies.
                  </p>
                </div>

                <div className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="onboard-phone"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      Mobile Number
                    </label>
                    <input
                      id="onboard-phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      required
                      aria-invalid={Boolean(errors.phone)}
                      aria-describedby={errors.phone ? 'onboard-phone-error' : undefined}
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        clearError('phone');
                      }}
                      placeholder="0917 123 4567"
                      className="w-full neu-inset neu-input rounded-xl px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none transition-all"
                    />
                    {errors.phone && (
                      <p id="onboard-phone-error" className="text-xs font-medium text-red-600 dark:text-red-400">
                        {errors.phone}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="onboard-emergency-name"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      Emergency Contact Name
                    </label>
                    <input
                      id="onboard-emergency-name"
                      type="text"
                      autoComplete="name"
                      required
                      aria-invalid={Boolean(errors.emergencyContactName)}
                      aria-describedby={errors.emergencyContactName ? 'onboard-emergency-name-error' : undefined}
                      value={emergencyContactName}
                      onChange={(e) => {
                        setEmergencyContactName(e.target.value);
                        clearError('emergencyContactName');
                      }}
                      placeholder="Full name of family member or guardian"
                      className="w-full neu-inset neu-input rounded-xl px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none transition-all"
                    />
                    {errors.emergencyContactName && (
                      <p
                        id="onboard-emergency-name-error"
                        className="text-xs font-medium text-red-600 dark:text-red-400"
                      >
                        {errors.emergencyContactName}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="onboard-emergency-phone"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      Emergency Contact Number
                    </label>
                    <input
                      id="onboard-emergency-phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      required
                      aria-invalid={Boolean(errors.emergencyContactPhone)}
                      aria-describedby={
                        errors.emergencyContactPhone ? 'onboard-emergency-phone-error' : undefined
                      }
                      value={emergencyContactPhone}
                      onChange={(e) => {
                        setEmergencyContactPhone(e.target.value);
                        clearError('emergencyContactPhone');
                      }}
                      placeholder="0918 765 4321"
                      className="w-full neu-inset neu-input rounded-xl px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none transition-all"
                    />
                    {errors.emergencyContactPhone && (
                      <p
                        id="onboard-emergency-phone-error"
                        className="text-xs font-medium text-red-600 dark:text-red-400"
                      >
                        {errors.emergencyContactPhone}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 2: PIN LOCATION ON MAP */}
            {step === 2 && (
              <motion.div
                key="step-2"
                custom={direction}
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="space-y-4"
              >
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                    Step 02
                  </p>
                  <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                    Pin your home location
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                    Search your street or drag the map to place the pin right at your entrance.
                  </p>
                </div>

                <div className="space-y-3 pt-1">
                  <AddressAutocomplete
                    onSelect={handleAutocompleteSelect}
                    initialQuery={baseAddress}
                  />

                  <ModernLocationPicker
                    ref={pickerRef}
                    initial={coords}
                    onPinChange={handlePinChange}
                    className="h-[260px] sm:h-[300px]"
                  />

                  <div className="flex items-start gap-2.5 pt-1 text-xs text-slate-600 dark:text-slate-300">
                    <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                        {baseAddress || 'Move the map to select your street'}
                      </p>
                      {coords && (
                        <p className="text-2xs text-slate-400 mt-0.5 tabular-nums">
                          {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                        </p>
                      )}
                    </div>
                  </div>

                  {errors.coords && (
                    <p id="onboard-location-error" className="text-xs font-medium text-red-600 dark:text-red-400">
                      {errors.coords}
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            {/* STEP 3: HOUSE & GATE DETAILS */}
            {step === 3 && (
              <motion.div
                key="step-3"
                custom={direction}
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="space-y-6"
              >
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                    Step 03
                  </p>
                  <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                    Add address details
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                    Saved permanently to your profile so future home visits automatically go here.
                  </p>
                </div>

                <div className="space-y-4 pt-1">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200/70 dark:border-white/10">
                    <div className="min-w-0 pr-3">
                      <p className="text-2xs uppercase tracking-wider font-semibold text-slate-400">
                        Pinned Location
                      </p>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate mt-0.5">
                        {baseAddress || 'Location pinned on map'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => goToStep(2)}
                      className="text-xs font-semibold text-primary hover:underline shrink-0 cursor-pointer"
                    >
                      Adjust pin
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="onboard-street"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      Street & Barangay
                    </label>
                    <input
                      id="onboard-street"
                      type="text"
                      required
                      aria-invalid={Boolean(errors.street)}
                      aria-describedby={errors.street ? 'onboard-street-error' : undefined}
                      value={baseAddress}
                      onChange={(e) => {
                        setBaseAddress(e.target.value);
                        clearError('street');
                      }}
                      placeholder="e.g. Sampaguita St., Brgy. Tunasan, Muntinlupa City"
                      className="w-full neu-inset neu-input rounded-xl px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none transition-all"
                    />
                    {errors.street && (
                      <p id="onboard-street-error" className="text-xs font-medium text-red-600 dark:text-red-400">
                        {errors.street}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1.5">
                      <label
                        htmlFor="onboard-unit"
                        className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                      >
                        House / Unit / Lot No.
                      </label>
                      <input
                        id="onboard-unit"
                        type="text"
                        value={unitFloor}
                        onChange={(e) => setUnitFloor(e.target.value)}
                        placeholder="e.g. Block 14 Lot 8"
                        className="w-full neu-inset neu-input rounded-xl px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none transition-all"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="onboard-subdivision"
                        className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                      >
                        Subdivision or Village
                      </label>
                      <input
                        id="onboard-subdivision"
                        type="text"
                        value={subdivisionGate}
                        onChange={(e) => setSubdivisionGate(e.target.value)}
                        placeholder="e.g. Victoria Homes"
                        className="w-full neu-inset neu-input rounded-xl px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="onboard-instructions"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      Gate or Landmark Notes for Provider (Optional)
                    </label>
                    <textarea
                      id="onboard-instructions"
                      rows={2}
                      value={arrivalInstructions}
                      onChange={(e) => setArrivalInstructions(e.target.value)}
                      placeholder="e.g. White gate near the chapel, ring doorbell on the right"
                      className="w-full neu-inset neu-input rounded-xl px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none resize-none transition-all"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 4: MEDICAL NOTES (OPTIONAL) */}
            {step === 4 && (
              <motion.div
                key="step-4"
                custom={direction}
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="space-y-6"
              >
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                    Step 04 · Optional
                  </p>
                  <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                    Any medical notes to share?
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                    Help your care provider prepare before arriving. You can also update this anytime in your profile.
                  </p>
                </div>

                <div className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="onboard-dob"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      Date of Birth
                    </label>
                    <input
                      id="onboard-dob"
                      type="date"
                      autoComplete="bday"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      className="w-full neu-inset neu-input rounded-xl px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100 outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="onboard-allergies"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      Known Allergies
                    </label>
                    <input
                      id="onboard-allergies"
                      type="text"
                      value={allergies}
                      onChange={(e) => setAllergies(e.target.value)}
                      placeholder="e.g. Penicillin, Aspirin, or leave blank"
                      className="w-full neu-inset neu-input rounded-xl px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="onboard-history"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      Medical or Mobility Notes
                    </label>
                    <textarea
                      id="onboard-history"
                      rows={3}
                      value={medicalHistory}
                      onChange={(e) => setMedicalHistory(e.target.value)}
                      placeholder="e.g. Post-stroke recovery, needs wheelchair assistance"
                      className="w-full neu-inset neu-input rounded-xl px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none resize-none transition-all"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Pinned Bottom Action Bar */}
        <footer className="onboarding-footer sticky bottom-0 z-20 bg-inherit px-6 sm:px-12 lg:px-14 xl:px-20 pb-8 pt-2 max-w-xl mx-auto w-full">
          <div className="flex flex-col gap-2.5">
            <motion.button
              type="button"
              onClick={handleContinue}
              disabled={isContinueDisabled}
              whileTap={!isContinueDisabled ? { scale: 0.99 } : {}}
              className="neu-btn-primary w-full py-3.5 px-6 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving…</span>
                </>
              ) : step < TOTAL_STEPS ? (
                <>
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              ) : (
                <span>Complete Setup</span>
              )}
            </motion.button>

            {step === 4 && (
              <button
                type="button"
                onClick={() => handleFinish(true)}
                disabled={saving}
                className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                Skip medical notes for now
              </button>
            )}
          </div>
        </footer>
      </div>

      {/* HERO PANEL: MuntiCares Hero Section (left on desktop) */}
      <aside
        className="hidden lg:flex lg:order-1 relative overflow-hidden flex-col justify-between p-12 xl:p-16 border-r border-slate-200/60 dark:border-white/5 select-none"
        aria-label="MuntiCares overview"
      >
        {/* Cinematic full-bleed backdrop with theme-aware wash matching Hero.jsx */}
        <div className="absolute inset-0 -z-20">
          <img
            src={IMAGES.landing.heroWash}
            alt=""
            aria-hidden="true"
            loading="eager"
            decoding="async"
            className="h-full w-full object-cover opacity-65 contrast-105 saturate-110 dark:grayscale dark:mix-blend-luminosity dark:opacity-90 dark:contrast-125"
          />
        </div>
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-secondary/60 via-white/55 to-white/80 dark:from-slate-950/80 dark:via-slate-950/70 dark:to-slate-900" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(2,6,23,0.08)_75%)] dark:bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(2,6,23,0.55)_75%)]" />

        {/* Top Brand Wordmark */}
        <div className="relative z-10 flex items-center gap-2.5">
          <div className="neu-flat-sm p-2 rounded-xl">
            <Heart size={20} weight="fill" className="text-primary fill-primary" />
          </div>
          <span className="font-display text-xl font-black text-primary tracking-tight">
            MuntiCares
          </span>
        </div>

        {/* Center Hero Typography */}
        <div className="relative z-10 my-auto max-w-lg space-y-6">
          <h2 className="font-display text-4xl xl:text-5xl font-semibold text-slate-900 dark:text-white tracking-tight leading-[1.12]">
            Quality home care{' '}
            <br />
            right at your{' '}
            <span className="text-transparent bg-gradient-to-r from-primary-600 via-blue-500 to-primary-600 dark:from-blue-200 dark:via-white dark:to-blue-200 bg-clip-text">
              doorstep
            </span>
          </h2>

          <p className="text-base xl:text-lg font-medium text-slate-700 dark:text-slate-200 leading-relaxed dark:drop-shadow-[0_2px_12px_rgba(0,0,0,0.55)]">
            Connecting Muntinlupa City residents with trusted, verified home care providers — fast, secure, and patient-first.
          </p>
        </div>

        {/* Bottom Subtle Caption */}
        <div className="relative z-10 text-xs font-medium text-slate-500 dark:text-slate-400">
          <span>Muntinlupa City Home Care Network</span>
        </div>
      </aside>
    </div>
  );
}
