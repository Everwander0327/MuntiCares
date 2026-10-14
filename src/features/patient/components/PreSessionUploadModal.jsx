import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, Image, Trash2, CheckCircle2, Loader2, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

const CHECKLIST_ITEMS = [
  { key: 'id', label: 'Prepare your medical ID or identification card' },
  { key: 'medications', label: 'List your current medications and dosages' },
  { key: 'insurance', label: 'Have your insurance card ready' },
  { key: 'questions', label: 'Prepare questions for your provider' },
  { key: 'space', label: 'Clear a space in your home for the visit' },
  { key: 'companion', label: 'Ensure a family member or friend can be present' },
];

const loadChecklist = (requestId) => {
  try {
    return JSON.parse(localStorage.getItem(`presession_checklist_${requestId}`) || '{}');
  } catch { return {}; }
};

const saveChecklist = (requestId, checklist) => {
  localStorage.setItem(`presession_checklist_${requestId}`, JSON.stringify(checklist));
};

const PreSessionUploadModal = ({ isOpen, onClose, request }) => {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [symptomNotes, setSymptomNotes] = useState('');
  const [vitals, setVitals] = useState({
    bp: '',
    temp: '',
    hr: '',
    weight: ''
  });
  const [checklist, setChecklist] = useState({});
  const fileInputRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    if (isOpen) {
      document.body.classList.add('modal-open');
      window.addEventListener('keydown', handleKeyDown);
      if (request?.id) {
        setChecklist(loadChecklist(request.id));
      }
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => {
      document.body.classList.remove('modal-open');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, request?.id]);

  const handleFileSelect = (e) => {
    const selected = Array.from(e.target.files);
    if (files.length + selected.length > 5) {
      toast.error('Maximum 5 files allowed.');
      return;
    }
    setFiles(prev => [...prev, ...selected]);
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = (file) => {
    if (file.type.startsWith('image/')) return <Image className="w-4 h-4 text-primary shrink-0" />;
    return <FileText className="w-4 h-4 text-primary shrink-0" />;
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUploading(true);

    try {
      const uploadedUrls = [];

      // 1. Upload files to Supabase Storage
      for (const file of files) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${request.patientId || 'patient'}/${request.id}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('medical_documents')
          .upload(fileName, file);

        if (uploadError) {
          console.warn('Storage upload failed:', uploadError);
          continue;
        }

        uploadedUrls.push(fileName);
      }

      // 2. Append pre-session data to the request notes
      const notesSummary = [
        symptomNotes ? `[Pre-session Symptoms] ${symptomNotes}` : '',
        vitals.bp ? `BP: ${vitals.bp}` : '',
        vitals.temp ? `Temp: ${vitals.temp}°C` : '',
        vitals.hr ? `HR: ${vitals.hr} bpm` : '',
        vitals.weight ? `Weight: ${vitals.weight} kg` : '',
        uploadedUrls.length > 0 ? `[${uploadedUrls.length} file(s) uploaded]` : ''
      ].filter(Boolean).join(' | ');

      if (notesSummary) {
        const { data: currentReq } = await supabase
          .from('requests')
          .select('notes')
          .eq('id', request.id)
          .single();

        const existingNotes = currentReq?.notes || '';
        await supabase
          .from('requests')
          .update({ notes: existingNotes ? `${existingNotes}\n${notesSummary}` : notesSummary })
          .eq('id', request.id);
      }

      toast.success('Pre-session info submitted successfully!');
      
      // Mark as submitted in localStorage
      const submitted = JSON.parse(localStorage.getItem('presession_submitted') || '{}');
      submitted[request.id] = true;
      localStorage.setItem('presession_submitted', JSON.stringify(submitted));

      onClose();
    } catch (err) {
      console.error('Error submitting pre-session data:', err);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && request && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="neu-flat w-full max-w-lg rounded-t-[2.25rem] sm:rounded-[2.25rem] p-5 sm:p-7 pb-[max(1.5rem,env(safe-area-inset-bottom))] space-y-4 shadow-2xl border-t sm:border border-white/60 dark:border-white/10 max-h-[92dvh] overflow-y-auto no-scrollbar transform-gpu will-change-transform"
          >
            {/* Mobile handle indicator */}
            <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700 sm:hidden" aria-hidden="true" />

            {/* Header */}
            <div className="text-center space-y-1">
              <h2 className="text-base sm:text-xl md:text-2xl font-display font-extrabold text-slate-900 dark:text-white tracking-tight">
                Pre-Session Information
              </h2>
              <p className="text-2xs sm:text-xs text-slate-500 dark:text-slate-400">
                Help <span className="font-extrabold text-primary">{request.providerName}</span> prepare for your home visit
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {/* Preparation Checklist */}
              <div className="space-y-1.5">
                <span className="text-3xs font-extrabold uppercase tracking-wider text-slate-400">Preparation Checklist</span>
                <div className="neu-flat-sm p-3 sm:p-3.5 rounded-2xl space-y-1.5">
                  {CHECKLIST_ITEMS.map(item => {
                    const isChecked = !!checklist[item.key];
                    return (
                      <button
                        type="button"
                        key={item.key}
                        onClick={() => {
                          setChecklist(prev => {
                            const next = { ...prev, [item.key]: !prev[item.key] };
                            saveChecklist(request.id, next);
                            return next;
                          });
                        }}
                        className="w-full flex items-center gap-2.5 py-1 text-left cursor-pointer select-none group"
                      >
                        <div
                          className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                            isChecked
                              ? 'neu-btn bg-emerald-500 text-white font-black'
                              : 'neu-inset text-transparent'
                          }`}
                        >
                          {isChecked && <Check className="w-3.5 h-3.5 stroke-[3] text-emerald-600 dark:text-emerald-400" />}
                        </div>
                        <span className={`text-xs transition-colors ${isChecked ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-700 dark:text-slate-200 font-medium'}`}>
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Self-Measured Vitals */}
              <div className="space-y-1.5">
                <span className="text-3xs font-extrabold uppercase tracking-wider text-slate-400">Self-Measured Vitals (Optional)</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="space-y-1">
                    <label className="text-3xs font-bold text-slate-500 dark:text-slate-400">BP (mmHg)</label>
                    <div className="neu-inset p-2 rounded-xl">
                      <input
                        type="text"
                        placeholder="120/80"
                        value={vitals.bp}
                        onChange={e => setVitals({ ...vitals, bp: e.target.value })}
                        className="w-full bg-transparent border-0 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none placeholder:text-slate-400 placeholder:font-normal"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-3xs font-bold text-slate-500 dark:text-slate-400">Temp (°C)</label>
                    <div className="neu-inset p-2 rounded-xl">
                      <input
                        type="text"
                        placeholder="36.5"
                        value={vitals.temp}
                        onChange={e => setVitals({ ...vitals, temp: e.target.value })}
                        className="w-full bg-transparent border-0 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none placeholder:text-slate-400 placeholder:font-normal"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-3xs font-bold text-slate-500 dark:text-slate-400">Heart Rate</label>
                    <div className="neu-inset p-2 rounded-xl">
                      <input
                        type="text"
                        placeholder="72 bpm"
                        value={vitals.hr}
                        onChange={e => setVitals({ ...vitals, hr: e.target.value })}
                        className="w-full bg-transparent border-0 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none placeholder:text-slate-400 placeholder:font-normal"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-3xs font-bold text-slate-500 dark:text-slate-400">Weight (kg)</label>
                    <div className="neu-inset p-2 rounded-xl">
                      <input
                        type="text"
                        placeholder="65 kg"
                        value={vitals.weight}
                        onChange={e => setVitals({ ...vitals, weight: e.target.value })}
                        className="w-full bg-transparent border-0 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none placeholder:text-slate-400 placeholder:font-normal"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Symptom Notes */}
              <div className="space-y-1">
                <label className="text-3xs font-extrabold uppercase tracking-wider text-slate-400">Current Symptoms or Concerns</label>
                <div className="neu-inset p-2.5 rounded-xl">
                  <textarea
                    value={symptomNotes}
                    onChange={e => setSymptomNotes(e.target.value)}
                    placeholder="Describe what you're experiencing — headache, fever, dizziness, etc..."
                    rows={2}
                    className="w-full bg-transparent border-0 text-xs font-medium text-slate-800 dark:text-slate-100 outline-none resize-none placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* File Upload */}
              <div className="space-y-1.5">
                <label className="text-3xs font-extrabold uppercase tracking-wider text-slate-400">
                  Attach Photos / Documents (Max 5)
                </label>
                
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
                  disabled={files.length >= 5}
                  className="w-full neu-inset p-3.5 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed group"
                >
                  <div className="neu-btn w-8 h-8 rounded-xl flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                    <Upload className="w-4 h-4" />
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-200 font-bold">Tap to upload photos or medical documents</p>
                  <p className="text-3xs text-slate-400">JPG, PNG, PDF • Max 5 files</p>
                </button>

                {/* File Preview List */}
                {files.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {files.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2.5 neu-flat-sm rounded-xl">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {getFileIcon(file)}
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{file.name}</p>
                            <p className="text-3xs text-slate-400">{formatFileSize(file.size)}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(idx)}
                          className="neu-btn p-1.5 rounded-lg text-slate-400 hover:text-red-500 transition-colors shrink-0 cursor-pointer"
                          title="Remove file"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom Actions */}
              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={uploading}
                  className="w-full py-2.5 sm:py-3 neu-btn rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="w-full py-2.5 sm:py-3 neu-btn-primary rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-1.5 transition-transform active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {uploading ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading...</>
                  ) : (
                    <><CheckCircle2 className="w-3.5 h-3.5" /> Submit Info</>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default PreSessionUploadModal;
