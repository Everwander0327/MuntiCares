import { useState, useRef, useMemo } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { motion, useReducedMotion } from 'framer-motion';
import {
  UploadSimple,
  FileCode,
  CheckCircle,
  WarningCircle,
  ShieldCheck,
  Check,
  Flask,
  ArrowCounterClockwise,
} from '@phosphor-icons/react';
import toast from 'react-hot-toast';
import useBodyScrollLock from '@/hooks/useBodyScrollLock';
import useBottomDrawerDrag from '@/hooks/useBottomDrawerDrag';
import { useLanguage } from '@/contexts/LanguageContext';
import { parseFhirBundleForImport, buildMergedProfileUpdate } from '@/lib/fhirImport';

const MAX_FHIR_FILE_BYTES = 2 * 1024 * 1024; // 2 MB
const SAMPLE_DISCHARGE_URL = '/samples/sample-hospital-discharge-ips.json';

const CATEGORY_LABEL_KEYS = {
  demographics: 'common.fhirImport.catDemographics',
  allergies: 'common.fhirImport.catAllergies',
  chronic_conditions: 'common.fhirImport.catConditions',
  medications: 'common.fhirImport.catMedications',
  past_surgeries: 'common.fhirImport.catSurgeries',
  blood_type: 'common.fhirImport.catBloodType',
  discharge_summary: 'common.fhirImport.catDischargeSummary',
};

const DEMO_FIELD_LABEL_KEYS = {
  phone: 'common.fhirImport.fieldPhone',
  date_of_birth: 'common.fhirImport.fieldDob',
  address: 'common.fhirImport.fieldAddress',
  emergency_contact: 'common.fhirImport.fieldEmergency',
};

const FhirImportModal = ({ open, onClose, currentProfile, onConfirmMerge }) => {
  const { t } = useLanguage();
  const prefersReducedMotion = useReducedMotion();
  const fileInputRef = useRef(null);

  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState('');
  const [isSampleData, setIsSampleData] = useState(false);
  const [loadingSample, setLoadingSample] = useState(false);
  const [saving, setSaving] = useState(false);
  const [parseError, setParseError] = useState(null); // { message, details: [] }
  const [parsed, setParsed] = useState(null);
  const [selectedKeys, setSelectedKeys] = useState([]);

  useBodyScrollLock(open);

  const resetState = () => {
    setDragActive(false);
    setFileName('');
    setIsSampleData(false);
    setLoadingSample(false);
    setSaving(false);
    setParseError(null);
    setParsed(null);
    setSelectedKeys([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    if (saving) return;
    resetState();
    onClose?.();
  };

  const { drawerMotionProps, dragHandleProps } = useBottomDrawerDrag({
    onClose: handleClose,
  });

  const ingestJsonObject = (jsonObj, sourceName, sampleFlag = false) => {
    const result = parseFhirBundleForImport(jsonObj, currentProfile || {});
    setFileName(sourceName);
    setIsSampleData(sampleFlag);

    if (!result.validation.valid) {
      setParsed(null);
      setSelectedKeys([]);
      setParseError({
        message: t('common.fhirImport.errorHeading'),
        details: result.validation.errors,
      });
      return;
    }

    setParseError(null);
    setParsed(result);
    setSelectedKeys(
      result.categories.filter((cat) => cat.defaultSelected && cat.hasChanges).map((cat) => cat.key)
    );
  };

  const processFile = async (file) => {
    if (!file) return;
    if (file.size > MAX_FHIR_FILE_BYTES) {
      setParsed(null);
      setParseError({
        message: t('common.fhirImport.errorTooLarge'),
        details: [],
      });
      return;
    }

    try {
      const text = await file.text();
      const jsonObj = JSON.parse(text);
      ingestJsonObject(jsonObj, file.name, false);
    } catch {
      setParsed(null);
      setParseError({
        message: t('common.fhirImport.errorInvalidJson'),
        details: [],
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleLoadSample = async () => {
    setLoadingSample(true);
    setParseError(null);
    try {
      const response = await fetch(SAMPLE_DISCHARGE_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error('Sample fetch failed');
      const jsonObj = await response.json();
      ingestJsonObject(jsonObj, 'sample-hospital-discharge-ips.json', true);
    } catch {
      setParseError({
        message: t('common.fhirImport.errorSampleLoad'),
        details: [],
      });
    } finally {
      setLoadingSample(false);
    }
  };

  const selectableCategories = useMemo(
    () => (parsed?.categories || []).filter((cat) => cat.hasChanges),
    [parsed]
  );

  const toggleCategory = (key) => {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    );
  };

  const handleSelectAll = () => {
    setSelectedKeys(selectableCategories.map((c) => c.key));
  };

  const handleClearSelection = () => {
    setSelectedKeys([]);
  };

  const handleConfirm = async () => {
    if (!parsed || selectedKeys.length === 0 || saving) return;
    setSaving(true);
    try {
      const merged = buildMergedProfileUpdate(parsed, selectedKeys, currentProfile || {});
      await onConfirmMerge?.(merged);
      toast.success(t('common.fhirImport.mergeSuccessToast'));
      resetState();
      onClose?.();
    } catch (err) {
      console.error('FHIR import merge error:', err);
      toast.error(t('common.fhirImport.mergeErrorToast'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) handleClose();
      }}
    >
      {open && (
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-overlay bg-slate-950/70 backdrop-blur-[2px]" />
          <DialogPrimitive.Content asChild aria-modal="true">
            <motion.div
              className="fixed inset-0 z-overlay flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.16 }}
              onClick={handleClose}
            >
              <motion.div
                initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.22, ease: [0.32, 0.72, 0, 1] }}
                onClick={(e) => e.stopPropagation()}
                {...drawerMotionProps}
                className="relative z-10 w-full sm:max-w-2xl max-h-[92dvh] sm:max-h-[86dvh] neu-flat bg-surface-shell rounded-t-[2rem] sm:rounded-[2rem] flex flex-col overflow-hidden border-t sm:border border-surface-border shadow-2xl pb-[max(0.75rem,env(safe-area-inset-bottom))]"
              >
                {/* Header */}
                <div
                  className="shrink-0 cursor-grab sm:cursor-auto active:cursor-grabbing sm:active:cursor-auto"
                  {...dragHandleProps}
                >
                  <div
                    className="mx-auto mt-3 h-1.5 w-11 rounded-full bg-surface-border sm:hidden shrink-0"
                    aria-hidden="true"
                  />
                  <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-surface-border">
                    <div className="min-w-0">
                      <DialogPrimitive.Title asChild>
                        <h2 className="font-display font-extrabold text-base sm:text-lg text-ink dark:text-slate-100 truncate">
                          {t('common.fhirImport.title')}
                        </h2>
                      </DialogPrimitive.Title>
                      <DialogPrimitive.Description asChild>
                        <p className="text-xs sm:text-sm text-tertiary mt-0.5 leading-snug">
                          {t('common.fhirImport.subtitle')}
                        </p>
                      </DialogPrimitive.Description>
                    </div>
                  </div>
                </div>

                {/* Single Scrollable Content Container */}
                <div
                  className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4"
                  style={{ WebkitOverflowScrolling: 'touch' }}
                  aria-busy={loadingSample || saving}
                >
                  <input
                    ref={fileInputRef}
                    id="fhir-import-file-input"
                    type="file"
                    accept=".json,application/fhir+json,application/json"
                    className="sr-only"
                    onChange={(e) => processFile(e.target.files?.[0])}
                  />

                  {/* Error State (Distinct from empty state) */}
                  {parseError && (
                    <div
                      role="alert"
                      className="rounded-2xl p-4 border border-rose-500/30 bg-rose-500/5 space-y-3"
                    >
                      <div className="flex items-start gap-2.5">
                        <WarningCircle
                          className="w-5 h-5 text-danger dark:text-danger-dark shrink-0 mt-0.5"
                          weight="fill"
                          aria-hidden="true"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-danger dark:text-danger-dark">
                            {parseError.message}
                          </p>
                          {parseError.details?.length > 0 && (
                            <ul className="mt-2 space-y-1 text-xs text-ink dark:text-slate-200">
                              {parseError.details.slice(0, 6).map((err, idx) => (
                                <li key={idx} className="break-words">
                                  <span className="font-mono font-bold text-danger dark:text-danger-dark">
                                    {err.path}
                                  </span>
                                  : {err.message}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="neu-btn min-h-[2.75rem] px-4 rounded-2xl text-xs font-bold text-link inline-flex items-center gap-2 cursor-pointer"
                        >
                          <ArrowCounterClockwise className="w-4 h-4" aria-hidden="true" />
                          <span>{t('common.fhirImport.tryAnotherFile')}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Loading Sample Skeleton */}
                  {!parsed && loadingSample && (
                    <div role="status" aria-label={t('common.fhirImport.loadingSample')} className="space-y-4">
                      <div className="rounded-2xl p-3.5 border border-surface-border flex items-center gap-2.5 animate-pulse">
                        <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3.5 w-48 rounded-lg bg-slate-200 dark:bg-slate-700" />
                          <div className="h-3 w-32 rounded-lg bg-slate-200 dark:bg-slate-700" />
                        </div>
                      </div>
                      <div className="neu-inset rounded-2xl border border-surface-border divide-y divide-surface-border overflow-hidden">
                        {[0, 1, 2].map((row) => (
                          <div key={row} className="p-4 flex items-start gap-3 animate-pulse">
                            <div className="w-6 h-6 rounded-lg bg-slate-200 dark:bg-slate-700 shrink-0" />
                            <div className="flex-1 space-y-2">
                              <div className="h-3.5 w-40 rounded-lg bg-slate-200 dark:bg-slate-700" />
                              <div className="h-3 w-64 rounded-lg bg-slate-200 dark:bg-slate-700" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Step 1: Select & Validate */}
                  {!parsed && !loadingSample && (
                    <div className="space-y-4">
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDragActive(true);
                        }}
                        onDragLeave={() => setDragActive(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDragActive(false);
                          processFile(e.dataTransfer.files?.[0]);
                        }}
                        className={`neu-inset rounded-2xl p-6 sm:p-8 text-center border-2 border-dashed transition-colors ${
                          dragActive ? 'border-primary bg-primary/5' : 'border-surface-border'
                        }`}
                      >
                        <FileCode className="w-6 h-6 text-link mx-auto mb-2.5" aria-hidden="true" />
                        <p className="text-base font-bold text-ink dark:text-slate-100">
                          {t('common.fhirImport.dropzoneTitle')}
                        </p>
                        <p className="text-sm text-tertiary mt-1 max-w-md mx-auto leading-relaxed">
                          {t('common.fhirImport.dropzoneHint')}
                        </p>

                        <div className="mt-5 flex justify-center">
                          <label
                            htmlFor="fhir-import-file-input"
                            className="neu-btn-primary min-h-[2.75rem] px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                          >
                            <UploadSimple className="w-4 h-4" aria-hidden="true" />
                            <span>{t('common.fhirImport.chooseFileBtn')}</span>
                          </label>
                        </div>
                      </div>

                      {/* Synthetic Demo Fixture Helper */}
                      <div className="rounded-2xl p-4 border border-surface-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <Flask className="w-4 h-4 text-link shrink-0 mt-1" aria-hidden="true" />
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-ink dark:text-slate-100">
                              {t('common.fhirImport.demoBannerTitle')}
                            </p>
                            <p className="text-xs sm:text-sm text-tertiary mt-0.5 leading-snug">
                              {t('common.fhirImport.demoBannerSub')}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleLoadSample}
                          disabled={loadingSample}
                          aria-busy={loadingSample}
                          className="neu-btn min-h-[2.75rem] px-4 rounded-2xl text-xs font-bold text-link shrink-0 cursor-pointer disabled:opacity-50"
                        >
                          {loadingSample
                            ? t('common.fhirImport.loadingSample')
                            : t('common.fhirImport.loadSampleBtn')}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Step 2: Clinical Review & Selective Merge Preview */}
                  {parsed && (
                    <div className="space-y-4">
                      {/* Validation & Source Banner */}
                      <div className="rounded-2xl p-3.5 sm:p-4 border border-emerald-500/25 bg-emerald-500/5 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <CheckCircle
                              className="w-5 h-5 text-success dark:text-success-dark shrink-0"
                              weight="fill"
                              aria-hidden="true"
                            />
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-bold text-success dark:text-success-dark">
                                  {parsed.validation.profile === 'IPS-R4'
                                    ? t('common.fhir.validIpsTitle')
                                    : t('common.fhir.validR4Title')}
                                </p>
                                {isSampleData && (
                                  <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-2xs font-extrabold text-warning dark:text-warning-dark uppercase tracking-wider">
                                    {t('common.fhirImport.sampleLoadedBadge')}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-tertiary font-semibold tabular-nums mt-0.5 truncate">
                                <span className="font-mono">{fileName}</span> •{' '}
                                {t('common.fhir.checksCount', {
                                  passed: parsed.validation.checksPassed,
                                  total: parsed.validation.checksTotal,
                                })}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              resetState();
                              fileInputRef.current?.click();
                            }}
                            disabled={saving}
                            className="neu-btn min-h-[2.75rem] px-3.5 rounded-xl text-xs font-bold text-ink dark:text-slate-200 cursor-pointer shrink-0 disabled:opacity-50"
                          >
                            {t('common.fhirImport.changeFile')}
                          </button>
                        </div>

                        {(parsed.sourceFacility || parsed.patientDisplayName) && (
                          <div className="pt-2 border-t border-surface-border flex flex-wrap gap-x-4 gap-y-1 text-xs text-tertiary">
                            {parsed.sourceFacility && (
                              <span>
                                <strong className="text-ink dark:text-slate-200">
                                  {t('common.fhirImport.sourceLabel')}
                                </strong>{' '}
                                {parsed.sourceFacility}
                              </span>
                            )}
                            {parsed.patientDisplayName && (
                              <span>
                                <strong className="text-ink dark:text-slate-200">
                                  {t('common.fhirImport.recordPatientLabel')}
                                </strong>{' '}
                                {parsed.patientDisplayName}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Selection Toolbar */}
                      {selectableCategories.length > 0 ? (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-tertiary tabular-nums">
                            {selectedKeys.length}/{selectableCategories.length} selected
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={handleSelectAll}
                              className="min-h-[2.75rem] px-2.5 text-xs font-bold text-link hover:underline cursor-pointer"
                            >
                              {t('common.fhirImport.selectAll')}
                            </button>
                            <button
                              type="button"
                              onClick={handleClearSelection}
                              className="min-h-[2.75rem] px-2.5 text-xs font-bold text-tertiary hover:text-ink dark:hover:text-slate-100 cursor-pointer"
                            >
                              {t('common.fhirImport.clearSelection')}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="neu-inset rounded-2xl p-6 text-center space-y-1.5">
                          <p className="text-sm font-bold text-ink dark:text-slate-100">
                            {t('common.fhirImport.noNewChangesTitle')}
                          </p>
                          <p className="text-sm text-tertiary max-w-md mx-auto">
                            {t('common.fhirImport.noNewChangesBody')}
                          </p>
                        </div>
                      )}

                      {/* Category Diff Rows */}
                      <div className="neu-inset rounded-2xl border border-surface-border divide-y divide-surface-border overflow-hidden">
                        {parsed.categories.map((cat) => {
                          const isChecked = selectedKeys.includes(cat.key);
                          const disabled = !cat.hasChanges || saving;
                          const label = t(CATEGORY_LABEL_KEYS[cat.key] || cat.key);

                          return (
                            <div
                              key={cat.key}
                              className={`p-3.5 sm:p-4 transition-colors ${!cat.hasChanges ? 'opacity-70' : ''}`}
                            >
                              <label className="flex items-start gap-3 cursor-pointer select-none min-h-[2.75rem]">
                                <span className="pt-0.5 shrink-0">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    disabled={disabled}
                                    onChange={() => toggleCategory(cat.key)}
                                    className="sr-only"
                                  />
                                  <span
                                    aria-hidden="true"
                                    className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors border ${
                                      isChecked
                                        ? 'bg-primary border-primary text-on-primary'
                                        : 'bg-surface-shell border-surface-border text-transparent'
                                    }`}
                                  >
                                    <Check className="w-3.5 h-3.5" weight="bold" />
                                  </span>
                                </span>

                                <div className="min-w-0 flex-1 space-y-2">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="text-sm font-bold text-ink dark:text-slate-100">
                                      {label}
                                    </span>
                                    {cat.hasChanges ? (
                                      <span className="text-xs font-bold text-success dark:text-success-dark tabular-nums">
                                        {t('common.fhirImport.newCountBadge', { count: cat.newCount })}
                                      </span>
                                    ) : (
                                      <span className="text-xs font-semibold text-tertiary">
                                        {t('common.fhirImport.alreadyUpToDate')}
                                      </span>
                                    )}
                                  </div>

                                  {cat.key === 'demographics' ? (
                                    <div className="space-y-2 text-xs sm:text-sm">
                                      {cat.diffs.map((diff) => (
                                        <div
                                          key={diff.field}
                                          className="pt-2 border-t border-surface-border/60 grid grid-cols-1 sm:grid-cols-2 gap-2"
                                        >
                                          <div>
                                            <p className="text-2xs font-extrabold uppercase tracking-wider text-tertiary">
                                              {t(DEMO_FIELD_LABEL_KEYS[diff.field] || diff.field)} —{' '}
                                              {t('common.fhirImport.currentLabel')}
                                            </p>
                                            <p className="text-xs sm:text-sm font-medium text-tertiary break-words mt-0.5">
                                              {diff.current || t('common.fhirImport.emptyValue')}
                                            </p>
                                          </div>
                                          <div>
                                            <p className="text-2xs font-extrabold uppercase tracking-wider text-link">
                                              {t('common.fhirImport.incomingLabel')}
                                            </p>
                                            <p className="text-xs sm:text-sm font-bold text-ink dark:text-slate-100 break-words mt-0.5">
                                              {diff.incoming}
                                            </p>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : cat.key === 'discharge_summary' ? (
                                    <div className="space-y-2">
                                      <p className="text-xs text-tertiary leading-relaxed">
                                        {t('common.fhirImport.dischargeRlsNote')}
                                      </p>
                                      <div className="pt-2 border-t border-surface-border/60 space-y-1.5 text-xs">
                                        {cat.vitalsPreview?.length > 0 && (
                                          <div className="flex flex-wrap gap-1.5">
                                            {cat.vitalsPreview.map((v, i) => (
                                              <span
                                                key={i}
                                                className="bg-surface-shell border border-surface-border px-2.5 py-1 rounded-lg font-semibold text-ink dark:text-slate-200 tabular-nums"
                                              >
                                                {v.label}: {v.value}
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                        {cat.notesPreview?.map((noteLine, idx) => (
                                          <p
                                            key={idx}
                                            className="text-xs sm:text-sm text-ink dark:text-slate-200 leading-relaxed pt-1"
                                          >
                                            {noteLine}
                                          </p>
                                        ))}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="pt-2 border-t border-surface-border/60 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
                                      <div>
                                        <p className="text-2xs font-extrabold uppercase tracking-wider text-tertiary">
                                          {t('common.fhirImport.currentLabel')}
                                        </p>
                                        <p className="text-xs sm:text-sm font-medium text-tertiary break-words mt-0.5 whitespace-pre-line">
                                          {cat.currentDisplay || t('common.fhirImport.emptyValue')}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-2xs font-extrabold uppercase tracking-wider text-link">
                                          {t('common.fhirImport.incomingLabel')}
                                        </p>
                                        <p className="text-xs sm:text-sm font-bold text-ink dark:text-slate-100 break-words mt-0.5">
                                          {cat.incomingItems.join(', ')}
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="px-4 sm:px-6 py-3.5 border-t border-surface-border shrink-0">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs text-tertiary font-semibold">
                      <ShieldCheck
                        className="w-4 h-4 text-success dark:text-success-dark shrink-0"
                        aria-hidden="true"
                      />
                      <span className="text-xs leading-snug">
                        {t('common.fhirImport.localPrivacyNote')}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleClose}
                        disabled={saving}
                        className="neu-btn min-h-[2.75rem] px-4 py-2.5 rounded-2xl font-bold text-xs text-ink dark:text-slate-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {t('common.actions.cancel')}
                      </button>

                      {parsed && (
                        <button
                          type="button"
                          onClick={handleConfirm}
                          disabled={saving || selectedKeys.length === 0}
                          aria-busy={saving}
                          className="neu-btn-primary min-h-[2.75rem] px-5 py-2.5 rounded-2xl font-bold text-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                        >
                          {saving
                            ? t('common.fhirImport.savingBtn')
                            : t('common.fhirImport.confirmMergeBtn', { count: selectedKeys.length })}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      )}
    </DialogPrimitive.Root>
  );
};

export default FhirImportModal;
