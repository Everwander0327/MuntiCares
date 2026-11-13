import { useState, useRef, useEffect } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Upload,
  Trash2,
  CheckCircle2,
  Loader2,
  Check,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import useBodyScrollLock from '@/hooks/useBodyScrollLock';
import useBottomDrawerDrag from '@/hooks/useBottomDrawerDrag';
import { markPresessionSubmitted } from '@/features/patient/utils/localState';
import { buildPreSessionNotesSummary, mergePreSessionNotes } from '@/features/patient/utils/preSessionNotes';

const CHECKLIST_ITEMS = [
  { key: 'id', label: 'Prepare your medical ID or identification card' },
  { key: 'medications', label: 'List your current medications and dosages' },
  { key: 'insurance', label: 'Have your insurance card ready' },
  { key: 'questions', label: 'Prepare questions for your provider' },
  { key: 'space', label: 'Clear a space in your home for the visit' },
  { key: 'companion', label: 'Ensure a family member or friend can be present' },
];

const VITAL_FIELDS = [
  { key: 'bp', id: 'previsit-bp', label: 'Blood Pressure', placeholder: '120/80', unit: 'mmHg', inputMode: 'text' },
  { key: 'temp', id: 'previsit-temp', label: 'Temperature', placeholder: '36.5', unit: '°C', inputMode: 'decimal' },
  { key: 'hr', id: 'previsit-hr', label: 'Heart Rate', placeholder: '72', unit: 'bpm', inputMode: 'numeric' },
  { key: 'weight', id: 'previsit-weight', label: 'Weight', placeholder: '65', unit: 'kg', inputMode: 'decimal' },
];

const QUICK_SYMPTOMS = [
  'Fever',
  'Headache',
  'Dizziness',
  'Pain / swelling',
  'Cough',
  'Fatigue',
];

const EMPTY_VITALS = { bp: '', temp: '', hr: '', weight: '' };

const getProviderInitials = (name) => {
  const parts = String(name || 'MuntiCares').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'MC';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const loadChecklist = (requestId) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(`presession_checklist_${requestId}`) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const saveChecklist = (requestId, checklist) => {
  try {
    localStorage.setItem(`presession_checklist_${requestId}`, JSON.stringify(checklist));
  } catch {
    // Ignore storage quota / private mode failures gracefully.
  }
};

const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

const getFileBadge = (file) => {
  if (file.type?.startsWith('image/')) {
    return {
      label: 'IMG',
      className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    };
  }
  const isPdf = file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf');
  return {
    label: isPdf ? 'PDF' : 'DOC',
    className: 'bg-primary/12 dark:bg-primary-400/15 text-link dark:text-primary-400',
  };
};

const getInitialSessionState = (open, requestId) => {
  if (!open || !requestId) return { checklist: {}, tab: 'checklist' };
  const checklist = loadChecklist(requestId);
  const allReady = CHECKLIST_ITEMS.every((item) => !!checklist[item.key]);
  return { checklist, tab: allReady ? 'intake' : 'checklist' };
};

const PreSessionUploadModal = ({ isOpen, onClose, request }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(
    () => getInitialSessionState(isOpen, request?.id).tab,
  ); // 'checklist' | 'intake'
  const [navDir, setNavDir] = useState('right');
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [symptomNotes, setSymptomNotes] = useState('');
  const [vitals, setVitals] = useState(EMPTY_VITALS);
  const [checklist, setChecklist] = useState(
    () => getInitialSessionState(isOpen, request?.id).checklist,
  );
  const [formError, setFormError] = useState('');
  const fileInputRef = useRef(null);
  const prevRequestIdRef = useRef(request?.id || null);
  const prefersReducedMotion = useReducedMotion();

  useBodyScrollLock(Boolean(isOpen && request));
  const { drawerMotionProps, dragHandleProps } = useBottomDrawerDrag({
    onClose,
    disabled: uploading,
  });

  useEffect(() => {
    if (!isOpen || !request?.id) return;

    const { checklist: loaded, tab } = getInitialSessionState(true, request.id);
    setChecklist(loaded);
    setFormError('');

    if (prevRequestIdRef.current !== request.id) {
      prevRequestIdRef.current = request.id;
      setFiles([]);
      setSymptomNotes('');
      setVitals(EMPTY_VITALS);
    }

    setNavDir('right');
    setActiveTab(tab);
  }, [isOpen, request?.id]);

  const switchTab = (nextTab) => {
    if (nextTab === activeTab) return;
    setNavDir(nextTab === 'intake' ? 'right' : 'left');
    setFormError('');
    setActiveTab(nextTab);
  };

  const handleToggleChecklistItem = (key) => {
    if (!request?.id) return;
    setChecklist((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      saveChecklist(request.id, next);
      return next;
    });
  };

  const handleToggleAllChecklist = () => {
    if (!request?.id) return;
    const allChecked = CHECKLIST_ITEMS.every((item) => !!checklist[item.key]);
    const next = {};
    CHECKLIST_ITEMS.forEach((item) => {
      next[item.key] = !allChecked;
    });
    setChecklist(next);
    saveChecklist(request.id, next);
  };

  const handleVitalChange = (key, value) => {
    setFormError('');
    setVitals((prev) => ({ ...prev, [key]: value }));
  };

  const handleSymptomChange = (value) => {
    setFormError('');
    setSymptomNotes(value);
  };

  const toggleQuickSymptom = (chip) => {
    setFormError('');
    setSymptomNotes((prev) => {
      const parts = prev
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const exists = parts.some((p) => p.toLowerCase() === chip.toLowerCase());
      if (exists) {
        return parts.filter((p) => p.toLowerCase() !== chip.toLowerCase()).join(', ');
      }
      return parts.length > 0 ? `${parts.join(', ')}, ${chip}` : chip;
    });
  };

  const handleFileSelect = (e) => {
    const selected = Array.from(e.target.files || []);
    e.target.value = '';
    if (selected.length === 0) return;

    if (files.length + selected.length > 5) {
      toast.error('Maximum 5 files allowed.');
      return;
    }

    setFormError('');
    setFiles((prev) => [...prev, ...selected]);
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const hasVitals = Object.values(vitals).some((v) => v && v.trim() !== '');
    const hasSymptoms = symptomNotes.trim() !== '';
    const hasFiles = files.length > 0;

    if (!hasVitals && !hasSymptoms && !hasFiles) {
      const msg = 'Add at least one vital, symptom note, or file — your checklist saves automatically.';
      setFormError(msg);
      toast.error(msg);
      return;
    }

    setFormError('');
    setUploading(true);

    try {
      const uploadedUrls = [];
      const failedUploads = [];
      const failedDocRows = [];

      // 1. Upload files to Supabase Storage
      for (const file of files) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${request.patientId || 'patient'}/${request.id}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('medical_documents')
          .upload(fileName, file);

        if (uploadError) {
          console.warn('Storage upload failed:', uploadError);
          failedUploads.push(file.name);
          continue;
        }

        uploadedUrls.push(fileName);

        if (request.patientId) {
          const { error: docError } = await supabase
            .from('patient_documents')
            .insert([{
              patient_id: request.patientId,
              document_title: `[Pre-Session] ${file.name}`,
              file_path: fileName,
            }]);
          if (docError) {
            console.warn('patient_documents row not created:', docError);
            failedDocRows.push(file.name);
          }
        }
      }

      // Nothing was attached and nothing was typed: do not claim success.
      if (files.length > 0 && uploadedUrls.length === 0) {
        toast.error('Your files could not be uploaded. Check your connection and try again.');
        return;
      }

      // 2. Append pre-session data to the request notes
      const notesSummary = buildPreSessionNotesSummary({
        symptomNotes,
        vitals,
        uploadedCount: uploadedUrls.length,
      });

      if (notesSummary) {
        const { data: currentReq, error: fetchError } = await supabase
          .from('requests')
          .select('notes')
          .eq('id', request.id)
          .single();

        if (fetchError) throw fetchError;

        const { error: notesError } = await supabase
          .from('requests')
          .update({ notes: mergePreSessionNotes(currentReq?.notes || '', notesSummary) })
          .eq('id', request.id);

        if (notesError) throw notesError;
      }

      if (failedUploads.length > 0) {
        toast.error(`${failedUploads.length} file(s) were not uploaded.`);
      } else if (failedDocRows.length > 0) {
        toast('Some files were uploaded but could not be saved to your document list.', { icon: '⚠️' });
      } else {
        toast.success('Pre-session info submitted successfully!');
      }

      markPresessionSubmitted(user?.id, request.id);

      setFiles([]);
      setSymptomNotes('');
      setVitals(EMPTY_VITALS);
      setFormError('');
      onClose();
    } catch (err) {
      console.error('Error submitting pre-session data:', err);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  if (!request) return null;

  const checkedCount = CHECKLIST_ITEMS.filter((item) => !!checklist[item.key]).length;
  const checklistPct = Math.round((checkedCount / CHECKLIST_ITEMS.length) * 100);
  const allChecklistDone = checkedCount === CHECKLIST_ITEMS.length;
  const hasVitals = Object.values(vitals).some((v) => v && v.trim() !== '');
  const hasSubmittableData = hasVitals || symptomNotes.trim() !== '' || files.length > 0;
  const lowerSymptoms = symptomNotes.toLowerCase();
  const slideOffset = prefersReducedMotion ? 0 : navDir === 'left' ? -20 : 20;
  const providerLabel = request.providerName || 'Provider';

  return (
    <DialogPrimitive.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !uploading) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-overlay bg-slate-950/70 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          asChild
          aria-modal="true"
          onInteractOutside={(event) => {
            if (uploading) event.preventDefault();
          }}
        >
          <motion.div
            className="fixed inset-0 z-overlay flex items-end sm:items-center justify-center p-0 sm:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.16 }}
            onClick={() => {
              if (!uploading) onClose();
            }}
          >
            <motion.div
              className="neu-flat rounded-t-[2rem] sm:rounded-[2rem] w-full max-w-lg flex flex-col relative max-h-[92dvh] overflow-hidden shadow-2xl border-t sm:border border-white/70 dark:border-white/10"
              initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 42, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              {...drawerMotionProps}
            >
              {/* Sticky Sheet Header + 2-Tab Switcher */}
              <div
                className="shrink-0 px-4 sm:px-6 pt-3 sm:pt-5 pb-3 border-b border-slate-200/75 dark:border-white/10 space-y-3 cursor-grab sm:cursor-auto active:cursor-grabbing sm:active:cursor-auto"
                {...dragHandleProps}
              >
                <div
                  className="mx-auto h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-600 sm:hidden"
                  aria-hidden="true"
                />

                <div className="flex items-center gap-3 min-w-0">
                  <div className="neu-flat-sm w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center font-black shrink-0 aspect-square border text-link dark:text-primary-400 border-white/80 dark:border-white/10">
                    <span className="text-xs sm:text-sm font-black">
                      {getProviderInitials(providerLabel)}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <DialogPrimitive.Title asChild>
                      <h2 className="text-base sm:text-lg font-display font-extrabold text-slate-900 dark:text-white leading-tight truncate">
                        Pre-Session Information
                      </h2>
                    </DialogPrimitive.Title>
                    <DialogPrimitive.Description className="sr-only">
                      Complete your visit preparation checklist and optionally share vitals, symptoms, or documents with {providerLabel}.
                    </DialogPrimitive.Description>
                    <p className="text-xs text-tertiary dark:text-tertiary truncate mt-0.5">
                      For{' '}
                      <span className="font-extrabold text-link dark:text-primary-400">
                        {providerLabel}
                      </span>
                      {request.service ? ` • ${request.service}` : ' • Home visit'}
                    </p>
                  </div>
                </div>

                {/* Sliding Pill 2-Tab Switcher */}
                <div
                  role="tablist"
                  aria-label="Pre-session sections"
                  className="relative neu-inset p-1 rounded-xl grid grid-cols-2 border border-white/60 dark:border-white/5"
                >
                  <motion.div
                    aria-hidden="true"
                    className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-lg bg-primary dark:bg-primary-400 shadow-sm"
                    initial={false}
                    animate={{ x: activeTab === 'checklist' ? '0%' : '100%' }}
                    transition={{ duration: prefersReducedMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
                  />
                  <button
                    type="button"
                    id="presession-tab-checklist"
                    role="tab"
                    aria-controls="presession-panel-checklist"
                    aria-selected={activeTab === 'checklist'}
                    onClick={() => switchTab('checklist')}
                    className={`relative z-10 min-h-[36px] py-1.5 px-2 rounded-lg text-xs font-extrabold transition-colors cursor-pointer select-none tabular-nums ${
                      activeTab === 'checklist'
                        ? 'text-white dark:text-[#08182A]'
                        : 'text-slate-600 dark:text-slate-300 hover:text-link dark:hover:text-primary-400'
                    }`}
                  >
                    1. Prep ({checkedCount}/{CHECKLIST_ITEMS.length})
                  </button>
                  <button
                    type="button"
                    id="presession-tab-intake"
                    role="tab"
                    aria-controls="presession-panel-intake"
                    aria-selected={activeTab === 'intake'}
                    onClick={() => switchTab('intake')}
                    className={`relative z-10 min-h-[36px] py-1.5 px-2 rounded-lg text-xs font-extrabold transition-colors cursor-pointer select-none flex items-center justify-center gap-1.5 ${
                      activeTab === 'intake'
                        ? 'text-white dark:text-[#08182A]'
                        : 'text-slate-600 dark:text-slate-300 hover:text-link dark:hover:text-primary-400'
                    }`}
                  >
                    <span>2. Vitals &amp; Docs</span>
                    {hasSubmittableData && (
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          activeTab === 'intake'
                            ? 'bg-emerald-300 dark:bg-emerald-700'
                            : 'bg-emerald-500'
                        }`}
                        aria-hidden="true"
                      />
                    )}
                  </button>
                </div>
              </div>

              <AnimatePresence mode="wait" initial={false}>
                {activeTab === 'checklist' ? (
                  <motion.div
                    key="checklist"
                    id="presession-panel-checklist"
                    role="tabpanel"
                    aria-labelledby="presession-tab-checklist"
                    initial={prefersReducedMotion ? false : { opacity: 0, x: slideOffset }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -slideOffset }}
                    transition={{ duration: prefersReducedMotion ? 0 : 0.18, ease: [0.22, 1, 0.36, 1] }}
                    className="flex-1 min-h-0 flex flex-col"
                  >
                    <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4 space-y-3">
                      {/* Checklist Progress Card */}
                      <div className="neu-inset rounded-2xl p-3.5 space-y-2.5 border border-white/60 dark:border-white/5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <span className="text-2xs font-extrabold uppercase tracking-wider text-tertiary block leading-none">
                              Before Provider Arrives
                            </span>
                            <p className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white mt-1 tabular-nums">
                              {checkedCount} of {CHECKLIST_ITEMS.length} tasks ready
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={handleToggleAllChecklist}
                            className="neu-btn min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-extrabold text-link dark:text-primary-400 shrink-0 cursor-pointer active:scale-95 transition-transform"
                          >
                            {allChecklistDone ? 'Clear all' : 'Mark all ready'}
                          </button>
                        </div>

                        <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                            style={{ width: `${checklistPct}%` }}
                          />
                        </div>

                        <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                          Saved automatically on your device as you check items.
                        </p>
                      </div>

                      {/* Checklist Items */}
                      <div className="space-y-1.5">
                        {CHECKLIST_ITEMS.map((item) => {
                          const isChecked = !!checklist[item.key];
                          return (
                            <button
                              key={item.key}
                              type="button"
                              aria-pressed={isChecked}
                              onClick={() => handleToggleChecklistItem(item.key)}
                              className={`w-full min-h-[46px] px-3.5 py-2.5 rounded-xl flex items-center gap-3 text-left transition-all cursor-pointer select-none active:scale-[0.99] ${
                                isChecked
                                  ? 'bg-emerald-500/10 border border-emerald-500/25'
                                  : 'neu-flat-sm border border-white/75 dark:border-white/5 hover:border-primary/40 dark:hover:border-primary-400/40'
                              }`}
                            >
                              <span
                                className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                                  isChecked
                                    ? 'bg-emerald-600 text-white shadow-sm'
                                    : 'neu-inset text-transparent'
                                }`}
                              >
                                {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                              </span>
                              <span
                                className={`text-xs sm:text-[13px] flex-1 leading-snug transition-colors ${
                                  isChecked
                                    ? 'text-tertiary dark:text-tertiary line-through'
                                    : 'text-slate-800 dark:text-slate-100 font-semibold'
                                }`}
                              >
                                {item.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Sticky Checklist Footer */}
                    <div className="shrink-0 px-4 sm:px-6 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] border-t border-slate-200/75 dark:border-white/10 bg-surface-shell/95 backdrop-blur-md space-y-2">
                      <button
                        type="button"
                        onClick={() => switchTab('intake')}
                        className="w-full neu-btn-primary min-h-[46px] py-3 px-4 rounded-xl text-xs sm:text-sm font-extrabold shadow-md flex items-center justify-center gap-2 active:scale-[0.98] transition-transform cursor-pointer"
                      >
                        <span>Add Vitals, Symptoms &amp; Files</span>
                        <ArrowRight className="w-4 h-4 shrink-0" />
                      </button>
                      <button
                        type="button"
                        onClick={onClose}
                        className="w-full min-h-[42px] py-2 px-4 rounded-xl text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/40 dark:hover:bg-white/5 transition-colors cursor-pointer"
                      >
                        I&apos;ll finish later
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.form
                    key="intake"
                    id="presession-panel-intake"
                    role="tabpanel"
                    aria-labelledby="presession-tab-intake"
                    onSubmit={handleSubmit}
                    initial={prefersReducedMotion ? false : { opacity: 0, x: slideOffset }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -slideOffset }}
                    transition={{ duration: prefersReducedMotion ? 0 : 0.18, ease: [0.22, 1, 0.36, 1] }}
                    className="flex-1 min-h-0 flex flex-col"
                  >
                    <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
                      {/* Self-Measured Vitals (2x2 Grid with Inline Unit Badges) */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-2xs font-extrabold uppercase tracking-wider text-tertiary">
                            Self-Measured Vitals (Optional)
                          </span>
                          <span className="text-[11px] font-semibold text-tertiary">
                            Units added automatically
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2.5">
                          {VITAL_FIELDS.map((field) => (
                            <div key={field.key} className="space-y-1">
                              <label
                                htmlFor={field.id}
                                className="text-xs font-bold text-slate-700 dark:text-slate-200 block"
                              >
                                {field.label}
                              </label>
                              <div className="neu-inset rounded-xl px-2.5 min-h-[44px] flex items-center justify-between gap-1.5 border border-white/60 dark:border-white/5 focus-within:ring-2 focus-within:ring-primary/30 dark:focus-within:ring-primary-400/35">
                                <input
                                  id={field.id}
                                  type="text"
                                  inputMode={field.inputMode}
                                  placeholder={field.placeholder}
                                  value={vitals[field.key]}
                                  onChange={(e) => handleVitalChange(field.key, e.target.value)}
                                  className="w-full min-w-0 bg-transparent border-0 text-base sm:text-xs font-extrabold text-slate-900 dark:text-white outline-none placeholder:text-tertiary/70 placeholder:font-medium tabular-nums"
                                />
                                <span className="text-[11px] font-extrabold text-link dark:text-primary-400 bg-primary/10 dark:bg-primary-400/15 px-1.5 py-0.5 rounded-md shrink-0">
                                  {field.unit}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Symptoms or Concerns with Quick-Tap Pills */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <label
                            htmlFor="previsit-symptoms"
                            className="text-2xs font-extrabold uppercase tracking-wider text-tertiary"
                          >
                            Current Symptoms or Concerns
                          </label>
                          <span className="text-[11px] font-semibold text-tertiary">
                            Tap pills or type
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {QUICK_SYMPTOMS.map((sym) => {
                            const isActive = lowerSymptoms.includes(sym.toLowerCase());
                            return (
                              <button
                                key={sym}
                                type="button"
                                aria-pressed={isActive}
                                onClick={() => toggleQuickSymptom(sym)}
                                className={`min-h-[34px] px-3 py-1 rounded-full text-xs font-bold border transition-all cursor-pointer active:scale-95 ${
                                  isActive
                                    ? 'bg-primary text-white border-primary dark:bg-primary-400 dark:text-[#08182A] dark:border-primary-400 shadow-sm'
                                    : 'neu-flat-sm text-slate-700 dark:text-slate-200 border-white/75 dark:border-white/5 hover:border-primary/40 dark:hover:border-primary-400/40'
                                }`}
                              >
                                {isActive ? `✓ ${sym}` : `+ ${sym}`}
                              </button>
                            );
                          })}
                        </div>

                        <div className="neu-inset rounded-2xl p-3 border border-white/60 dark:border-white/5 focus-within:ring-2 focus-within:ring-primary/30 dark:focus-within:ring-primary-400/35">
                          <textarea
                            id="previsit-symptoms"
                            value={symptomNotes}
                            onChange={(e) => handleSymptomChange(e.target.value)}
                            placeholder="Any pain level, onset time, or medication notes..."
                            rows={2}
                            className="w-full bg-transparent border-0 text-base sm:text-xs font-medium text-slate-800 dark:text-slate-100 outline-none resize-none placeholder:text-tertiary/80"
                          />
                        </div>
                      </div>

                      {/* Photos & Medical Documents */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-2xs font-extrabold uppercase tracking-wider text-tertiary">
                            Photos / Medical Docs
                          </span>
                          <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 tabular-nums">
                            {files.length} / 5 files
                          </span>
                        </div>

                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          accept="image/*,.pdf,.doc,.docx"
                          onChange={handleFileSelect}
                          className="hidden"
                        />

                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={files.length >= 5 || uploading}
                          className="w-full neu-inset p-3.5 rounded-2xl border-2 border-dashed border-primary/30 dark:border-primary-400/30 flex items-center gap-3 text-left transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed hover:border-primary dark:hover:border-primary-400 group active:scale-[0.99]"
                        >
                          <div className="neu-btn w-11 h-11 rounded-xl flex items-center justify-center text-link dark:text-primary-400 shrink-0 group-hover:scale-105 transition-transform">
                            <Upload className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-extrabold text-slate-800 dark:text-white leading-tight">
                              {files.length >= 5
                                ? 'Maximum 5 files reached'
                                : 'Tap to upload photos or medical documents'}
                            </p>
                            <p className="text-[11px] text-tertiary mt-0.5">
                              Lab results, Rx, wound photo &bull; JPG, PNG, PDF
                            </p>
                          </div>
                        </button>

                        {files.length > 0 && (
                          <div className="space-y-1.5 pt-0.5">
                            {files.map((file, idx) => {
                              const badge = getFileBadge(file);
                              return (
                                <div
                                  key={`${file.name}-${file.size}-${idx}`}
                                  className="neu-flat-sm rounded-xl px-3 py-2 flex items-center justify-between gap-2.5 border border-white/75 dark:border-white/5"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <span
                                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-black uppercase ${badge.className}`}
                                    >
                                      {badge.label}
                                    </span>
                                    <div className="min-w-0">
                                      <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                                        {file.name}
                                      </p>
                                      <p className="text-[11px] text-tertiary tabular-nums">
                                        {formatFileSize(file.size)}
                                      </p>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    disabled={uploading}
                                    onClick={() => removeFile(idx)}
                                    aria-label={`Remove ${file.name}`}
                                    title="Remove file"
                                    className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-tertiary hover:text-danger dark:hover:text-red-400 hover:bg-danger/10 transition-colors shrink-0 cursor-pointer disabled:opacity-40"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {formError && (
                        <div
                          role="alert"
                          className="p-3 rounded-xl bg-danger/10 border border-danger/25 flex items-start gap-2 text-xs font-bold text-danger dark:text-red-300"
                        >
                          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                          <span>{formError}</span>
                        </div>
                      )}
                    </div>

                    {/* Sticky Intake Footer */}
                    <div className="shrink-0 px-4 sm:px-6 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] border-t border-slate-200/75 dark:border-white/10 bg-surface-shell/95 backdrop-blur-md">
                      <div className="grid grid-cols-[108px_1fr] sm:grid-cols-[120px_1fr] gap-2.5">
                        <button
                          type="button"
                          disabled={uploading}
                          onClick={() => switchTab('checklist')}
                          className="w-full neu-btn min-h-[46px] py-3 px-3 rounded-xl text-xs font-extrabold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50"
                        >
                          <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
                          <span>Checklist</span>
                        </button>
                        <button
                          type="submit"
                          disabled={uploading}
                          className="w-full neu-btn-primary min-h-[46px] py-3 px-4 rounded-xl text-xs sm:text-sm font-extrabold shadow-md flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform disabled:opacity-50 cursor-pointer"
                        >
                          {uploading ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                              <span>Sending...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4 shrink-0" />
                              <span className="truncate">
                                {files.length > 0
                                  ? `Send Info & ${files.length} File${files.length > 1 ? 's' : ''}`
                                  : `Send to ${providerLabel}`}
                              </span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

export default PreSessionUploadModal;
