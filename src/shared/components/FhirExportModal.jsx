import { useState, useMemo } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Copy,
  Check,
  CheckCircle,
  DownloadSimple,
  User,
  Pulse,
  Heartbeat,
  FileText,
  ShieldCheck,
  WarningCircle,
  CaretDown,
  CaretUp,
  Pill,
  Stethoscope,
  ClipboardText,
  Prohibit,
  FirstAidKit,
} from '@phosphor-icons/react';
import toast from 'react-hot-toast';
import useBodyScrollLock from '@/hooks/useBodyScrollLock';
import useBottomDrawerDrag from '@/hooks/useBottomDrawerDrag';
import { useLanguage } from '@/contexts/LanguageContext';
import { validateFhirBundle } from '@/lib/fhirValidator';

const FhirExportModal = ({ open, onClose, bundle, patientName, loading = false }) => {
  const { t } = useLanguage();
  const prefersReducedMotion = useReducedMotion();
  const [copied, setCopied] = useState(false);
  const [validationExpanded, setValidationExpanded] = useState(false);

  const json = useMemo(() => {
    if (!open || !bundle) return '';
    return JSON.stringify(bundle, null, 2);
  }, [open, bundle]);

  const validation = useMemo(() => {
    if (!open || !bundle) return null;
    return validateFhirBundle(bundle);
  }, [open, bundle]);

  const fileName = useMemo(() => {
    const cleanName = patientName?.trim()?.replace(/\s+/g, '_') || 'patient';
    return `${cleanName}_FHIR_Bundle.json`;
  }, [patientName]);

  const fileSizeLabel = useMemo(() => {
    if (!json) return '0 B';
    const bytes = new Blob([json]).size;
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  }, [json]);

  const resources = useMemo(() => {
    const entries = Array.isArray(bundle?.entry) ? bundle.entry : [];

    return entries.map((item, idx) => {
      const res = item?.resource || {};
      const type = res.resourceType || 'Resource';

      let summary = t('common.fhir.typeDefault');
      let subtitle = t('common.fhir.typeDefault');

      if (type === 'Composition') {
        summary = (res.title || 'Patient Summary').replace(/\s*\(IPS\)\s*/gi, '').trim();
        subtitle = t('common.fhir.typeComposition');
      } else if (type === 'Organization') {
        summary = res.name || 'Organization';
        subtitle = t('common.fhir.typeOrganization');
      } else if (type === 'Patient') {
        summary = res.name?.[0]?.text || patientName || t('common.fhir.patientDemographics');
        subtitle = t('common.fhir.typePatient');
      } else if (type === 'Observation') {
        const label = res.code?.text || res.code?.coding?.[0]?.display || t('common.fhir.vitalSign');
        if (res.valueQuantity) {
          summary = `${label}: ${res.valueQuantity.value} ${res.valueQuantity.unit || ''}`.trim();
        } else if (res.valueCodeableConcept?.text) {
          summary = `${label}: ${res.valueCodeableConcept.text}`;
        } else if (Array.isArray(res.component) && res.component.length > 0) {
          const vals = res.component
            .map((c) => c.valueQuantity?.value)
            .filter((v) => v != null)
            .join('/');
          summary = `${label}${vals ? `: ${vals} mmHg` : ''}`;
        } else {
          summary = label;
        }
        const isLab = res.category?.some((c) =>
          c.coding?.some((coding) => coding.code === 'laboratory')
        );
        subtitle = isLab ? t('common.fhir.typeLabObservation') : t('common.fhir.typeObservation');
      } else if (type === 'Condition') {
        summary = res.code?.text || res.code?.coding?.[0]?.display || t('common.fhir.typeCondition');
        subtitle = t('common.fhir.typeCondition');
      } else if (type === 'AllergyIntolerance') {
        summary = res.code?.text || res.code?.coding?.[0]?.display || t('common.fhir.typeAllergy');
        subtitle = t('common.fhir.typeAllergy');
      } else if (type === 'Procedure') {
        summary = res.code?.text || res.code?.coding?.[0]?.display || t('common.fhir.typeProcedure');
        subtitle = t('common.fhir.typeProcedure');
      } else if (type === 'MedicationStatement') {
        summary =
          res.medicationCodeableConcept?.text ||
          res.medicationCodeableConcept?.coding?.[0]?.display ||
          t('common.fhir.typeMedication');
        subtitle = t('common.fhir.typeMedication');
      } else if (type === 'Encounter') {
        summary = res.type?.[0]?.text || t('common.fhir.typeEncounter');
        subtitle = t('common.fhir.typeEncounter');
      } else if (type === 'DocumentReference') {
        summary = res.content?.[0]?.attachment?.title || t('common.fhir.medicalDocument');
        const isClinicalNote = res.category?.some((c) =>
          c.coding?.some((coding) => coding.code === 'clinical-note')
        );
        subtitle = isClinicalNote ? t('common.fhir.typeClinicalNote') : t('common.fhir.typeDocument');
      } else if (type === 'Consent') {
        summary = res.category?.[0]?.text || t('common.fhir.typeConsent');
        subtitle = t('common.fhir.typeConsent');
      }

      return {
        id: res.id || `res-${idx}`,
        type,
        summary,
        subtitle,
      };
    });
  }, [bundle, patientName, t]);

  useBodyScrollLock(open);

  const handleClose = () => {
    onClose?.();
    setCopied(false);
    setValidationExpanded(false);
  };

  const { drawerMotionProps, dragHandleProps } = useBottomDrawerDrag({
    onClose: handleClose,
  });

  const handleCopy = async () => {
    if (loading || !json) return;
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success(t('common.fhir.copiedToast'));
    } catch {
      toast.error(t('common.fhir.copyFailedToast'));
    }
  };

  const handleDownload = () => {
    if (loading || !json) return;
    const blob = new Blob([json], { type: 'application/fhir+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('common.fhir.downloadedToast'));
  };

  const getResourceIcon = (type) => {
    switch (type) {
      case 'Patient':
        return User;
      case 'Observation':
        return Pulse;
      case 'MedicationStatement':
        return Pill;
      case 'Encounter':
        return Stethoscope;
      case 'DocumentReference':
      case 'Composition':
        return FileText;
      case 'Consent':
        return ShieldCheck;
      case 'Procedure':
        return ClipboardText;
      case 'AllergyIntolerance':
        return Prohibit;
      case 'Organization':
        return FirstAidKit;
      default:
        return Heartbeat;
    }
  };

  const isIpsValid = validation?.valid && validation?.profile === 'IPS-R4';
  const isR4Valid = validation?.valid && validation?.profile === 'FHIR-R4';
  const hasValidationDetails =
    (validation?.errors?.length || 0) > 0 || (validation?.warnings?.length || 0) > 0;

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
                          {t('common.fhir.title')}
                        </h2>
                      </DialogPrimitive.Title>
                      <DialogPrimitive.Description asChild>
                        <p className="text-xs text-tertiary mt-0.5 truncate font-semibold">
                          {loading ? (
                            t('common.fhir.loadingSummary')
                          ) : (
                            <>
                              {patientName ? (
                                <>
                                  {t('common.fhir.patientPrefix')}{' '}
                                  <span className="text-ink dark:text-slate-200 font-bold">{patientName}</span> •{' '}
                                </>
                              ) : null}
                              <span className="font-mono text-xs">{fileName}</span>{' '}
                              <span className="tabular-nums">({fileSizeLabel})</span>
                            </>
                          )}
                        </p>
                      </DialogPrimitive.Description>
                    </div>
                  </div>
                </div>

                {/* Single Scrollable Content Container */}
                <div
                  className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4"
                  style={{ WebkitOverflowScrolling: 'touch' }}
                  aria-busy={loading}
                >
                  {loading ? (
                    <div role="status" aria-label={t('common.fhir.loadingSummary')} className="space-y-4">
                      <div className="rounded-2xl p-3 sm:p-3.5 border border-surface-border flex items-center gap-2.5 animate-pulse">
                        <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3.5 w-48 rounded-lg bg-slate-200 dark:bg-slate-700" />
                          <div className="h-3 w-28 rounded-lg bg-slate-200 dark:bg-slate-700" />
                        </div>
                      </div>

                      <div className="neu-inset rounded-2xl border border-surface-border divide-y divide-surface-border overflow-hidden">
                        {[0, 1, 2, 3].map((row) => (
                          <div key={row} className="px-3.5 sm:px-4 py-3 flex items-center gap-3 animate-pulse">
                            <div className="w-4 h-4 rounded bg-slate-200 dark:bg-slate-700 shrink-0" />
                            <div className="flex-1 space-y-2">
                              <div className="h-3.5 w-44 rounded-lg bg-slate-200 dark:bg-slate-700" />
                              <div className="h-3 w-28 rounded-lg bg-slate-200 dark:bg-slate-700" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* FHIR R4 Self-Validation Banner */}
                      {validation && (
                        <div
                          role="status"
                          className={`rounded-2xl p-3 sm:p-3.5 border ${
                            validation.valid
                              ? 'bg-emerald-500/5 border-emerald-500/25'
                              : 'bg-rose-500/5 border-rose-500/25'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              {validation.valid ? (
                                <CheckCircle
                                  className="w-5 h-5 text-success dark:text-success-dark shrink-0"
                                  weight="fill"
                                  aria-hidden="true"
                                />
                              ) : (
                                <WarningCircle
                                  className="w-5 h-5 text-danger dark:text-danger-dark shrink-0"
                                  weight="fill"
                                  aria-hidden="true"
                                />
                              )}
                              <div className="min-w-0">
                                <p
                                  className={`text-sm font-bold leading-snug ${
                                    validation.valid
                                      ? 'text-success dark:text-success-dark'
                                      : 'text-danger dark:text-danger-dark'
                                  }`}
                                >
                                  {isIpsValid
                                    ? t('common.fhir.validIpsTitle')
                                    : isR4Valid
                                      ? t('common.fhir.validR4Title')
                                      : t('common.fhir.invalidTitle')}
                                </p>
                                <p className="text-xs text-tertiary font-semibold tabular-nums mt-0.5">
                                  {t('common.fhir.checksCount', {
                                    passed: validation.checksPassed,
                                    total: validation.checksTotal,
                                  })}
                                  {validation.warnings.length > 0
                                    ? ` • ${t('common.fhir.warningsCount', { count: validation.warnings.length })}`
                                    : ''}
                                  {validation.errors.length > 0
                                    ? ` • ${t('common.fhir.errorsCount', { count: validation.errors.length })}`
                                    : ''}
                                </p>
                              </div>
                            </div>

                            {hasValidationDetails && (
                              <button
                                type="button"
                                onClick={() => setValidationExpanded((prev) => !prev)}
                                className="neu-btn min-h-[2.75rem] px-3 rounded-xl text-xs font-bold text-ink dark:text-slate-200 inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                              >
                                <span>
                                  {validationExpanded ? t('common.fhir.hideDetails') : t('common.fhir.showDetails')}
                                </span>
                                {validationExpanded ? (
                                  <CaretUp className="w-3.5 h-3.5" aria-hidden="true" />
                                ) : (
                                  <CaretDown className="w-3.5 h-3.5" aria-hidden="true" />
                                )}
                              </button>
                            )}
                          </div>

                          {validationExpanded && hasValidationDetails && (
                            <ul className="mt-3 pt-3 border-t border-surface-border space-y-1.5 text-xs">
                              {validation.errors.map((err, idx) => (
                                <li
                                  key={`err-${idx}`}
                                  className="text-danger dark:text-danger-dark font-medium break-words"
                                >
                                  <span className="font-mono font-bold">{err.path}</span>: {err.message}
                                </li>
                              ))}
                              {validation.warnings.map((warn, idx) => (
                                <li
                                  key={`warn-${idx}`}
                                  className="text-warning dark:text-warning-dark font-medium break-words"
                                >
                                  <span className="font-mono font-bold">{warn.path}</span>: {warn.message}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}

                      {/* Included Resources List (Flat divided rows; parent handles scrolling) */}
                      <div className="neu-inset rounded-2xl border border-surface-border divide-y divide-surface-border overflow-hidden">
                        {resources.length === 0 ? (
                          <div className="text-center py-8 px-4 text-sm font-semibold text-tertiary">
                            {t('common.fhir.noResources')}
                          </div>
                        ) : (
                          resources.map((item) => {
                            const IconComponent = getResourceIcon(item.type);
                            return (
                              <div
                                key={`${item.type}-${item.id}`}
                                className="px-3.5 sm:px-4 py-3 flex items-center gap-3 min-w-0"
                              >
                                <IconComponent className="w-4 h-4 text-link shrink-0" aria-hidden="true" />
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-bold text-ink dark:text-slate-100 truncate">
                                    {item.summary}
                                  </p>
                                  <p className="text-xs text-tertiary truncate">
                                    {item.subtitle}
                                  </p>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="px-4 sm:px-6 py-3.5 border-t border-surface-border shrink-0">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs text-tertiary font-semibold">
                      <ShieldCheck
                        className="w-4 h-4 text-success dark:text-success-dark shrink-0"
                        aria-hidden="true"
                      />
                      <span className="text-xs leading-snug">{t('common.fhir.localNotice')}</span>
                    </div>

                    <div className="grid grid-cols-5 sm:flex sm:items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleCopy}
                        disabled={loading || !json}
                        className="col-span-2 neu-btn min-h-[2.75rem] px-3.5 py-2.5 rounded-2xl font-bold text-xs text-ink dark:text-slate-200 hover:text-link transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {copied ? (
                          <Check className="w-4 h-4 text-success dark:text-success-dark" aria-hidden="true" />
                        ) : (
                          <Copy className="w-4 h-4" aria-hidden="true" />
                        )}
                        <span>{copied ? t('common.actions.copied') : t('common.fhir.copyJson')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleDownload}
                        disabled={loading || !json}
                        aria-busy={loading}
                        className="col-span-3 neu-btn-primary min-h-[2.75rem] px-4 sm:px-5 py-2.5 rounded-2xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <DownloadSimple className="w-4 h-4 shrink-0" aria-hidden="true" />
                        <span>{loading ? t('common.fhir.preparingBtn') : t('common.fhir.downloadJson')}</span>
                      </button>
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

export default FhirExportModal;
