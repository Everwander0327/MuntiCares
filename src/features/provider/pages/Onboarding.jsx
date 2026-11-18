import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  MapPin,
  FileText,
  UploadSimple,
  Check,
  ShieldCheck,
  Clock,
} from '@phosphor-icons/react';
import { toast } from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import { IMAGES } from '@/lib/images';
import { Button } from '@/shared/ui/button';
import { SkeletonText } from '@/shared/ui/skeleton';
import { BrandLogo } from '@/shared/ui';
import AddressAutocomplete from '@/features/tracking/components/AddressAutocomplete';
import BasemapControl from '@/features/tracking/components/BasemapControl';
import { isValidPhPhone, normalizePhPhone } from '@/features/patient/utils/phone';
import { isMissingColumnError } from '@/features/patient/utils/patientProfile';
import {
  TOTAL_STEPS,
  SUGGESTED_SERVICES,
  SERVICE_RADIUS_PRESETS,
  getProviderDraftKey,
  getProviderDeferredKey,
  parseStepParam,
  parseServiceList,
  hasServiceItem,
  toggleServiceItem,
  buildProviderOnboardingDraft,
  loadProviderOnboardingDraft,
  clearProviderOnboardingDraft,
  validateIdFile,
  validateProviderStep,
} from '@/features/provider/lib/providerOnboarding';

const ModernLocationPicker = lazy(() =>
  import('@/features/tracking/components/ModernLocationPicker')
);

const FLUID = [0.32, 0.72, 0, 1];

const inputClass =
  'w-full min-h-[48px] neu-inset neu-input rounded-xl border border-field px-4 py-3 text-base sm:text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-tertiary outline-none transition-all';
const textareaClass = `${inputClass} resize-none`;
const labelClass =
  'block text-[max(0.75rem,12px)] font-semibold text-slate-700 dark:text-slate-300';
const errorClass = 'text-sm font-medium text-danger dark:text-danger-dark';
const smallActionClass =
  'inline-flex min-h-[44px] items-center px-2.5 text-[max(0.875rem,14px)] font-semibold text-link hover:underline cursor-pointer';

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
  enter: { opacity: 0 },
  center: { opacity: 1, transition: { duration: 0.01 } },
  exit: { opacity: 0, transition: { duration: 0.01 } },
};

const FIELD_IDS = {
  fullName: 'provider-onboard-name',
  phone: 'provider-onboard-phone',
  bio: 'provider-onboard-bio',
  serviceRadiusKm: 'provider-onboard-radius',
  licenseNumber: 'provider-onboard-license',
  idFile: 'provider-onboard-id-file',
  consent: 'provider-onboard-consent',
};

const sanitizeFileName = (name = 'id-document') =>
  name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);

export default function ProviderOnboarding({ isPreview = false }) {
  const { user, updateUser } = useAuth();
  const { t, translateService } = useLanguage();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const reduceMotion = useReducedMotion();
  const pickerRef = useRef(null);
  const mainRef = useRef(null);
  const [step2TopEl, setStep2TopEl] = useState(null);
  const [step2BottomEl, setStep2BottomEl] = useState(null);
  const fileInputRef = useRef(null);

  const draft = useMemo(
    () => loadProviderOnboardingDraft(user?.id),
    [user?.id]
  );

  const initialStep = parseStepParam(searchParams.get('step'));
  const [step, setStep] = useState(initialStep);
  const [direction, setDirection] = useState(1);
  const [saving, setSaving] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(!isPreview);
  const [loadError, setLoadError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [saveError, setSaveError] = useState('');
  const [errors, setErrors] = useState({});
  const [errorAnnouncement, setErrorAnnouncement] = useState('');
  const [returnToReview, setReturnToReview] = useState(false);

  // Step 1: Identity, Contact & Clinical Bio (no language spoken field)
  const [fullName, setFullName] = useState(draft?.fullName ?? user?.full_name ?? '');
  const [phone, setPhone] = useState(draft?.phone ?? '');
  const [bio, setBio] = useState(draft?.bio ?? '');

  // Step 2: Dispatch Base Map & Coverage Radius
  const [coords, setCoords] = useState(draft?.coords ?? null);
  const [pinStatus, setPinStatus] = useState(draft?.coords ? 'resolved' : 'idle');
  const [baseAddress, setBaseAddress] = useState(draft?.baseAddress ?? '');
  const [serviceRadiusKm, setServiceRadiusKm] = useState(draft?.serviceRadiusKm ?? 10);
  const [step2Basemap, setStep2Basemap] = useState('streets');
  const [step2HudInsets, setStep2HudInsets] = useState({ top: 68, bottom: 260 });

  // Step 3: Services
  const [selectedServices, setSelectedServices] = useState(
    () => (Array.isArray(draft?.services) ? draft.services : [])
  );
  const [customServicesInput, setCustomServicesInput] = useState('');

  // Step 4: PRC Credentials & ID Upload
  const [licenseNumber, setLicenseNumber] = useState(draft?.licenseNumber ?? '');
  const [licenseExpiry, setLicenseExpiry] = useState(draft?.licenseExpiry ?? '');
  const [idFile, setIdFile] = useState(null);
  const [existingIdPaths, setExistingIdPaths] = useState(
    () => (Array.isArray(draft?.existingIdPaths) ? draft.existingIdPaths : [])
  );

  // Step 5: Privacy & Consent
  const [privacyConsent, setPrivacyConsent] = useState(Boolean(draft?.privacyConsent));

  const combinedServices = useMemo(() => {
    const custom = parseServiceList(customServicesInput);
    const merged = [...selectedServices];
    custom.forEach((item) => {
      if (!hasServiceItem(merged, item)) merged.push(item);
    });
    return merged;
  }, [selectedServices, customServicesInput]);

  // Measure Step 2 top/bottom controls so map HUD & centered pin sit in clear canvas
  useEffect(() => {
    if (step !== 2 || typeof ResizeObserver === 'undefined') return undefined;
    const update = () => {
      const topH = Math.round(step2TopEl?.getBoundingClientRect().height || 0);
      const bottomH = Math.round(step2BottomEl?.getBoundingClientRect().height || 0);
      if (!topH && !bottomH) return;
      setStep2HudInsets((prev) =>
        prev.top === topH && prev.bottom === bottomH ? prev : { top: topH, bottom: bottomH }
      );
    };
    const ro = new ResizeObserver(update);
    const observeBox = (el) => {
      if (!el) return;
      try {
        ro.observe(el, { box: 'border-box' });
      } catch {
        ro.observe(el);
      }
    };
    observeBox(step2TopEl);
    observeBox(step2BottomEl);
    update();
    return () => ro.disconnect();
  }, [step, step2TopEl, step2BottomEl, loadError, errors.coords, errors.serviceRadiusKm, baseAddress, pinStatus]);

  // Sync URL ?step=N
  useEffect(() => {
    const raw = searchParams.get('step');
    if (!raw) return;
    const nextFromUrl = parseStepParam(raw);
    if (nextFromUrl !== step) {
      setDirection(nextFromUrl > step ? 1 : -1);
      setStep(nextFromUrl);
      setErrors({});
      setErrorAnnouncement('');
      setSaveError('');
    }
  }, [searchParams, step]);

  useEffect(() => {
    if (draft) toast(t('provider.onboarding.restoredDraftToast'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hydrate existing provider data when signed in
  useEffect(() => {
    if (isPreview || !user?.id) {
      setLoadingProfile(false);
      return undefined;
    }

    let cancelled = false;
    setLoadingProfile(true);
    setLoadError(false);

    (async () => {
      try {
        const [{ data: provData, error: provError }, { data: userData }] = await Promise.all([
          supabase.from('providers').select('*').eq('user_id', user.id).maybeSingle(),
          supabase.from('users').select('full_name').eq('id', user.id).maybeSingle(),
        ]);

        if (provError) throw provError;
        if (cancelled) return;

        if (!draft) {
          const resolvedName = userData?.full_name || user?.full_name || '';
          if (resolvedName) setFullName((prev) => prev || resolvedName);
          if (provData) {
            if (provData.phone) setPhone(provData.phone);
            if (provData.bio) setBio(provData.bio);
            if (provData.location && provData.location !== 'Muntinlupa City') {
              setBaseAddress(provData.location);
            }
            if (
              Number.isFinite(Number(provData.base_lat)) &&
              Number.isFinite(Number(provData.base_lng))
            ) {
              setCoords({
                lat: Number(provData.base_lat),
                lng: Number(provData.base_lng),
              });
              setPinStatus('resolved');
            }
            if (provData.service_radius_km) {
              setServiceRadiusKm(Number(provData.service_radius_km));
            }
            if (Array.isArray(provData.services) && provData.services.length > 0) {
              setSelectedServices(provData.services);
            }
            if (provData.license_number) setLicenseNumber(provData.license_number);
            if (provData.license_expiry) {
              setLicenseExpiry(String(provData.license_expiry).slice(0, 10));
            }
            const storedPaths =
              Array.isArray(provData.professional_id_paths) && provData.professional_id_paths.length > 0
                ? provData.professional_id_paths
                : provData.professional_id_path
                  ? [provData.professional_id_path]
                  : [];
            if (storedPaths.length > 0) setExistingIdPaths(storedPaths);
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[provider-onboarding] Failed to load profile:', err);
          setLoadError(true);
        }
      } finally {
        if (!cancelled) setLoadingProfile(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPreview, user?.id, reloadToken]);

  // Persist localStorage draft automatically
  useEffect(() => {
    if (loadingProfile) return;
    const key = getProviderDraftKey(user?.id);
    const payload = buildProviderOnboardingDraft({
      fullName,
      phone,
      bio,
      coords,
      baseAddress,
      serviceRadiusKm,
      services: combinedServices,
      licenseNumber,
      licenseExpiry,
      existingIdPaths,
      privacyConsent,
    });
    try {
      if (!payload) {
        window.localStorage.removeItem(key);
        return;
      }
      window.localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data: payload }));
    } catch {
      // Storage unavailable.
    }
  }, [
    loadingProfile,
    user?.id,
    fullName,
    phone,
    bio,
    coords,
    baseAddress,
    serviceRadiusKm,
    combinedServices,
    licenseNumber,
    licenseExpiry,
    existingIdPaths,
    privacyConsent,
  ]);

  const progressPercent = (step / TOTAL_STEPS) * 100;
  const isMapStep = step === 2;
  const stepMotion = reduceMotion ? reducedStepVariants : stepVariants;

  const focusStepRegion = () => {
    mainRef.current?.focus({ preventScroll: true });
  };

  const goToStep = (nextStep, { editFromReview = false } = {}) => {
    const clamped = Math.min(TOTAL_STEPS, Math.max(1, nextStep));
    setDirection(clamped > step ? 1 : -1);
    setStep(clamped);
    setErrors({});
    setErrorAnnouncement('');
    setSaveError('');
    setReturnToReview(editFromReview);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('step', String(clamped));
    setSearchParams(nextParams, { replace: false });
  };

  const clearError = (key) => {
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handlePinChange = ({ lat, lng, address, status }) => {
    setCoords({ lat, lng });
    if (status) setPinStatus(status);
    if (address) {
      setBaseAddress(address);
      clearError('coords');
    } else if (status === 'idle') {
      setPinStatus('resolved');
      clearError('coords');
    }
  };

  const handleAutocompleteSelect = ({ lat, lng, label }) => {
    setCoords({ lat, lng });
    setPinStatus('resolved');
    setBaseAddress(label);
    clearError('coords');
    pickerRef.current?.flyTo?.(lat, lng);
  };

  const handleIdFileChange = (event) => {
    const picked = event.target.files?.[0] || null;
    if (!picked) return;
    const fileErr = validateIdFile(picked, t);
    if (fileErr) {
      setErrors((prev) => ({ ...prev, idFile: fileErr }));
      setErrorAnnouncement(fileErr);
      event.target.value = '';
      return;
    }
    setIdFile(picked);
    clearError('idFile');
    setErrorAnnouncement('');
  };

  const handleFinishLater = () => {
    if (!isPreview && user?.id) {
      try {
        window.sessionStorage.setItem(getProviderDeferredKey(user.id), '1');
      } catch {
        // Ignore sessionStorage errors.
      }
      navigate('/provider/dashboard', { replace: true });
      return;
    }
    navigate('/');
  };

  const handleSubmitVerification = async () => {
    const stepErrors = validateProviderStep(5, { privacyConsent }, t, { isPreview });
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      setErrorAnnouncement(Object.values(stepErrors).join(' '));
      document.getElementById(FIELD_IDS.consent)?.focus();
      return;
    }

    if (isPreview || !user?.id) {
      toast.success(t('provider.onboarding.previewCompletedToast'));
      clearProviderOnboardingDraft(user?.id);
      navigate('/register?role=provider');
      return;
    }

    setSaving(true);
    setSaveError('');
    try {
      let uploadedPaths = [...existingIdPaths];
      if (idFile) {
        const storagePath = `${user.id}/${Date.now()}_${sanitizeFileName(idFile.name)}`;
        const { error: uploadErr } = await supabase.storage
          .from('provider-docs')
          .upload(storagePath, idFile, { upsert: false });
        if (uploadErr) throw uploadErr;
        uploadedPaths = [storagePath];
      }

      const trimmedName = fullName.trim();
      const formattedPhone = normalizePhPhone(phone);
      const resolvedLocation = baseAddress.trim() || 'Muntinlupa City';
      const normalizedRadius = Math.min(100, Math.max(1, Number(serviceRadiusKm) || 10));

      if (trimmedName) {
        const { error: userErr } = await supabase
          .from('users')
          .update({ full_name: trimmedName })
          .eq('id', user.id);
        if (userErr) throw userErr;
      }

      const fullPayload = {
        phone: formattedPhone,
        location: resolvedLocation,
        base_lat: coords?.lat ?? null,
        base_lng: coords?.lng ?? null,
        service_radius_km: normalizedRadius,
        bio: bio.trim(),
        services: combinedServices,
        license_number: licenseNumber.trim(),
        license_expiry: licenseExpiry || null,
        professional_id_paths: uploadedPaths,
        professional_id_path: uploadedPaths[0] || null,
        professional_id_status: 'pending',
        is_profile_complete: true,
      };

      let { error: provErr } = await supabase
        .from('providers')
        .update(fullPayload)
        .eq('user_id', user.id);

      // Compatibility fallback when base_lat/base_lng or credential columns are not yet applied.
      if (provErr && isMissingColumnError(provErr)) {
        const {
          base_lat: _baseLat,
          base_lng: _baseLng,
          ...withoutCoordsPayload
        } = fullPayload;
        ({ error: provErr } = await supabase
          .from('providers')
          .update(withoutCoordsPayload)
          .eq('user_id', user.id));
      }

      if (provErr) throw provErr;

      clearProviderOnboardingDraft(user.id);
      try {
        window.sessionStorage.removeItem(getProviderDeferredKey(user.id));
      } catch {
        // Ignore sessionStorage errors.
      }
      updateUser({ full_name: trimmedName || user.full_name });
      toast.success(t('provider.onboarding.submittedToast'));
      navigate('/provider/dashboard', { replace: true });
    } catch (err) {
      console.error('[provider-onboarding] Submit error:', err);
      const msg = err?.message || t('provider.profile.profileSaveFailed');
      setSaveError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleNext = (event) => {
    event.preventDefault();
    if (step === TOTAL_STEPS) {
      handleSubmitVerification();
      return;
    }

    const validation = validateProviderStep(
      step,
      {
        fullName,
        phone,
        bio,
        coords,
        baseAddress,
        serviceRadiusKm,
        services: combinedServices,
        licenseNumber,
        idFile,
        existingIdPaths,
      },
      t,
      { isPreview }
    );

    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      setErrorAnnouncement(Object.values(validation).join(' '));
      const firstKey = Object.keys(validation)[0];
      const fieldId = FIELD_IDS[firstKey];
      if (fieldId) document.getElementById(fieldId)?.focus();
      return;
    }

    setErrors({});
    setErrorAnnouncement('');

    if (returnToReview) {
      goToStep(TOTAL_STEPS);
      return;
    }
    goToStep(step + 1);
  };

  const handleBack = () => {
    if (returnToReview) {
      goToStep(TOTAL_STEPS);
      return;
    }
    if (step > 1) {
      goToStep(step - 1);
    } else {
      handleFinishLater();
    }
  };

  if (loadingProfile) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-surface-page px-6">
        <div className="w-full max-w-md space-y-4">
          <SkeletonText lines={4} />
        </div>
      </div>
    );
  }

  return (
    <div className="onboarding-shell min-h-[100dvh] grid grid-cols-1 lg:grid-cols-2 bg-surface-page dark:bg-surface-dark text-slate-900 dark:text-slate-100">
      <div className="sr-only" aria-live="assertive" role="status">
        {errorAnnouncement}
      </div>

      {/* FORM COLUMN (Right on Desktop) */}
      <div className="lg:order-2 flex flex-col min-h-[100dvh] lg:h-[100dvh] lg:overflow-y-auto relative">
        <form onSubmit={handleNext} noValidate className="flex-1 flex flex-col min-h-0">
          {/* Top Header */}
          <div className="sticky top-0 z-30 bg-surface-page/90 dark:bg-surface-dark/90 backdrop-blur-md">
            <header className="px-6 sm:px-10 py-3 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleBack}
                className="inline-flex min-h-[44px] items-center gap-1.5 px-2 -ml-2 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-link transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                <span>
                  {step === 1
                    ? t('provider.onboarding.exitToDashboard')
                    : t('provider.onboarding.backBtn')}
                </span>
              </button>

              <div className="flex items-center gap-2.5 text-[max(0.75rem,12px)] font-semibold text-tertiary">
                {isPreview && (
                  <span className="px-2 py-0.5 rounded-md bg-primary/10 text-link font-bold">
                    {t('provider.onboarding.previewModeBadge')}
                  </span>
                )}
                {step > 1 && (
                  <button
                    type="button"
                    onClick={handleFinishLater}
                    className="hidden sm:inline-flex min-h-[44px] items-center px-2 text-[max(0.75rem,12px)] font-semibold text-tertiary hover:text-link transition-colors cursor-pointer"
                  >
                    {t('provider.onboarding.exitToDashboard')}
                  </button>
                )}
                <span>
                  {t('provider.onboarding.stepCounter', {
                    step,
                    total: TOTAL_STEPS,
                  })}
                </span>
              </div>
            </header>

            <div
              role="progressbar"
              aria-valuemin={1}
              aria-valuemax={TOTAL_STEPS}
              aria-valuenow={step}
              aria-label={t('provider.onboarding.stepCounter', { step, total: TOTAL_STEPS })}
              className="w-full h-0.5 bg-slate-200/70 dark:bg-slate-800 overflow-hidden"
            >
              <motion.div
                className="h-full bg-primary"
                initial={reduceMotion ? false : { width: `${100 / TOTAL_STEPS}%` }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: reduceMotion ? 0 : 0.4, ease: FLUID }}
              />
            </div>
          </div>

          {/* Center Stage */}
          <main
            ref={mainRef}
            tabIndex={-1}
            aria-labelledby={`provider-onboard-step-${step}-heading`}
            className={
              isMapStep
                ? 'mc-step-region relative flex-1 min-h-0 flex flex-col w-full overflow-hidden outline-none'
                : 'mc-step-region flex-1 flex flex-col justify-start px-6 sm:px-12 lg:px-14 xl:px-20 pt-8 sm:pt-10 pb-6 max-w-xl mx-auto w-full outline-none'
            }
          >
            {loadError && !isMapStep && (
              <div
                role="alert"
                className="mb-5 flex flex-col gap-2 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 dark:border-warning-dark/30 dark:bg-warning-darkSoft"
              >
                <p className="text-sm font-medium text-warning dark:text-warning-dark">
                  {t('provider.onboarding.loadErrorBanner')}
                </p>
                <button
                  type="button"
                  onClick={() => setReloadToken((token) => token + 1)}
                  className={`${smallActionClass} self-start -ml-2 text-warning dark:text-warning-dark`}
                >
                  {t('patient.common.tryAgain')}
                </button>
              </div>
            )}

            <AnimatePresence mode="wait" custom={direction}>
              {/* STEP 1: IDENTITY, CONTACT & BIO (No language spoken field) */}
              {step === 1 && (
                <motion.div
                  key="provider-step-1"
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
                      id="provider-onboard-step-1-heading"
                      className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-balance text-slate-900 dark:text-white"
                    >
                      {t('provider.onboarding.step1Title')}
                    </h1>
                    <p className="text-sm text-tertiary leading-relaxed text-pretty">
                      {t('provider.onboarding.step1Subtitle')}
                    </p>
                  </div>

                  <div className="space-y-4 pt-2">
                    <div className="space-y-1.5">
                      <label htmlFor={FIELD_IDS.fullName} className={labelClass}>
                        {t('provider.onboarding.fullNameLabel')}
                      </label>
                      <input
                        id={FIELD_IDS.fullName}
                        type="text"
                        autoComplete="name"
                        required={!isPreview}
                        aria-required={!isPreview}
                        aria-invalid={Boolean(errors.fullName)}
                        value={fullName}
                        onChange={(e) => {
                          setFullName(e.target.value);
                          clearError('fullName');
                        }}
                        placeholder={t('provider.onboarding.fullNamePlaceholder')}
                        className={inputClass}
                      />
                      <p className="text-sm text-tertiary text-pretty">
                        {t('provider.onboarding.fullNameHelp')}
                      </p>
                      {errors.fullName && <p className={errorClass}>{errors.fullName}</p>}
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor={FIELD_IDS.phone} className={labelClass}>
                        {t('provider.onboarding.phoneLabel')}
                      </label>
                      <input
                        id={FIELD_IDS.phone}
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        required
                        aria-required="true"
                        aria-invalid={Boolean(errors.phone)}
                        value={phone}
                        onChange={(e) => {
                          setPhone(e.target.value);
                          clearError('phone');
                        }}
                        onBlur={() => {
                          if (isValidPhPhone(phone)) setPhone(normalizePhPhone(phone));
                        }}
                        placeholder={t('provider.onboarding.phonePlaceholder')}
                        className={inputClass}
                      />
                      <p className="text-sm text-tertiary text-pretty">
                        {t('provider.onboarding.phoneHelp')}
                      </p>
                      {errors.phone && <p className={errorClass}>{errors.phone}</p>}
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor={FIELD_IDS.bio} className={labelClass}>
                        {t('provider.onboarding.bioLabel')}
                      </label>
                      <textarea
                        id={FIELD_IDS.bio}
                        rows={3}
                        required
                        aria-required="true"
                        aria-invalid={Boolean(errors.bio)}
                        value={bio}
                        onChange={(e) => {
                          setBio(e.target.value);
                          clearError('bio');
                        }}
                        placeholder={t('provider.onboarding.bioPlaceholder')}
                        className={textareaClass}
                      />
                      <p className="text-sm text-tertiary text-pretty">
                        {t('provider.onboarding.bioHelp')}
                      </p>
                      {errors.bio && <p className={errorClass}>{errors.bio}</p>}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* STEP 2: FULL-BLEED MAP BACKGROUND WITH FLOATING SEARCH & FLUSH RADIUS DOCK */}
              {step === 2 && (
                <motion.div
                  key="provider-step-2"
                  custom={direction}
                  variants={stepMotion}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  onAnimationComplete={focusStepRegion}
                  className="relative flex-1 flex flex-col justify-between min-h-0 w-full h-full"
                >
                  <Suspense
                    fallback={
                      <div className="absolute inset-0 h-full w-full animate-pulse bg-surface-subtle" />
                    }
                  >
                    <ModernLocationPicker
                      ref={pickerRef}
                      initial={coords}
                      onPinChange={handlePinChange}
                      basemap={step2Basemap}
                      onBasemapChange={setStep2Basemap}
                      hideBasemapControl
                      fullBleed
                      hudInsets={step2HudInsets}
                      className="absolute inset-0 h-full w-full"
                    />
                  </Suspense>

                  {/* Unified Top Search + Satellite Bar */}
                  <div
                    ref={setStep2TopEl}
                    className="relative z-20 pointer-events-none px-4 pt-3 sm:px-8 sm:pt-4"
                  >
                    <div className="mx-auto w-full max-w-xl pointer-events-auto">
                      <div className="flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <label htmlFor="provider-onboard-address-search" className="sr-only">
                            {t('tracking.address.searchLabel')}
                          </label>
                          <AddressAutocomplete
                            id="provider-onboard-address-search"
                            onSelect={handleAutocompleteSelect}
                            inputWrapperClassName="bg-surface-shell/95 backdrop-blur-md shadow-softer border-surface-border"
                          />
                        </div>
                        <BasemapControl
                          value={step2Basemap}
                          onChange={setStep2Basemap}
                          variant="toggle"
                          className="min-h-[48px] shadow-softer shrink-0"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Unified Flush Bottom Sheet: Base Address, Coverage Radius & Continue */}
                  <div
                    ref={setStep2BottomEl}
                    className="onboarding-map-bottom-dock mt-auto relative z-20 w-full border-t border-surface-border bg-surface-shell/95 backdrop-blur-md shadow-softer px-4 pt-3.5 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-8 sm:pt-4 sm:pb-5"
                  >
                    <div className="mx-auto w-full max-w-xl space-y-3">
                      <div className="space-y-0.5">
                        <h1
                          id="provider-onboard-step-2-heading"
                          className="font-display text-lg sm:text-xl font-bold tracking-tight text-balance text-slate-900 dark:text-white"
                        >
                          {t('provider.onboarding.step2Title')}
                        </h1>
                        <p className="text-[max(0.75rem,12px)] sm:text-sm text-tertiary leading-snug text-pretty">
                          {t('provider.onboarding.step2Subtitle')}
                        </p>
                      </div>

                      <div className="border-t border-surface-border/75 pt-2.5 flex items-start gap-2.5">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-link" aria-hidden="true" />
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 break-words leading-snug">
                            {baseAddress ||
                              (coords
                                ? t('provider.onboarding.pinPlaced')
                                : t('provider.onboarding.moveMapPrompt'))}
                          </p>
                          <p className="text-[max(0.75rem,12px)] text-tertiary text-pretty">
                            {coords && pinStatus === 'pending'
                              ? t('provider.onboarding.pinLookupPending')
                              : coords && pinStatus === 'unavailable'
                                ? t('provider.onboarding.pinLookupUnavailable')
                                : t('provider.onboarding.mapKeyboardHint')}
                          </p>
                        </div>
                      </div>

                      {/* Service Radius Presets + Custom Input */}
                      <div className="border-t border-surface-border/75 pt-2.5 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[max(0.75rem,12px)] font-semibold text-slate-700 dark:text-slate-300">
                          {t('provider.onboarding.radiusLabel')}
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {SERVICE_RADIUS_PRESETS.map((km) => {
                            const selected = Number(serviceRadiusKm) === km;
                            return (
                              <button
                                key={km}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => {
                                  setServiceRadiusKm(km);
                                  clearError('serviceRadiusKm');
                                }}
                                className={`min-h-[44px] px-3 rounded-xl border text-[max(0.75rem,12px)] font-bold transition-colors cursor-pointer ${
                                  selected
                                    ? 'bg-primary text-white border-primary shadow-sm'
                                    : 'bg-surface-page/80 text-slate-700 dark:text-slate-200 border-surface-border hover:border-primary/40'
                                }`}
                              >
                                {km} km
                              </button>
                            );
                          })}
                          <div className="flex items-center gap-1">
                            <label htmlFor={FIELD_IDS.serviceRadiusKm} className="sr-only">
                              {t('provider.onboarding.radiusLabel')}
                            </label>
                            <input
                              id={FIELD_IDS.serviceRadiusKm}
                              type="number"
                              inputMode="numeric"
                              min={1}
                              max={100}
                              value={serviceRadiusKm}
                              onChange={(e) => {
                                setServiceRadiusKm(e.target.value);
                                clearError('serviceRadiusKm');
                              }}
                              placeholder={t('provider.onboarding.radiusCustomPlaceholder')}
                              className="w-16 min-h-[44px] neu-inset rounded-xl border border-field px-2.5 text-center text-sm font-bold text-slate-900 dark:text-slate-100 outline-none"
                            />
                            <span className="text-[max(0.75rem,12px)] font-bold text-tertiary">km</span>
                          </div>
                        </div>
                      </div>

                      {(errors.coords || errors.serviceRadiusKm) && (
                        <p className={errorClass}>
                          {errors.coords || errors.serviceRadiusKm}
                        </p>
                      )}

                      <Button
                        type="submit"
                        size="lg"
                        className="neu-btn-primary min-h-[48px] w-full font-bold gap-2 shadow-sm cursor-pointer"
                      >
                        <span>{t('provider.onboarding.continueBtn')}</span>
                        <ArrowRight className="w-4 h-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* STEP 3: CARE SERVICES & SPECIALIZATIONS */}
              {step === 3 && (
                <motion.div
                  key="provider-step-3"
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
                      id="provider-onboard-step-3-heading"
                      className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-balance text-slate-900 dark:text-white"
                    >
                      {t('provider.onboarding.step3Title')}
                    </h1>
                    <p className="text-sm text-tertiary leading-relaxed text-pretty">
                      {t('provider.onboarding.step3Subtitle')}
                    </p>
                  </div>

                  <div className="space-y-5 pt-2">
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className={labelClass}>
                          {t('provider.onboarding.servicesPresetLabel')}
                        </span>
                        <span className="text-xs font-semibold text-link">
                          {t('provider.onboarding.servicesSelectedCount', {
                            count: combinedServices.length,
                          })}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {SUGGESTED_SERVICES.map((service) => {
                          const active = hasServiceItem(selectedServices, service);
                          return (
                            <button
                              key={service}
                              type="button"
                              aria-pressed={active}
                              onClick={() => {
                                setSelectedServices((prev) => toggleServiceItem(prev, service));
                                clearError('services');
                              }}
                              className={`min-h-[44px] px-3.5 py-2 rounded-xl border text-sm font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                                active
                                  ? 'bg-primary text-white border-primary shadow-sm'
                                  : 'neu-btn border-surface-border text-slate-800 dark:text-slate-100'
                              }`}
                            >
                              {active && <Check className="w-4 h-4 shrink-0" aria-hidden="true" />}
                              <span>{translateService(service)}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="provider-onboard-custom-services" className={labelClass}>
                        {t('provider.onboarding.servicesCustomLabel')}
                      </label>
                      <input
                        id="provider-onboard-custom-services"
                        type="text"
                        value={customServicesInput}
                        onChange={(e) => {
                          setCustomServicesInput(e.target.value);
                          clearError('services');
                        }}
                        placeholder={t('provider.onboarding.servicesCustomPlaceholder')}
                        className={inputClass}
                      />
                    </div>

                    {errors.services && <p className={errorClass}>{errors.services}</p>}
                  </div>
                </motion.div>
              )}

              {/* STEP 4: PRC LICENSE & IDENTITY VERIFICATION UPLOAD */}
              {step === 4 && (
                <motion.div
                  key="provider-step-4"
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
                      id="provider-onboard-step-4-heading"
                      className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-balance text-slate-900 dark:text-white"
                    >
                      {t('provider.onboarding.step4Title')}
                    </h1>
                    <p className="text-sm text-tertiary leading-relaxed text-pretty">
                      {t('provider.onboarding.step4Subtitle')}
                    </p>
                  </div>

                  <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label htmlFor={FIELD_IDS.licenseNumber} className={labelClass}>
                          {t('provider.onboarding.licenseNumberLabel')}
                        </label>
                        <input
                          id={FIELD_IDS.licenseNumber}
                          type="text"
                          required
                          aria-required="true"
                          aria-invalid={Boolean(errors.licenseNumber)}
                          value={licenseNumber}
                          onChange={(e) => {
                            setLicenseNumber(e.target.value);
                            clearError('licenseNumber');
                          }}
                          placeholder={t('provider.onboarding.licenseNumberPlaceholder')}
                          className={inputClass}
                        />
                        {errors.licenseNumber && (
                          <p className={errorClass}>{errors.licenseNumber}</p>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <label htmlFor="provider-onboard-license-expiry" className={labelClass}>
                          {t('provider.onboarding.licenseExpiryLabel')}
                        </label>
                        <input
                          id="provider-onboard-license-expiry"
                          type="date"
                          value={licenseExpiry}
                          onChange={(e) => setLicenseExpiry(e.target.value)}
                          className={inputClass}
                        />
                      </div>
                    </div>

                    <div className="space-y-2 pt-1">
                      <label htmlFor={FIELD_IDS.idFile} className={labelClass}>
                        {t('provider.onboarding.idUploadLabel')}
                      </label>
                      <div className="neu-inset rounded-2xl border border-dashed border-surface-border p-4 space-y-3">
                        <input
                          ref={fileInputRef}
                          id={FIELD_IDS.idFile}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,application/pdf"
                          onChange={handleIdFileChange}
                          className="sr-only"
                        />

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <FileText
                              className="w-5 h-5 text-link shrink-0 mt-0.5"
                              aria-hidden="true"
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 break-words">
                                {idFile
                                  ? t('provider.onboarding.idSelectedFile', { name: idFile.name })
                                  : existingIdPaths.length > 0
                                    ? t('provider.onboarding.idExistingFile', {
                                        count: existingIdPaths.length,
                                      })
                                    : t('provider.onboarding.idUploadLabel')}
                              </p>
                              <p className="text-xs text-tertiary mt-0.5">
                                {t('provider.onboarding.idUploadHint')}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="neu-btn min-h-[44px] px-4 py-2 rounded-xl text-xs font-extrabold text-link inline-flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                          >
                            <UploadSimple className="w-4 h-4" aria-hidden="true" />
                            <span>
                              {idFile || existingIdPaths.length > 0
                                ? t('provider.onboarding.idReplaceBtn')
                                : t('provider.onboarding.idChooseBtn')}
                            </span>
                          </button>
                        </div>
                      </div>
                      {errors.idFile && <p className={errorClass}>{errors.idFile}</p>}
                    </div>

                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 flex items-start gap-2.5">
                      <Clock className="w-4 h-4 text-warning shrink-0 mt-0.5" aria-hidden="true" />
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-200 leading-relaxed">
                        {t('provider.onboarding.pendingReviewNotice')}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* STEP 5: REVIEW & SUBMIT FOR PENDING VERIFICATION */}
              {step === 5 && (
                <motion.div
                  key="provider-step-5"
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
                      id="provider-onboard-step-5-heading"
                      className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-balance text-slate-900 dark:text-white"
                    >
                      {t('provider.onboarding.step5Title')}
                    </h1>
                    <p className="text-sm text-tertiary leading-relaxed text-pretty">
                      {t('provider.onboarding.step5Subtitle')}
                    </p>
                  </div>

                  {/* Single clean review container with hairline dividers (no nested cards) */}
                  <div className="rounded-2xl border border-surface-border bg-surface-shell/60 divide-y divide-surface-border/75">
                    <div className="p-4 flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-0.5">
                        <p className="text-xs font-semibold text-tertiary">
                          {t('provider.onboarding.reviewIdentityLabel')}
                        </p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white break-words">
                          {fullName.trim() || user?.full_name || 'Provider'}
                        </p>
                        <p className="text-xs text-tertiary">{phone}</p>
                        <p className="text-xs text-slate-600 dark:text-slate-300 pt-1 break-words">
                          {bio}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => goToStep(1, { editFromReview: true })}
                        className={`${smallActionClass} shrink-0`}
                      >
                        {t('provider.onboarding.editStepBtn')}
                      </button>
                    </div>

                    <div className="p-4 flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-0.5">
                        <p className="text-xs font-semibold text-tertiary">
                          {t('provider.onboarding.reviewBaseLabel')}
                        </p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white break-words">
                          {baseAddress || 'Muntinlupa City'}
                        </p>
                        <p className="text-xs text-link font-semibold">
                          {t('provider.onboarding.reviewRadiusValue', {
                            km: Number(serviceRadiusKm) || 10,
                          })}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => goToStep(2, { editFromReview: true })}
                        className={`${smallActionClass} shrink-0`}
                      >
                        {t('provider.onboarding.editStepBtn')}
                      </button>
                    </div>

                    <div className="p-4 flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1.5">
                        <p className="text-xs font-semibold text-tertiary">
                          {t('provider.onboarding.reviewServicesLabel')}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {combinedServices.map((srv) => (
                            <span
                              key={srv}
                              className="px-2.5 py-0.5 rounded-lg bg-primary/10 text-link text-xs font-bold"
                            >
                              {translateService(srv)}
                            </span>
                          ))}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => goToStep(3, { editFromReview: true })}
                        className={`${smallActionClass} shrink-0`}
                      >
                        {t('provider.onboarding.editStepBtn')}
                      </button>
                    </div>

                    <div className="p-4 flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-0.5">
                        <p className="text-xs font-semibold text-tertiary">
                          {t('provider.onboarding.reviewCredentialsLabel')}
                        </p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                          {licenseNumber}
                          {licenseExpiry ? ` · Exp ${licenseExpiry}` : ''}
                        </p>
                        <p className="text-xs text-success dark:text-success-dark font-semibold">
                          {idFile
                            ? t('provider.onboarding.idSelectedFile', { name: idFile.name })
                            : t('provider.onboarding.reviewIdAttached')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => goToStep(4, { editFromReview: true })}
                        className={`${smallActionClass} shrink-0`}
                      >
                        {t('provider.onboarding.editStepBtn')}
                      </button>
                    </div>
                  </div>

                  {/* What happens next */}
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 flex items-start gap-2.5">
                    <ShieldCheck
                      className="w-5 h-5 text-warning shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <div className="space-y-0.5">
                      <p className="text-xs font-extrabold text-slate-900 dark:text-white">
                        {t('provider.onboarding.portalRestrictionTitle')}
                      </p>
                      <p className="text-xs text-tertiary leading-relaxed">
                        {t('provider.onboarding.portalRestrictionBody')}
                      </p>
                    </div>
                  </div>

                  {/* Consent */}
                  <div>
                    <label
                      htmlFor={FIELD_IDS.consent}
                      className="flex items-start gap-3 min-h-[44px] py-1 cursor-pointer select-none"
                    >
                      <input
                        id={FIELD_IDS.consent}
                        type="checkbox"
                        checked={privacyConsent}
                        onChange={(e) => {
                          setPrivacyConsent(e.target.checked);
                          clearError('consent');
                        }}
                        className="mt-1 h-5 w-5 rounded border-field text-primary focus:ring-primary/40 cursor-pointer shrink-0"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                        {t('provider.onboarding.consentCheckboxPrefix')}
                        <Link
                          to="/privacy"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-link underline underline-offset-2"
                        >
                          {t('provider.onboarding.privacyPolicyLink')}
                        </Link>
                        {t('provider.onboarding.consentCheckboxSuffix')}
                      </span>
                    </label>
                    {errors.consent && <p className={`mt-1.5 ${errorClass}`}>{errors.consent}</p>}
                  </div>

                  {saveError && (
                    <div
                      role="alert"
                      className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 dark:border-danger-dark/30 dark:bg-danger-darkSoft space-y-2"
                    >
                      <p className="text-sm font-semibold text-danger dark:text-danger-dark">
                        {saveError}
                      </p>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={handleSubmitVerification}
                        className={`${smallActionClass} -ml-2.5 text-danger dark:text-danger-dark`}
                      >
                        {t('provider.onboarding.retrySaveBtn')}
                      </button>
                    </div>
                  )}

                  {isPreview && (
                    <p className="text-sm text-tertiary">{t('provider.onboarding.previewNotice')}</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </main>

          {/* Bottom Action Bar for Steps 1, 3, 4, 5 */}
          {!isMapStep && (
            <footer className="onboarding-footer sticky bottom-0 z-20 w-full border-t border-surface-border bg-surface-page px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-3 sm:px-12 lg:px-14 xl:px-20">
              <div className="mx-auto flex w-full max-w-xl flex-col gap-2">
                <Button
                  type="submit"
                  size="lg"
                  disabled={saving}
                  className="neu-btn-primary min-h-[48px] w-full font-bold gap-2 shadow-sm cursor-pointer"
                >
                  {saving ? (
                    <span>{t('provider.onboarding.savingBtn')}</span>
                  ) : step < TOTAL_STEPS ? (
                    <>
                      <span>{t('provider.onboarding.continueBtn')}</span>
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </>
                  ) : (
                    <span>{t('provider.onboarding.submitBtn')}</span>
                  )}
                </Button>
              </div>
            </footer>
          )}
        </form>
      </div>

      {/* HERO PANEL (Left on Desktop) */}
      <aside
        className="hidden lg:flex lg:order-1 relative overflow-hidden flex-col justify-between p-12 xl:p-16 border-r border-slate-200/60 dark:border-white/5 select-none"
        aria-label={t('provider.onboarding.heroOverviewAria')}
      >
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

        <div className="relative z-10 flex items-center gap-2.5">
          <div className="neu-flat-sm p-1.5 rounded-xl">
            <BrandLogo variant="glyph" className="w-6 h-6 text-link" decorative />
          </div>
          <span className="font-display text-xl font-black text-link tracking-tight">
            MuntiCares
          </span>
        </div>

        <div className="relative z-10 my-auto max-w-lg space-y-6">
          <h2 className="font-display text-4xl xl:text-5xl font-semibold text-slate-900 dark:text-white tracking-tight leading-[1.12] text-balance">
            {t('provider.onboarding.heroHeadline1')}{' '}
            <br />
            {t('provider.onboarding.heroHeadline2')}{' '}
            <span className="text-primary dark:text-primary-400">
              {t('provider.onboarding.heroHeadlineAccent')}
            </span>
          </h2>

          <p className="text-base xl:text-lg font-medium text-slate-700 dark:text-slate-200 leading-relaxed text-pretty dark:drop-shadow-[0_2px_12px_rgba(0,0,0,0.55)]">
            {t('provider.onboarding.heroSubtext')}
          </p>
        </div>

        <div className="relative z-10 text-[max(0.75rem,12px)] font-medium text-tertiary">
          <span>{t('provider.onboarding.heroFooter')}</span>
        </div>
      </aside>
    </div>
  );
}
