import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, MapPin, RotateCcw } from 'lucide-react';
import { Heart } from '@phosphor-icons/react';
import { toast } from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { IMAGES } from '@/lib/images';
import AddressAutocomplete from '@/features/tracking/components/AddressAutocomplete';
import {
  formatFullVisitAddress,
  isCoordinateAddress,
  splitVisitAddress,
} from '@/features/tracking/services/addressFormat';
import { isValidPhPhone, normalizePhPhone, PHONE_ERROR } from '@/features/patient/utils/phone';
import {
  ACCESS_NEEDS,
  BLOOD_TYPES,
  accessNeedLabel,
  normalizeAccessNeeds,
  toggleAccessNeed,
} from '@/features/patient/utils/accessNeeds';
import {
  isMissingColumnError,
  parseEmergencyContact,
} from '@/features/patient/utils/patientProfile';
import { buildOnboardingDraft } from '@/features/patient/utils/onboardingDraft';

// The map chunk pulls in MapLibre; it is only needed from step 2 onward.
const ModernLocationPicker = lazy(() => import('@/features/tracking/components/ModernLocationPicker'));

const FLUID = [0.22, 1, 0.36, 1];
const TOTAL_STEPS = 5;
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const FIELD_ERRORS = {
  phone: PHONE_ERROR,
  fullName: 'Enter the name providers should use for you.',
  emergencyContactName: "Enter your emergency contact's name.",
  emergencyContactPhone: PHONE_ERROR,
  emergencyContactSame: 'Emergency contact must be a different number from yours.',
  coords: 'Place the pin on your home entrance before continuing.',
  street: 'Enter your street and barangay.',
  streetCoordinates: 'Enter a street and barangay instead of map coordinates.',
  consent: 'Tick the consent box to save medical details, or clear those fields.',
};

const FIELD_IDS = {
  fullName: 'onboard-name',
  phone: 'onboard-phone',
  emergencyContactName: 'onboard-emergency-name',
  emergencyContactPhone: 'onboard-emergency-phone',
  street: 'onboard-street',
  consent: 'onboard-consent',
};

const inputClass =
  'w-full neu-inset neu-input rounded-xl border border-field px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-tertiary outline-none transition-all';
const textareaClass = `${inputClass} resize-none`;
const labelClass = 'block text-xs font-semibold text-slate-700 dark:text-slate-300';
const errorClass = 'text-sm font-medium text-danger dark:text-danger-dark';
const smallActionClass =
  'inline-flex min-h-11 items-center px-2 text-sm font-semibold text-link hover:underline cursor-pointer';

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

const reducedStepVariants = {
  enter: { x: 0, opacity: 0 },
  center: { x: 0, opacity: 1, transition: { duration: 0.12 } },
  exit: { x: 0, opacity: 0, transition: { duration: 0.1 } },
};

const readDraft = (key) => {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (Date.now() - Number(parsed.savedAt || 0) > DRAFT_TTL_MS) {
      window.localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const writeDraft = (key, draft) => {
  try {
    window.localStorage.setItem(key, JSON.stringify({ ...draft, savedAt: Date.now() }));
  } catch {
    // Private mode or a full quota: autosave is best-effort.
  }
};

const clearDraft = (key) => {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
};

const formatReviewDate = (value) => {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-PH', { day: 'numeric', month: 'short', year: 'numeric' });
};

function ReviewRow({ label, value, onEdit, error, children }) {
  return (
    <div className="px-4 py-3 flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-tertiary">{label}</p>
        {value && (
          <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100 break-words">{value}</p>
        )}
        {children}
        {error && <p className={`mt-1 ${errorClass}`}>{error}</p>}
      </div>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${label}`}
          className={`${smallActionClass} -mr-2 shrink-0`}
        >
          Edit
        </button>
      )}
    </div>
  );
}

export default function Onboarding({ isPreview = false }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const pickerRef = useRef(null);
  const mainRef = useRef(null);
  const reduceMotion = useReducedMotion();
  const stepMotion = reduceMotion ? reducedStepVariants : stepVariants;
  const draftKey = `mc_onboarding_draft_${isPreview ? 'preview' : user?.id || 'guest'}`;

  // Read the draft once, before the first paint, so the initial state and the
  // database load can agree on which source wins.
  const draftRef = useRef(undefined);
  if (draftRef.current === undefined) draftRef.current = readDraft(draftKey);
  const draft = draftRef.current;

  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [loading, setLoading] = useState(!isPreview && !!user?.id);
  const [loadError, setLoadError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [errors, setErrors] = useState({});
  const [errorAnnouncement, setErrorAnnouncement] = useState('');

  // Step 1: Contact
  const [fullName, setFullName] = useState(draft?.fullName ?? user?.full_name ?? '');
  const [phone, setPhone] = useState(draft?.phone ?? '');
  const [emergencyContactName, setEmergencyContactName] = useState(draft?.emergencyContactName ?? '');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(draft?.emergencyContactPhone ?? '');

  // Step 2 & 3: Map Pin & Address Details
  const [coords, setCoords] = useState(draft?.coords ?? null);
  const [pinStatus, setPinStatus] = useState(coords ? 'resolved' : 'idle');
  const [baseAddress, setBaseAddress] = useState(draft?.baseAddress ?? '');
  const [unitFloor, setUnitFloor] = useState(draft?.unitFloor ?? '');
  const [subdivisionGate, setSubdivisionGate] = useState(draft?.subdivisionGate ?? '');
  const [arrivalInstructions, setArrivalInstructions] = useState(draft?.arrivalInstructions ?? '');
  const [accessNeeds, setAccessNeeds] = useState(() => normalizeAccessNeeds(draft?.accessNeeds));

  // Step 4: Health Basics (Optional)
  const [dateOfBirth, setDateOfBirth] = useState(draft?.dateOfBirth ?? '');
  const [allergies, setAllergies] = useState(draft?.allergies ?? '');
  const [chronicConditions, setChronicConditions] = useState(draft?.chronicConditions ?? '');
  const [medications, setMedications] = useState(draft?.medications ?? '');
  const [bloodType, setBloodType] = useState(draft?.bloodType ?? '');
  const [medicalHistory, setMedicalHistory] = useState(draft?.medicalHistory ?? '');
  const [privacyConsent, setPrivacyConsent] = useState(Boolean(draft?.privacyConsent));
  const [alreadyComplete, setAlreadyComplete] = useState(false);
  const [returnToReview, setReturnToReview] = useState(false);
  const [omitMedical, setOmitMedical] = useState(false);

  useEffect(() => {
    if (draft) toast('Restored your saved progress');
    // Restore notice is intentionally one-shot for the mounted flow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isPreview || !user?.id) {
      setLoading(false);
      return;
    }
    let mounted = true;
    setLoading(true);
    setLoadError('');

    const loadPatient = async () => {
      try {
        const { data: patData, error: patError } = await supabase
          .from('patients')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();
        if (patError) throw patError;
        if (!mounted) return;

        const hasDraft = Boolean(draft);
        if (patData) {
          setAlreadyComplete(Boolean(patData.is_profile_complete));
          if (!hasDraft) {
            setPhone(patData.phone ? normalizePhPhone(patData.phone) : '');
            if (user?.full_name) setFullName(user.full_name);
            setAccessNeeds(normalizeAccessNeeds(patData.access_needs));

            // Every profile screen writes the combined legacy string, so it is
            // the freshest source; structured columns only fill the gaps.
            const legacy = parseEmergencyContact(patData.emergency_contact || '');
            const structuredName = patData.emergency_contact_name || '';
            const structuredPhone = patData.emergency_contact_phone || '';
            setEmergencyContactName(legacy.name || structuredName);
            const emergencyPhone = legacy.phone || structuredPhone;
            setEmergencyContactPhone(emergencyPhone ? normalizePhPhone(emergencyPhone) : '');

            const savedAddress = patData.address || '';
            if (savedAddress && !isCoordinateAddress(savedAddress)) {
              const parts = splitVisitAddress(savedAddress, {
                unit: patData.unit || '',
                subdivision: patData.subdivision || '',
              });
              setBaseAddress(parts.baseAddress || savedAddress);
              setUnitFloor(parts.unit || '');
              setSubdivisionGate(parts.subdivision || '');
              setArrivalInstructions(parts.instructions || '');
            }

            if (patData.latitude != null && patData.longitude != null) {
              setCoords({ lat: Number(patData.latitude), lng: Number(patData.longitude) });
              setPinStatus('resolved');
            }

            let notes = patData.medical_notes || '';
            let dob = patData.date_of_birth ? String(patData.date_of_birth).slice(0, 10) : '';
            const dobMatch = notes.match(/^DOB:\s*(\d{4}-\d{2}-\d{2})(?:\s*\|\s*)?/);
            if (dobMatch) {
              if (!dob) dob = dobMatch[1];
              notes = notes.slice(dobMatch[0].length);
            }
            setDateOfBirth(dob);
            setMedicalHistory(notes);
            setPrivacyConsent(Boolean(patData.privacy_consent_at));
          }
        }

        const { data: histRows, error: histError } = await supabase
          .from('medical_histories')
          .select('*')
          .eq('patient_id', user.id);
        if (histError) throw histError;
        if (mounted && !hasDraft && histRows?.[0]) {
          const history = histRows[0];
          if (history.allergies) setAllergies(history.allergies);
          if (history.chronic_conditions) setChronicConditions(history.chronic_conditions);
          if (history.medications) setMedications(history.medications);
          if (history.blood_type) setBloodType(history.blood_type);
        }
      } catch (err) {
        if (mounted) {
          setLoadError(
            err?.message ||
              'We could not load your saved details. Check your connection and try again.'
          );
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadPatient();
    return () => {
      mounted = false;
    };
    // `draft` is read once at mount on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPreview, user?.id, reloadToken]);

  // Autosave answers so a dropped connection or closed tab does not erase them.
  // Medical answers stay out of the draft until the patient consents.
  useEffect(() => {
    if (completed || loading) return undefined;
    const draft = buildOnboardingDraft({
      fullName,
      phone,
      emergencyContactName,
      emergencyContactPhone,
      coords,
      baseAddress,
      unitFloor,
      subdivisionGate,
      arrivalInstructions,
      accessNeeds,
      privacyConsent,
      dateOfBirth,
      allergies,
      chronicConditions,
      medications,
      bloodType,
      medicalHistory,
    });
    if (!draft) return undefined;
    const timer = setTimeout(() => writeDraft(draftKey, draft), 600);
    return () => clearTimeout(timer);
  }, [
    completed,
    loading,
    draftKey,
    fullName,
    phone,
    emergencyContactName,
    emergencyContactPhone,
    coords,
    baseAddress,
    unitFloor,
    subdivisionGate,
    arrivalInstructions,
    accessNeeds,
    dateOfBirth,
    allergies,
    chronicConditions,
    medications,
    bloodType,
    medicalHistory,
    privacyConsent,
  ]);

  // The step wrapper focuses the region once it has mounted; focusing before
  // AnimatePresence swaps content lands on an element without a heading label.
  const focusStepRegion = () => {
    mainRef.current?.focus({ preventScroll: true });
  };

  const goToStep = (nextStep) => {
    setDirection(nextStep > step ? 1 : -1);
    setStep(nextStep);
    setErrors({});
    setErrorAnnouncement('');
    // Re-entering health basics means the patient wants to add details again.
    if (nextStep === 4) setOmitMedical(false);
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  };

  // Review rows jump back to the step that owns the field; Continue returns
  // straight to the review instead of walking through the remaining steps.
  const editFromReview = (targetStep) => {
    setReturnToReview(true);
    goToStep(targetStep);
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
    setPinStatus('pending');
    clearError('coords');
    pickerRef.current?.flyToLocation(nextCoords);
  };

  const handlePinChange = (pin) => {
    if (pin.lat == null || pin.lng == null) return;
    setCoords({ lat: pin.lat, lng: pin.lng });
    clearError('coords');
    if (pin.pending) {
      setPinStatus('pending');
      return;
    }
    setPinStatus(pin.resolved ? 'resolved' : 'unresolved');
    // A late lookup must not overwrite the street text the user already edited
    // after moving on from the map step.
    if (pin.address && step === 2) setBaseAddress(pin.address);
  };

  const validateCurrentStep = () => {
    const nextErrors = {};

    if (step === 1) {
      const trimmedPhone = phone.trim();
      const trimmedEmergencyPhone = emergencyContactPhone.trim();
      if (!trimmedPhone) {
        nextErrors.phone = 'Enter your mobile number.';
      } else if (!isValidPhPhone(trimmedPhone)) {
        nextErrors.phone = FIELD_ERRORS.phone;
      }
      if (!emergencyContactName.trim()) {
        nextErrors.emergencyContactName = FIELD_ERRORS.emergencyContactName;
      }
      if (!trimmedEmergencyPhone) {
        nextErrors.emergencyContactPhone = 'Enter your emergency contact number.';
      } else if (!isValidPhPhone(trimmedEmergencyPhone)) {
        nextErrors.emergencyContactPhone = FIELD_ERRORS.emergencyContactPhone;
      } else if (
        !nextErrors.phone &&
        normalizePhPhone(trimmedPhone) === normalizePhPhone(trimmedEmergencyPhone)
      ) {
        nextErrors.emergencyContactPhone = FIELD_ERRORS.emergencyContactSame;
      }
    }

    if (step === 2 && (!coords || coords.lat == null || coords.lng == null)) {
      nextErrors.coords = FIELD_ERRORS.coords;
    }

    if (step === 3) {
      if (!baseAddress.trim()) {
        nextErrors.street = FIELD_ERRORS.street;
      } else if (isCoordinateAddress(baseAddress)) {
        nextErrors.street = FIELD_ERRORS.streetCoordinates;
      }
    }

    if (step === 4) {
      const hasMedicalDetails = Boolean(
        dateOfBirth ||
          allergies.trim() ||
          chronicConditions.trim() ||
          medications.trim() ||
          bloodType ||
          medicalHistory.trim()
      );
      if (hasMedicalDetails && !privacyConsent) {
        nextErrors.consent = FIELD_ERRORS.consent;
      }
    }

    if (step === 5) {
      if (!isPreview && !fullName.trim()) {
        nextErrors.fullName = FIELD_ERRORS.fullName;
      }
      // Re-run the same contact rules on the review screen: the name and numbers
      // shown there are what providers will use.
      if (!isValidPhPhone(phone.trim())) {
        nextErrors.phone = FIELD_ERRORS.phone;
      }
      if (!isValidPhPhone(emergencyContactPhone.trim())) {
        nextErrors.emergencyContactPhone = FIELD_ERRORS.emergencyContactPhone;
      }
      if (!privacyConsent && !omitMedical && (dateOfBirth || allergies.trim() || chronicConditions.trim() || medications.trim() || bloodType || medicalHistory.trim())) {
        nextErrors.consent = FIELD_ERRORS.consent;
      }
    }

    setErrors(nextErrors);
    const firstField = Object.keys(nextErrors)[0];
    if (firstField) {
      setErrorAnnouncement(nextErrors[firstField]);
      const fieldId = FIELD_IDS[firstField];
      if (fieldId) {
        requestAnimationFrame(() => document.getElementById(fieldId)?.focus());
      } else {
        mainRef.current?.focus({ preventScroll: true });
      }
      return false;
    }

    setErrorAnnouncement('');
    return true;
  };

  const handleContinue = () => {
    if (!validateCurrentStep()) return;
    if (returnToReview && step < TOTAL_STEPS) {
      setReturnToReview(false);
      goToStep(TOTAL_STEPS);
      return;
    }
    if (step < TOTAL_STEPS) {
      goToStep(step + 1);
    } else {
      handleFinish(omitMedical);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (saving) return;
    handleContinue();
  };

  const saveProfile = async ({ skipMedical }) => {
    const trimmedUnit = unitFloor.trim();
    const trimmedSubdivision = subdivisionGate.trim();
    const trimmedStreet = baseAddress.trim();
    const compiledAddress =
      formatFullVisitAddress({
        unit: trimmedUnit,
        subdivision: trimmedSubdivision,
        baseAddress: trimmedStreet,
        instructions: arrivalInstructions,
      }) || trimmedStreet;

    const phoneValue = normalizePhPhone(phone);
    const emergencyPhoneValue = normalizePhPhone(emergencyContactPhone);
    const emergencyName = emergencyContactName.trim();

    const payload = {
      user_id: user.id,
      phone: phoneValue,
      address: compiledAddress,
      unit: trimmedUnit || null,
      subdivision: trimmedSubdivision || null,
      emergency_contact: `${emergencyName} - ${emergencyPhoneValue}`,
      emergency_contact_name: emergencyName,
      emergency_contact_phone: emergencyPhoneValue,
      access_needs: accessNeeds,
      latitude: coords?.lat ?? null,
      longitude: coords?.lng ?? null,
      geocoded_at: coords?.lat != null ? new Date().toISOString() : null,
      // Completion is flipped only after every dependent write succeeds.
      is_profile_complete: false,
    };

    if (!skipMedical) {
      payload.date_of_birth = dateOfBirth || null;
      payload.medical_notes = medicalHistory.trim() || null;
      if (privacyConsent) payload.privacy_consent_at = new Date().toISOString();
    }

    const legacyPayload = {
      user_id: user.id,
      phone: phoneValue,
      address: compiledAddress,
      emergency_contact: `${emergencyName} - ${emergencyPhoneValue}`,
      medical_notes: skipMedical ? undefined : [dateOfBirth ? `DOB: ${dateOfBirth}` : '', medicalHistory.trim()]
        .filter(Boolean)
        .join(' | ') || null,
      latitude: coords?.lat ?? null,
      longitude: coords?.lng ?? null,
      geocoded_at: coords?.lat != null ? new Date().toISOString() : null,
      is_profile_complete: false,
    };

    const upsertPatient = (body) => supabase.from('patients').upsert(body, { onConflict: 'user_id' });

    // The review step is the only place the account name is verified, so a
    // correction there has to reach the account record before completion flips.
    const trimmedName = fullName.trim();
    if (!isPreview && trimmedName && trimmedName !== (user?.full_name || '').trim()) {
      const { error: nameError } = await supabase
        .from('users')
        .update({ full_name: trimmedName })
        .eq('id', user.id);
      if (nameError) throw nameError;
    }

    let { error: patientError } = await upsertPatient(payload);
    if (patientError && isMissingColumnError(patientError)) {
      ({ error: patientError } = await upsertPatient(legacyPayload));
    }
    if (patientError) throw patientError;

    if (!skipMedical) {
      const trimmedAllergies = allergies.trim();
      const trimmedConditions = chronicConditions.trim();
      const trimmedMedications = medications.trim();
      const historyPayload = {
        allergies: trimmedAllergies,
        chronic_conditions: trimmedConditions,
        medications: trimmedMedications,
        blood_type: bloodType || null,
      };
      const legacyHistoryPayload = {
        allergies: trimmedAllergies,
        chronic_conditions: trimmedConditions,
      };

      const { data: existingHistory, error: historyLookupError } = await supabase
        .from('medical_histories')
        .select('id')
        .eq('patient_id', user.id);
      if (historyLookupError) throw historyLookupError;

      const hasHistoryContent = Boolean(
        trimmedAllergies || trimmedConditions || trimmedMedications || bloodType
      );

      if (existingHistory?.length || hasHistoryContent) {
        const writeHistory = (body) =>
          existingHistory?.length
            ? supabase.from('medical_histories').update(body).eq('patient_id', user.id)
            : supabase
                .from('medical_histories')
                .insert({ patient_id: user.id, past_surgeries: '', ...body });

        let { error: historyError } = await writeHistory(historyPayload);
        if (historyError && isMissingColumnError(historyError)) {
          ({ error: historyError } = await writeHistory(legacyHistoryPayload));
        }
        if (historyError) throw historyError;
      }
    }

    const { error: completeError } = await supabase
      .from('patients')
      .update({ is_profile_complete: true })
      .eq('user_id', user.id);
    if (completeError) throw completeError;
  };

  const handleFinish = async (skipMedical = false) => {
    if (isPreview) {
      clearDraft(draftKey);
      setCompleted(true);
      return;
    }
    if (!user?.id) {
      toast.error('Please sign in to save your profile.');
      return;
    }

    setSaving(true);
    try {
      await saveProfile({ skipMedical });
      clearDraft(draftKey);
      setCompleted(true);
      toast.success('Profile setup complete');
    } catch (err) {
      toast.error(err?.message || 'Could not save your setup details. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const restartPreview = () => {
    clearDraft(draftKey);
    draftRef.current = null;
    setFullName(user?.full_name ?? '');
    setPhone('');
    setEmergencyContactName('');
    setEmergencyContactPhone('');
    setCoords(null);
    setPinStatus('idle');
    setBaseAddress('');
    setUnitFloor('');
    setSubdivisionGate('');
    setArrivalInstructions('');
    setAccessNeeds([]);
    setDateOfBirth('');
    setAllergies('');
    setChronicConditions('');
    setMedications('');
    setBloodType('');
    setMedicalHistory('');
    setPrivacyConsent(false);
    setErrors({});
    setErrorAnnouncement('');
    setDirection(-1);
    setStep(1);
    setCompleted(false);
    setReturnToReview(false);
    setOmitMedical(false);
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-surface-page px-6 py-10">
        <div className="mx-auto w-full max-w-xl space-y-6" aria-busy="true" aria-label="Loading your saved details">
          <div className="h-4 w-24 rounded-full bg-surface-subtle animate-pulse" />
          <div className="h-9 w-3/4 rounded-xl bg-surface-subtle animate-pulse" />
          <div className="h-4 w-full rounded-lg bg-surface-subtle animate-pulse" />
          <div className="space-y-4 pt-6">
            {[0, 1, 2].map((row) => (
              <div key={row} className="space-y-2">
                <div className="h-3 w-28 rounded bg-surface-subtle animate-pulse" />
                <div className="h-12 w-full rounded-xl bg-surface-subtle animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[var(--bg-main)] px-6 text-slate-900 dark:text-slate-100">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: FLUID }}
          className="w-full max-w-md text-center space-y-5"
        >
          <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
            <CheckCircle2 className="w-7 h-7 text-link" />
          </div>
          <div className="space-y-1.5">
            <h1 className="font-display text-2xl font-bold tracking-tight">
              {isPreview ? 'Preview complete' : "You're all set"}
            </h1>
            <p className="text-sm text-tertiary dark:text-tertiary leading-relaxed">
              {isPreview
                ? 'This was a preview of the onboarding flow. Nothing was saved.'
                : 'Your home care profile is saved. Providers you book will use this address and pin for visits.'}
            </p>
          </div>
          {isPreview ? (
            <button
              type="button"
              onClick={restartPreview}
              className="neu-btn-primary w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Start over</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate('/patient/dashboard', { replace: true })}
              className="neu-btn-primary w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              <span>Go to dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </motion.div>
      </div>
    );
  }

  const progressPercent = (step / TOTAL_STEPS) * 100;
  const isContinueDisabled = saving;

  const emergencySummary = emergencyContactName.trim()
    ? `${emergencyContactName.trim()} · ${emergencyContactPhone || 'No number'}`
    : 'Not added';

  const addressSummary =
    formatFullVisitAddress({
      unit: unitFloor.trim(),
      subdivision: subdivisionGate.trim(),
      baseAddress: baseAddress.trim(),
    }) ||
    baseAddress.trim() ||
    'Not set';

  const accessSummary = accessNeeds.length
    ? accessNeeds.map(accessNeedLabel).join(', ')
    : 'None selected';

  const healthItems = omitMedical
    ? []
    : [
        dateOfBirth && { label: 'Date of birth', value: formatReviewDate(dateOfBirth) },
        bloodType && bloodType !== 'Unknown' && { label: 'Blood type', value: bloodType },
        allergies.trim() && { label: 'Allergies', value: allergies.trim() },
        chronicConditions.trim() && { label: 'Conditions', value: chronicConditions.trim() },
        medications.trim() && { label: 'Medications', value: medications.trim() },
        medicalHistory.trim() && { label: 'Mobility notes', value: medicalHistory.trim() },
      ].filter(Boolean);

  return (
    <div className="min-h-[100dvh] w-full grid grid-cols-1 lg:grid-cols-2 bg-surface-page text-slate-900 dark:text-slate-100">
      <div aria-live="assertive" aria-atomic="true" className="sr-only">
        {errorAnnouncement}
      </div>

      {/* FORM PANEL: Mobile-App Style Minimalist Onboarding Flow (right on desktop) */}
      <div className="flex flex-col min-h-[100dvh] bg-surface-page relative z-10 lg:order-2">
        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex flex-1 flex-col justify-between min-h-[100dvh] w-full"
        >
          {/* Minimal Top Header + Thin Progress Line */}
          <div>
            <header className="h-16 px-6 sm:px-10 flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                {step > 1 || returnToReview ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (returnToReview) {
                        setReturnToReview(false);
                        goToStep(TOTAL_STEPS);
                        return;
                      }
                      goToStep(step - 1);
                    }}
                    className="inline-flex min-h-11 items-center gap-2 -ml-2 px-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>
                ) : alreadyComplete ? (
                  <Link
                    to="/patient/dashboard"
                    className="inline-flex min-h-11 items-center gap-2 -ml-2 px-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back to Dashboard</span>
                  </Link>
                ) : null}
              </div>
              <span className="shrink-0 text-xs font-semibold text-tertiary tabular-nums">
                Step {step} of {TOTAL_STEPS}
              </span>
            </header>

            {/* Thin 2px Progress Line */}
            <div
              role="progressbar"
              aria-valuemin={1}
              aria-valuemax={TOTAL_STEPS}
              aria-valuenow={step}
              aria-label={`Step ${step} of ${TOTAL_STEPS}`}
              className="w-full h-0.5 bg-slate-200/70 dark:bg-slate-800 overflow-hidden"
            >
              <motion.div
                className="h-full bg-primary"
                initial={{ width: `${100 / TOTAL_STEPS}%` }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.4, ease: FLUID }}
              />
            </div>
          </div>

          {/* Center Stage: Focused Single-Screen Step Content */}
          <main
            ref={mainRef}
            tabIndex={-1}
            aria-labelledby={`onboard-step-${step}-heading`}
            className="mc-step-region flex-1 flex flex-col justify-start px-6 sm:px-12 lg:px-14 xl:px-20 pt-8 sm:pt-10 pb-6 max-w-xl mx-auto w-full outline-none"
          >
            {loadError && (
              <div
                role="alert"
                className="mb-5 flex flex-col gap-2 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 dark:border-warning-dark/30 dark:bg-warning-darkSoft"
              >
                <p className="text-sm font-medium text-warning dark:text-warning-dark">
                  We could not load your saved details. You can keep filling the form, or try again.
                </p>
                <button
                  type="button"
                  onClick={() => setReloadToken((token) => token + 1)}
                  className={`${smallActionClass} self-start -ml-2 text-warning dark:text-warning-dark`}
                >
                  Try again
                </button>
              </div>
            )}

            <AnimatePresence mode="wait" custom={direction}>
              {/* STEP 1: CONTACT & CARE CIRCLE */}
              {step === 1 && (
                <motion.div
                  key="step-1"
                  custom={direction}
                  variants={stepMotion}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  onAnimationComplete={focusStepRegion}
                  className="space-y-6"
                >
                  <div className="space-y-1.5">
                    <h1
                      id="onboard-step-1-heading"
                      className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white"
                    >
                      How can providers reach you?
                    </h1>
                    <p className="text-sm text-tertiary dark:text-tertiary leading-relaxed">
                      Used for visit coordination and emergencies. Only providers you book can see
                      these numbers.
                    </p>
                  </div>

                  <div className="space-y-4 pt-2">
                    <div className="space-y-1.5">
                      <label htmlFor="onboard-phone" className={labelClass}>
                        Your mobile number
                      </label>
                      <input
                        id="onboard-phone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        required
                        aria-required="true"
                        aria-invalid={Boolean(errors.phone)}
                        aria-describedby={
                          errors.phone ? 'onboard-phone-help onboard-phone-error' : 'onboard-phone-help'
                        }
                        value={phone}
                        onChange={(e) => {
                          setPhone(e.target.value);
                          clearError('phone');
                        }}
                        onBlur={() => {
                          if (isValidPhPhone(phone)) setPhone(normalizePhPhone(phone));
                        }}
                        placeholder="0917 123 4567"
                        className={inputClass}
                      />
                      <p id="onboard-phone-help" className="text-sm text-tertiary dark:text-tertiary">
                        PH mobile (09…) or landline (02…). We only use this for visit coordination.
                      </p>
                      {errors.phone && (
                        <p id="onboard-phone-error" className={errorClass}>
                          {errors.phone}
                        </p>
                      )}
                    </div>

                    <div className="border-t border-surface-border" />

                    <fieldset className="space-y-4">
                      <legend className="text-xs font-semibold uppercase tracking-wider text-tertiary">
                        Primary emergency contact
                      </legend>

                      <div className="space-y-1.5">
                        <label htmlFor="onboard-emergency-name" className={labelClass}>
                          Contact name
                        </label>
                        <input
                          id="onboard-emergency-name"
                          type="text"
                          autoComplete="name"
                          required
                          aria-required="true"
                          aria-invalid={Boolean(errors.emergencyContactName)}
                          aria-describedby={
                            errors.emergencyContactName ? 'onboard-emergency-name-error' : undefined
                          }
                          value={emergencyContactName}
                          onChange={(e) => {
                            setEmergencyContactName(e.target.value);
                            clearError('emergencyContactName');
                          }}
                          placeholder="Family member or guardian"
                          className={inputClass}
                        />
                        {errors.emergencyContactName && (
                          <p id="onboard-emergency-name-error" className={errorClass}>
                            {errors.emergencyContactName}
                          </p>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <label htmlFor="onboard-emergency-phone" className={labelClass}>
                          Contact mobile number
                        </label>
                        <input
                          id="onboard-emergency-phone"
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          required
                          aria-required="true"
                          aria-invalid={Boolean(errors.emergencyContactPhone)}
                          aria-describedby={
                            errors.emergencyContactPhone ? 'onboard-emergency-phone-error' : undefined
                          }
                          value={emergencyContactPhone}
                          onChange={(e) => {
                            setEmergencyContactPhone(e.target.value);
                            clearError('emergencyContactPhone');
                          }}
                          onBlur={() => {
                            if (isValidPhPhone(emergencyContactPhone)) {
                              setEmergencyContactPhone(normalizePhPhone(emergencyContactPhone));
                            }
                          }}
                          placeholder="0918 765 4321"
                          className={inputClass}
                        />
                        {errors.emergencyContactPhone && (
                          <p id="onboard-emergency-phone-error" className={errorClass}>
                            {errors.emergencyContactPhone}
                          </p>
                        )}
                      </div>
                    </fieldset>
                  </div>

                </motion.div>
              )}

              {/* STEP 2: PIN LOCATION ON MAP */}
              {step === 2 && (
                <motion.div
                  key="step-2"
                  custom={direction}
                  variants={stepMotion}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  onAnimationComplete={focusStepRegion}
                  className="space-y-4"
                >
                  <div className="space-y-1.5">
                    <h1
                      id="onboard-step-2-heading"
                      className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white"
                    >
                      Pin your home entrance
                    </h1>
                    <p className="text-sm text-tertiary dark:text-tertiary leading-relaxed">
                      Search your street, or drag the map until the pin sits exactly on the door providers
                      should reach.
                    </p>
                  </div>

                  <div className="space-y-3 pt-1">
                    <AddressAutocomplete
                      onSelect={handleAutocompleteSelect}
                      initialQuery={baseAddress}
                    />

                    <Suspense
                      fallback={
                        <div className="h-[260px] sm:h-[300px] w-full animate-pulse rounded-2xl bg-surface-subtle" />
                      }
                    >
                      <ModernLocationPicker
                        ref={pickerRef}
                        initial={coords}
                        onPinChange={handlePinChange}
                        className="h-[260px] sm:h-[300px]"
                      />
                    </Suspense>

                    <div className="flex items-start gap-2.5 pt-1">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-link" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                          {baseAddress ||
                            (coords ? 'Pin placed on the map' : 'Move the map to select your street')}
                        </p>
                        {coords && pinStatus !== 'resolved' && (
                          <p className="mt-0.5 text-xs text-tertiary">
                            {pinStatus === 'pending'
                              ? 'Looking up this address…'
                              : 'Address lookup unavailable. You can type the street in the next step.'}
                          </p>
                        )}
                      </div>
                    </div>

                    {errors.coords && (
                      <p id="onboard-location-error" className={errorClass}>
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
                  variants={stepMotion}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  onAnimationComplete={focusStepRegion}
                  className="space-y-6"
                >
                  <div className="space-y-1.5">
                    <h1
                      id="onboard-step-3-heading"
                      className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white"
                    >
                      Add address details
                    </h1>
                    <p className="text-sm text-tertiary dark:text-tertiary leading-relaxed">
                      Saved to your profile so future home visits go to the right door.
                    </p>
                  </div>

                  <div className="space-y-4 pt-1">
                    <div className="flex items-center justify-between gap-3 border-b border-surface-border pb-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-tertiary">Pinned location</p>
                        <p className="mt-0.5 truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                          {baseAddress || 'Location pinned on map'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => goToStep(2)}
                        className={`${smallActionClass} -mr-2 shrink-0`}
                      >
                        Adjust pin
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="onboard-street" className={labelClass}>
                        Street &amp; barangay
                      </label>
                      <input
                        id="onboard-street"
                        type="text"
                        required
                        aria-required="true"
                        aria-invalid={Boolean(errors.street)}
                        aria-describedby={errors.street ? 'onboard-street-error' : undefined}
                        value={baseAddress}
                        onChange={(e) => {
                          setBaseAddress(e.target.value);
                          clearError('street');
                        }}
                        placeholder="e.g. Sampaguita St., Brgy. Tunasan, Muntinlupa City"
                        className={inputClass}
                      />
                      {errors.street && (
                        <p id="onboard-street-error" className={errorClass}>
                          {errors.street}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="space-y-1.5">
                        <label htmlFor="onboard-unit" className={labelClass}>
                          House / unit / lot no.
                        </label>
                        <input
                          id="onboard-unit"
                          type="text"
                          value={unitFloor}
                          onChange={(e) => setUnitFloor(e.target.value)}
                          placeholder="e.g. Block 14 Lot 8"
                          className={inputClass}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label htmlFor="onboard-subdivision" className={labelClass}>
                          Subdivision or village
                        </label>
                        <input
                          id="onboard-subdivision"
                          type="text"
                          value={subdivisionGate}
                          onChange={(e) => setSubdivisionGate(e.target.value)}
                          placeholder="e.g. Victoria Homes"
                          className={inputClass}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="onboard-instructions" className={labelClass}>
                        Gate or landmark notes (optional)
                      </label>
                      <textarea
                        id="onboard-instructions"
                        rows={2}
                        value={arrivalInstructions}
                        onChange={(e) => setArrivalInstructions(e.target.value)}
                        placeholder="e.g. White gate near the chapel, ring doorbell on the right"
                        className={textareaClass}
                      />
                    </div>

                    <div className="border-t border-surface-border" />

                    <fieldset className="space-y-2">
                      <legend className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Access needs at home
                        <span className="ml-1.5 font-normal text-tertiary">
                          Optional · helps providers prepare
                        </span>
                      </legend>
                      <div className="flex flex-wrap gap-2">
                        {ACCESS_NEEDS.map((option) => {
                          const selected = accessNeeds.includes(option.value);
                          return (
                            <button
                              key={option.value}
                              type="button"
                              aria-pressed={selected}
                              onClick={() => setAccessNeeds((current) => toggleAccessNeed(current, option.value))}
                              className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold transition-colors cursor-pointer ${
                                selected
                                  ? 'bg-primary text-white shadow-sm'
                                  : 'neu-flat-sm text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white'
                              }`}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    </fieldset>
                  </div>
                </motion.div>
              )}

              {/* STEP 4: HEALTH BASICS (OPTIONAL) */}
              {step === 4 && (
                <motion.div
                  key="step-4"
                  custom={direction}
                  variants={stepMotion}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  onAnimationComplete={focusStepRegion}
                  className="space-y-6"
                >
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-widest text-link">
                      Optional
                    </p>
                    <h1
                      id="onboard-step-4-heading"
                      className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white"
                    >
                      Health basics
                    </h1>
                    <p className="text-sm text-tertiary dark:text-tertiary leading-relaxed">
                      Helps your care provider prepare before arriving. Skip anything you would rather discuss
                      in person — you can update this anytime.
                    </p>
                  </div>

                  <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="space-y-1.5">
                        <label htmlFor="onboard-dob" className={labelClass}>
                          Date of birth
                        </label>
                        <input
                          id="onboard-dob"
                          type="date"
                          autoComplete="bday"
                          max={new Date().toISOString().slice(0, 10)}
                          value={dateOfBirth}
                          onChange={(e) => {
                            setDateOfBirth(e.target.value);
                            clearError('consent');
                          }}
                          className={inputClass}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label htmlFor="onboard-blood-type" className={labelClass}>
                          Blood type
                        </label>
                        <select
                          id="onboard-blood-type"
                          value={bloodType}
                          onChange={(e) => {
                            setBloodType(e.target.value);
                            clearError('consent');
                          }}
                          className={`${inputClass} cursor-pointer`}
                        >
                          <option value="">Not sure</option>
                          {BLOOD_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="onboard-allergies" className={labelClass}>
                        Known allergies
                      </label>
                      <input
                        id="onboard-allergies"
                        type="text"
                        value={allergies}
                        onChange={(e) => {
                          setAllergies(e.target.value);
                          clearError('consent');
                        }}
                        placeholder="e.g. Penicillin, Aspirin, or leave blank"
                        className={inputClass}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="onboard-conditions" className={labelClass}>
                        Chronic conditions
                      </label>
                      <input
                        id="onboard-conditions"
                        type="text"
                        value={chronicConditions}
                        onChange={(e) => {
                          setChronicConditions(e.target.value);
                          clearError('consent');
                        }}
                        placeholder="e.g. Hypertension, Type 2 diabetes"
                        className={inputClass}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="onboard-medications" className={labelClass}>
                        Current medications
                      </label>
                      <input
                        id="onboard-medications"
                        type="text"
                        value={medications}
                        onChange={(e) => {
                          setMedications(e.target.value);
                          clearError('consent');
                        }}
                        placeholder="e.g. Amlodipine 5mg once daily"
                        className={inputClass}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="onboard-history" className={labelClass}>
                        Medical or mobility notes
                      </label>
                      <textarea
                        id="onboard-history"
                        rows={3}
                        value={medicalHistory}
                        onChange={(e) => {
                          setMedicalHistory(e.target.value);
                          clearError('consent');
                        }}
                        placeholder="e.g. Post-stroke recovery, needs wheelchair assistance"
                        className={textareaClass}
                      />
                    </div>

                    <div className="space-y-2.5 rounded-xl border border-surface-border bg-surface-subtle p-3.5">
                      <label htmlFor="onboard-consent" className="flex items-start gap-3 cursor-pointer">
                        <input
                          id="onboard-consent"
                          type="checkbox"
                          checked={privacyConsent}
                          onChange={(e) => {
                            setPrivacyConsent(e.target.checked);
                            clearError('consent');
                          }}
                          aria-invalid={Boolean(errors.consent)}
                          aria-describedby={errors.consent ? 'onboard-consent-error' : undefined}
                          className="mt-0.5 h-5 w-5 shrink-0 rounded border-field accent-[var(--primary)]"
                        />
                        <span className="text-sm font-medium leading-relaxed text-slate-700 dark:text-slate-300">
                          I agree to MuntiCares storing these medical details. Only providers I approve during a
                          visit can see them, and I can change this anytime in Privacy &amp; Consent.
                        </span>
                      </label>
                      {errors.consent && (
                        <p id="onboard-consent-error" className={errorClass}>
                          {errors.consent}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* STEP 5: PRIVACY & REVIEW */}
              {step === 5 && (
                <motion.div
                  key="step-5"
                  custom={direction}
                  variants={stepMotion}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  onAnimationComplete={focusStepRegion}
                  className="space-y-6"
                >
                  <div className="space-y-1.5">
                    <h1
                      id="onboard-step-5-heading"
                      className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white"
                    >
                      Check your details
                    </h1>
                    <p className="text-sm text-tertiary dark:text-tertiary leading-relaxed">
                      This is what your care provider will see and use on the day of the visit.
                    </p>
                  </div>

                  <div className="space-y-3 pt-1">
                    <div className="space-y-1.5">
                      <label htmlFor="onboard-name" className={labelClass}>
                        Name providers will use
                      </label>
                      <input
                        id="onboard-name"
                        type="text"
                        autoComplete="name"
                        required={!isPreview}
                        aria-required={!isPreview}
                        aria-invalid={Boolean(errors.fullName)}
                        aria-describedby={errors.fullName ? 'onboard-name-error' : 'onboard-name-help'}
                        value={fullName}
                        onChange={(e) => {
                          setFullName(e.target.value);
                          clearError('fullName');
                        }}
                        placeholder="e.g. Maria Santos"
                        className={inputClass}
                      />
                      <p id="onboard-name-help" className="text-sm text-tertiary dark:text-tertiary">
                        Changing this also updates your account name.
                      </p>
                      {errors.fullName && (
                        <p id="onboard-name-error" className={errorClass}>
                          {errors.fullName}
                        </p>
                      )}
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-surface-border divide-y divide-surface-border">
                      <ReviewRow
                        label="Mobile number"
                        value={phone || 'Not added'}
                        onEdit={() => editFromReview(1)}
                        error={errors.phone}
                      />

                      <ReviewRow
                        label="Emergency contact"
                        value={emergencySummary}
                        onEdit={() => editFromReview(1)}
                        error={errors.emergencyContactPhone}
                      />

                      <ReviewRow
                        label="Home address"
                        value={addressSummary}
                        onEdit={() => editFromReview(3)}
                        error={errors.street || errors.coords}
                      >
                        {coords && (
                          <div className="mt-2 overflow-hidden rounded-xl border border-surface-border">
                            <Suspense fallback={<div className="h-[160px] w-full bg-surface-subtle" />}>
                              <ModernLocationPicker
                                readOnly
                                initial={coords}
                                className="h-[160px]"
                              />
                            </Suspense>
                          </div>
                        )}
                      </ReviewRow>

                      <ReviewRow
                        label="Gate & landmark notes"
                        value={arrivalInstructions.trim() || 'None added'}
                        onEdit={() => editFromReview(3)}
                      />

                      <ReviewRow
                        label="Access needs"
                        value={accessSummary}
                        onEdit={() => editFromReview(3)}
                      />

                      <div className="px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-xs font-semibold text-tertiary">Health basics</p>
                          <button
                            type="button"
                            onClick={() => editFromReview(4)}
                            aria-label="Edit health basics"
                            className={`${smallActionClass} -mr-2 shrink-0`}
                          >
                            Edit
                          </button>
                        </div>
                        {healthItems.length ? (
                          <dl className="mt-2 space-y-1.5">
                            {healthItems.map((item) => (
                              <div key={item.label} className="flex gap-2 text-sm">
                                <dt className="w-28 shrink-0 font-medium text-tertiary">{item.label}</dt>
                                <dd className="min-w-0 flex-1 font-medium text-slate-800 dark:text-slate-100 break-words">
                                  {item.value}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        ) : (
                          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                            {omitMedical
                              ? 'Skipped. Nothing will be saved.'
                              : 'Nothing added. Nothing will be saved.'}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-surface-border bg-surface-subtle px-4 py-3">
                      <p className="text-sm font-medium leading-relaxed text-slate-700 dark:text-slate-300">
                        {omitMedical || !healthItems.length ? (
                          <>
                            <span className="font-bold text-slate-900 dark:text-white">
                              No medical details will be saved.
                            </span>{' '}
                            You can add them later from your profile whenever you need to.
                          </>
                        ) : privacyConsent ? (
                          <>
                            <span className="font-bold text-slate-900 dark:text-white">You consented to storing these details.</span>{' '}
                            They are encrypted at rest and shown only to providers you approve during a visit. You
                            can revoke this in Privacy &amp; Consent.
                          </>
                        ) : (
                          <>
                            <span className="font-bold text-slate-900 dark:text-white">No medical details will be saved</span>{' '}
                            because consent is unchecked. You can add them later from your profile.
                          </>
                        )}
                      </p>
                      {errors.consent && <p className={`mt-1.5 ${errorClass}`}>{errors.consent}</p>}
                    </div>

                    {isPreview && (
                      <p className="text-sm text-tertiary dark:text-tertiary">
                        This is a preview — nothing is saved.
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </main>

          {/* Pinned Bottom Action Bar */}
          <footer className="onboarding-footer sticky bottom-0 z-20 w-full border-t border-surface-border bg-surface-page px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-3 sm:px-12 lg:px-14 xl:px-20">
            <div className="mx-auto flex w-full max-w-xl flex-col gap-2">
              <motion.button
                type="submit"
                disabled={isContinueDisabled}
                whileTap={!isContinueDisabled && !reduceMotion ? { scale: 0.99 } : {}}
                className="neu-btn-primary flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-bold shadow-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
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
                  <span>Complete setup</span>
                )}
              </motion.button>

              {step === 4 && !returnToReview && (
                <button
                  type="button"
                  onClick={() => {
                    setOmitMedical(true);
                    goToStep(TOTAL_STEPS);
                  }}
                  disabled={saving}
                  className="inline-flex min-h-11 w-full items-center justify-center text-sm font-semibold text-tertiary transition-colors hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                >
                  Skip health details
                </button>
              )}
            </div>
          </footer>
        </form>
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
            className="h-full w-full object-cover opacity-45 contrast-105 saturate-110 dark:grayscale dark:mix-blend-luminosity dark:opacity-90 dark:contrast-125"
          />
        </div>
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-white/90 via-white/80 to-white/95 dark:from-slate-950/92 dark:via-slate-950/85 dark:to-slate-900" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(2,6,23,0.08)_75%)] dark:bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(2,6,23,0.55)_75%)]" />

        {/* Top Brand Wordmark */}
        <div className="relative z-10 flex items-center gap-2.5">
          <div className="neu-flat-sm p-2 rounded-xl">
            <Heart size={20} weight="fill" className="text-link fill-primary" />
          </div>
          <span className="font-display text-xl font-black text-link tracking-tight">
            MuntiCares
          </span>
        </div>

        {/* Center Hero Typography */}
        <div className="relative z-10 my-auto max-w-lg space-y-6">
          <h2 className="font-display text-4xl xl:text-5xl font-semibold text-slate-900 dark:text-white tracking-tight leading-[1.12]">
            Quality home care{' '}
            <br />
            right at your{' '}
            <span className="text-primary dark:text-primary-400">doorstep</span>
          </h2>

          <p className="text-base xl:text-lg font-medium text-slate-700 dark:text-slate-200 leading-relaxed dark:drop-shadow-[0_2px_12px_rgba(0,0,0,0.55)]">
            Connecting Muntinlupa City residents with trusted, verified home care providers — fast, secure, and patient-first.
          </p>
        </div>

        {/* Bottom Subtle Caption */}
        <div className="relative z-10 text-xs font-medium text-tertiary dark:text-tertiary">
          <span>Muntinlupa City Home Care Network</span>
        </div>
      </aside>
    </div>
  );
}
