import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Copy,
  Check,
  DownloadSimple,
  FileCode,
  User,
  Pulse,
  Heartbeat,
  FileText,
  ShieldCheck,
} from '@phosphor-icons/react';
import toast from 'react-hot-toast';
import useBodyScrollLock from '@/hooks/useBodyScrollLock';
import useBottomDrawerDrag from '@/hooks/useBottomDrawerDrag';
import { useLanguage } from '@/contexts/LanguageContext';

const FhirExportModal = ({ open, onClose, bundle, patientName }) => {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState('json'); // 'json' | 'resources'

  const json = useMemo(() => {
    if (!open || !bundle) return '';
    return JSON.stringify(bundle, null, 2);
  }, [open, bundle]);

  const jsonLines = useMemo(() => {
    if (!json) return [];
    return json.split('\n');
  }, [json]);

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

  const resourceStats = useMemo(() => {
    const entries = Array.isArray(bundle?.entry) ? bundle.entry : [];
    let patients = 0;
    let observations = 0;
    let clinical = 0;
    let documents = 0;

    const list = entries.map((item, idx) => {
      const res = item?.resource || {};
      const type = res.resourceType || 'Resource';
      if (type === 'Patient') patients += 1;
      else if (type === 'Observation') observations += 1;
      else if (type === 'Condition' || type === 'AllergyIntolerance') clinical += 1;
      else if (type === 'DocumentReference') documents += 1;

      let summary = res.id || `entry-${idx + 1}`;
      if (type === 'Patient') {
        summary = res.name?.[0]?.text || patientName || t('common.fhir.patientDemographics');
      } else if (type === 'Observation') {
        const label = res.code?.text || res.code?.coding?.[0]?.display || t('common.fhir.vitalSign');
        if (res.valueQuantity) {
          summary = `${label}: ${res.valueQuantity.value} ${res.valueQuantity.unit || ''}`.trim();
        } else if (Array.isArray(res.component) && res.component.length > 0) {
          const vals = res.component.map((c) => c.valueQuantity?.value).filter((v) => v != null).join('/');
          summary = `${label}${vals ? `: ${vals} mmHg` : ''}`;
        } else {
          summary = label;
        }
      } else if (type === 'Condition' || type === 'AllergyIntolerance') {
        summary = res.code?.text || type;
      } else if (type === 'DocumentReference') {
        summary = res.content?.[0]?.attachment?.title || t('common.fhir.medicalDocument');
      }

      return {
        id: res.id || `res-${idx}`,
        type,
        summary,
        fullUrl: item?.fullUrl || '',
      };
    });

    return {
      total: entries.length,
      patients,
      observations,
      clinical,
      documents,
      list,
    };
  }, [bundle, patientName, t]);

  // Handle Escape key when open
  useBodyScrollLock(open);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && open) {
        onClose();
        setCopied(false);
      }
    };
    if (open) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  const handleCopy = async () => {
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
    const blob = new Blob([json], { type: 'application/fhir+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('common.fhir.downloadedToast'));
  };

  const handleClose = () => {
    onClose();
    setCopied(false);
  };

  const { drawerMotionProps, dragHandleProps } = useBottomDrawerDrag({
    onClose: handleClose,
  });

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-overlay flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-hidden"
          onClick={handleClose}
        >
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-slate-950/70 sm:backdrop-blur-sm z-[60]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={handleClose}
          />

          {/* Neumorphic Modal Dialog — Option 1: Clinical Bundle Summary + Segmented Inspector */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="fhir-modal-title"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            {...drawerMotionProps}
            className="relative w-full sm:max-w-2xl max-h-[90dvh] sm:max-h-[84vh] neu-flat bg-surface-shell rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden z-[70] border-t sm:border border-white/70 dark:border-white/10 shadow-2xl transform-gpu will-change-transform pb-[max(0.5rem,env(safe-area-inset-bottom))]"
          >
            <div
              className="shrink-0 cursor-grab sm:cursor-auto active:cursor-grabbing sm:active:cursor-auto"
              {...dragHandleProps}
            >
              {/* Mobile Drag Indicator Bar (Squircle) */}
              <div className="w-10 h-1 bg-slate-300 dark:bg-slate-600 rounded-md mx-auto mt-2.5 sm:hidden shrink-0" />

              {/* Header */}
              <div className="flex items-start sm:items-center justify-between gap-3 px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200/70 dark:border-white/10">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 dark:bg-primary/20 border border-primary/20 flex items-center justify-center text-primary dark:text-primary-300 shrink-0">
                    <FileCode className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 id="fhir-modal-title" className="font-display font-extrabold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                        {t('common.fhir.title')}
                      </h2>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/25 text-[0.625rem] font-extrabold text-success dark:text-emerald-300 uppercase tracking-wider">
                        {t('common.fhir.transactionBadge')}
                      </span>
                    </div>
                    <p className="text-xs text-tertiary dark:text-slate-400 mt-0.5 truncate font-semibold">
                      {patientName ? (
                        <>
                          {t('common.fhir.patientPrefix')} <span className="text-slate-700 dark:text-slate-200 font-bold">{patientName}</span> •{' '}
                        </>
                      ) : null}
                      <span className="font-mono text-[0.6875rem]">{fileName}</span> ({fileSizeLabel})
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 min-h-0 p-3.5 sm:p-5 overflow-hidden flex flex-col gap-3.5">
              {/* 4-Tile Clinical Resource Summary Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 shrink-0">
                <div className="neu-flat-sm p-2.5 sm:p-3 rounded-xl border border-slate-200/60 dark:border-white/5 flex items-center gap-2.5">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-300 flex items-center justify-center font-extrabold text-xs shrink-0">
                    {resourceStats.patients}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[0.625rem] font-extrabold uppercase tracking-wider text-tertiary truncate">{t('common.fhir.tilePatient')}</p>
                    <p className="text-xs font-extrabold text-slate-800 dark:text-slate-100 truncate">{t('common.fhir.tileDemographics')}</p>
                  </div>
                </div>

                <div className="neu-flat-sm p-2.5 sm:p-3 rounded-xl border border-slate-200/60 dark:border-white/5 flex items-center gap-2.5">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-500/10 text-success dark:text-emerald-300 flex items-center justify-center font-extrabold text-xs shrink-0">
                    {resourceStats.observations}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[0.625rem] font-extrabold uppercase tracking-wider text-tertiary truncate">{t('common.fhir.tileObservations')}</p>
                    <p className="text-xs font-extrabold text-slate-800 dark:text-slate-100 truncate">{t('common.fhir.tileVitalSigns')}</p>
                  </div>
                </div>

                <div className="neu-flat-sm p-2.5 sm:p-3 rounded-xl border border-slate-200/60 dark:border-white/5 flex items-center gap-2.5">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-500/10 text-warning dark:text-amber-300 flex items-center justify-center font-extrabold text-xs shrink-0">
                    {resourceStats.clinical}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[0.625rem] font-extrabold uppercase tracking-wider text-tertiary truncate">{t('common.fhir.tileClinical')}</p>
                    <p className="text-xs font-extrabold text-slate-800 dark:text-slate-100 truncate">{t('common.fhir.tileConditions')}</p>
                  </div>
                </div>

                <div className="neu-flat-sm p-2.5 sm:p-3 rounded-xl border border-slate-200/60 dark:border-white/5 flex items-center gap-2.5">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-300 flex items-center justify-center font-extrabold text-xs shrink-0">
                    {resourceStats.documents}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[0.625rem] font-extrabold uppercase tracking-wider text-tertiary truncate">{t('common.fhir.tileAttachments')}</p>
                    <p className="text-xs font-extrabold text-slate-800 dark:text-slate-100 truncate">{t('common.fhir.tileDocuments')}</p>
                  </div>
                </div>
              </div>

              {/* Segmented Inspector Switcher + Quick Copy Button */}
              <div className="flex items-center justify-between gap-2 shrink-0">
                <div className="neu-inset p-1 rounded-xl inline-flex items-center gap-1 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setViewMode('json')}
                    className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      viewMode === 'json'
                        ? 'neu-pressed text-link font-extrabold shadow-inner'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {t('common.fhir.rawJson')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('resources')}
                    className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      viewMode === 'resources'
                        ? 'neu-pressed text-link font-extrabold shadow-inner'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {t('common.fhir.includedResources', { count: resourceStats.total })}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleCopy}
                  className="hidden sm:inline-flex neu-btn px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-link transition-all items-center gap-1.5 cursor-pointer active:scale-95 shrink-0"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-success stroke-[2.5]" /> : <Copy className="w-3.5 h-3.5 text-primary dark:text-primary-400" />}
                  <span>{copied ? t('common.actions.copied') : t('common.fhir.copyJson')}</span>
                </button>
              </div>

              {/* Inspector Content Area */}
              {viewMode === 'json' ? (
                <div className="neu-inset rounded-2xl overflow-hidden border border-slate-200/80 dark:border-white/10 flex-1 min-h-[11.25rem] flex flex-col">
                  {/* Code Header Toolbar */}
                  <div className="px-3.5 py-2 bg-slate-200/60 dark:bg-slate-800/70 border-b border-slate-300/60 dark:border-white/10 flex items-center justify-between text-[0.6875rem] font-mono text-slate-600 dark:text-slate-400 shrink-0">
                    <span>application/fhir+json • UTF-8</span>
                    <span>{t('common.fhir.linesCount', { count: jsonLines.length })}</span>
                  </div>

                  {/* Scrollable Code View */}
                  <div
                    tabIndex={0}
                    className="p-3 sm:p-4 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain select-text font-mono text-xs leading-relaxed outline-none focus:outline-none"
                    style={{
                      WebkitOverflowScrolling: 'touch',
                      contain: 'content',
                    }}
                  >
                    <pre className="text-slate-800 dark:text-slate-200 font-mono whitespace-pre-wrap break-words [word-break:break-word] text-xs leading-relaxed">
                      {json || t('common.fhir.noData')}
                    </pre>
                  </div>
                </div>
              ) : (
                <div
                  className="neu-inset rounded-2xl p-3 sm:p-4 flex-1 min-h-[11.25rem] overflow-y-auto overscroll-contain space-y-2 border border-slate-200/80 dark:border-white/10"
                  style={{ WebkitOverflowScrolling: 'touch' }}
                >
                  {resourceStats.list.length === 0 ? (
                    <div className="text-center py-8 text-xs font-semibold text-tertiary">
                      {t('common.fhir.noResources')}
                    </div>
                  ) : (
                    resourceStats.list.map((item) => {
                      const IconComponent =
                        item.type === 'Patient'
                          ? User
                          : item.type === 'Observation'
                            ? Pulse
                            : item.type === 'DocumentReference'
                              ? FileText
                              : Heartbeat;

                      return (
                        <div
                          key={item.id}
                          className="neu-flat-sm p-3 rounded-xl border border-slate-200/60 dark:border-white/5 flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-300 flex items-center justify-center shrink-0">
                              <IconComponent className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-extrabold text-slate-800 dark:text-slate-100 truncate">
                                {item.summary}
                              </p>
                              <p className="text-[0.6875rem] font-mono text-tertiary truncate">
                                {item.type}/{item.id}
                              </p>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded-md neu-inset text-[0.625rem] font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider shrink-0">
                            {item.type}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="px-4 sm:px-6 py-3 sm:py-3.5 border-t border-slate-200/70 dark:border-white/10 shrink-0">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-4">
                <div className="flex items-center gap-2 text-xs text-tertiary dark:text-slate-400 font-semibold">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-success dark:text-emerald-300 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[0.6875rem] sm:text-xs leading-snug">
                    {t('common.fhir.localNotice')}
                  </span>
                </div>

                <div className="grid grid-cols-5 sm:flex sm:items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="col-span-2 neu-btn px-3.5 py-2.5 rounded-xl font-bold text-xs text-slate-700 dark:text-slate-200 hover:text-link transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-sm"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-success stroke-[2.5]" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? t('common.actions.copied') : t('common.actions.copy')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownload}
                    className="col-span-3 neu-btn-primary px-4 sm:px-5 py-2.5 rounded-xl font-bold text-xs text-white transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 shadow-sm"
                  >
                    <DownloadSimple className="w-4 h-4 shrink-0" />
                    <span>{t('common.fhir.downloadJson')}</span>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default FhirExportModal;
