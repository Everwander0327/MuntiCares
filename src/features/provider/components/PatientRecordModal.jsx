import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Activity, FileText, ClipboardList, Send, Loader2, ExternalLink, 
  Trash2, Paperclip, HeartPulse, ShieldAlert, AlertCircle, 
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import { EmptyState } from '@/shared/ui';
import { motion } from 'framer-motion';

const PatientRecordModal = ({ isOpen, onClose, patientId, patientName }) => {
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState('history');
  const [loading, setLoading] = useState(true);
  const [consentBlocked, setConsentBlocked] = useState(false);
  const [grantedPermissions, setGrantedPermissions] = useState(null);

  // Data States
  const [history, setHistory] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [notes, setNotes] = useState([]);
  const [notesPage, setNotesPage] = useState(1);
  const NOTES_PER_PAGE = 5;

  // New Note State
  const [newNote, setNewNote] = useState({ 
    bp: '', temp: '', hr: '', rr: '', spo2: '', 
    pain: '', services: [], text: '', file: null 
  });
  const [savingNote, setSavingNote] = useState(false);

  const availableServices = ['Routine Checkup', 'Wound Care', 'IV Therapy', 'Physical Therapy', 'Medication Admin'];

  const checkConsentThenLoad = useCallback(async () => {
    setLoading(true);
    setConsentBlocked(false);
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('consent_access')
        .select('is_enabled, permissions')
        .eq('patient_id', patientId)
        .eq('provider_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (!data || !data.is_enabled) {
        setConsentBlocked(true);
        setLoading(false);
        return;
      }

      const perms = data.permissions || { medical_history: true, documents: true, visit_notes: true };
      setGrantedPermissions(perms);
      if (perms.medical_history === false) {
        setActiveTab(perms.documents !== false ? 'documents' : 'notes');
      }
      fetchPatientData();
      logDataAccess();
    } catch (err) {
      console.warn('Consent check failed:', err.message);
      setGrantedPermissions({ medical_history: true, documents: true, visit_notes: true });
      fetchPatientData();
      logDataAccess();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, user]);

  useEffect(() => {
    if (isOpen && patientId) {
      checkConsentThenLoad();
    }
  }, [isOpen, patientId, checkConsentThenLoad]);

  useEffect(() => {
    if (!isOpen || !patientId || !user) return;

    const pollConsent = async () => {
      const { data } = await supabase
        .from('consent_access')
        .select('is_enabled, permissions')
        .eq('patient_id', patientId)
        .eq('provider_id', user.id)
        .single();

      if (!data) return;
      if (!data.is_enabled) {
        setConsentBlocked(true);
        setGrantedPermissions(null);
      } else {
        const perms = data.permissions || { medical_history: true, documents: true, visit_notes: true };
        setConsentBlocked(false);
        setGrantedPermissions(perms);
        setActiveTab(curr => {
          const tabPerms = {
            history: perms.medical_history !== false,
            documents: perms.documents !== false,
            notes: perms.visit_notes !== false,
          };
          if (!tabPerms[curr]) {
            const fallback = ['history', 'documents', 'notes'].find(t => tabPerms[t]);
            return fallback || curr;
          }
          return curr;
        });
      }
    };

    const channel = supabase
      .channel(`consent-realtime-${patientId}-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'consent_access',
        filter: `patient_id=eq.${patientId}`,
      }, () => { pollConsent(); })
      .subscribe();

    const interval = setInterval(pollConsent, 2000);

    return () => { clearInterval(interval); supabase.removeChannel(channel); };
  }, [isOpen, patientId, user]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    if (isOpen) {
      document.body.classList.add('modal-open');
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => {
      document.body.classList.remove('modal-open');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const logDataAccess = async () => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('consent_access')
        .update({ last_access: new Date().toISOString() })
        .eq('patient_id', patientId)
        .eq('provider_id', user.id);

      if (error && error.code !== 'PGRST116') {
        console.warn('Data access log skipped (RLS may block update):', error.message);
      }
    } catch (err) {
      console.warn('Could not log data access:', err.message);
    }
  };

  const fetchPatientData = async () => {
    setLoading(true);
    try {
      // 1. Fetch History
      const { data: histRows } = await supabase
        .from('medical_histories')
        .select('*')
        .eq('patient_id', patientId);
      const histData = histRows?.[0] || null;
      
      setHistory(histData || { allergies: '', chronic_conditions: '', past_surgeries: '' });

      // 2. Fetch Documents
      const { data: docsData } = await supabase
        .from('patient_documents')
        .select('*')
        .eq('patient_id', patientId)
        .order('uploaded_at', { ascending: false });
      
      setDocuments(docsData || []);

      // 3. Fetch Visit Notes
      const { data: notesData } = await supabase
        .from('visit_notes')
        .select('*, provider:provider_id(full_name)')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });
      
      setNotes(notesData || []);
    } catch (error) {
      console.error('Error fetching patient data:', error);
      toast.error('Failed to load patient records');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNote = async (e) => {
    e.preventDefault();
    if (!newNote.text.trim()) {
      toast.error("Please enter assessment notes.");
      return;
    }

    setSavingNote(true);
    try {
      let attachmentUrl = null;

      // 1. Upload attachment if exists
      if (newNote.file) {
        const fileExt = newNote.file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `provider_notes/${user.id}_${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('medical_documents')
          .upload(filePath, newNote.file);

        if (uploadError) throw uploadError;
        attachmentUrl = filePath;
      }

      // 2. Insert Note to DB
      const { error } = await supabase
        .from('visit_notes')
        .insert([{
          patient_id: patientId,
          provider_id: user.id,
          vitals_bp: newNote.bp,
          vitals_temp: newNote.temp,
          vitals_hr: newNote.hr,
          vitals_rr: newNote.rr,
          vitals_spo2: newNote.spo2,
          pain_scale: newNote.pain ? parseInt(newNote.pain) : null,
          services_rendered: newNote.services.join(', '),
          notes: newNote.text,
          attachment_url: attachmentUrl
        }]);

      if (error) throw error;
      
      toast.success("Progress note added!");
      setNewNote({ bp: '', temp: '', hr: '', rr: '', spo2: '', pain: '', services: [], text: '', file: null });
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchPatientData(); // refresh
    } catch (error) {
      console.error('Error saving note:', error);
      toast.error("Failed to add note.");
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (noteId, filePath) => {
    if (!window.confirm("Are you sure you want to delete this progress note?")) return;
    
    try {
      if (filePath) {
        await supabase.storage.from('medical_documents').remove([filePath]);
      }
      
      const { error } = await supabase.from('visit_notes').delete().eq('id', noteId);
      if (error) throw error;
      
      toast.success("Note deleted.");
      const updated = notes.filter(n => n.id !== noteId);
      setNotes(updated);
      const maxPage = Math.max(1, Math.ceil(updated.length / NOTES_PER_PAGE));
      setNotesPage(curr => Math.min(curr, maxPage));
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete note.");
    }
  };

  const toggleService = (service) => {
    setNewNote(prev => {
      if (prev.services.includes(service)) {
        return { ...prev, services: prev.services.filter(s => s !== service) };
      }
      return { ...prev, services: [...prev.services, service] };
    });
  };

  const getFileUrl = async (filePath) => {
    try {
      const { getSignedUrl } = await import('@/lib/supabaseHelpers');
      return await getSignedUrl(filePath, 3600);
    } catch (err) {
      console.warn('Could not get signed url', err);
      return null;
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-5 overflow-hidden">
      {/* Backdrop */}
      <motion.div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      {/* Main Neumorphic Modal Dialog: Mobile Bottom Sheet + Desktop Centered Modal */}
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-modal-title"
        initial={{ opacity: 0, y: '100%' }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: '100%' }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-4xl h-[90vh] sm:h-[86vh] sm:max-h-[86vh] neu-flat rounded-t-[2rem] sm:rounded-[2.25rem] flex flex-col overflow-hidden z-[10000] border-t sm:border border-slate-200/50 dark:border-white/5 shadow-2xl"
      >
        {/* Mobile Pull Indicator Bar */}
        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full mx-auto mt-2.5 sm:hidden shrink-0" />

        {/* Header Bar */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4.5 border-b border-slate-200/50 dark:border-white/5 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="neu-flat-sm w-10 h-10 rounded-xl flex items-center justify-center text-primary font-bold shrink-0">
              <HeartPulse className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 id="record-modal-title" className="font-display font-extrabold text-base sm:text-lg text-slate-900 dark:text-white truncate">
                Clinical Chart & Record
              </h2>
              <p className="text-3xs sm:text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
                Patient: <span className="text-primary font-bold">{patientName}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="neu-btn w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-white transition-all cursor-pointer shrink-0"
            title="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        {consentBlocked ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 sm:p-12 text-center my-auto">
            <div className="neu-flat w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center mb-4 text-rose-500">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h3 className="text-lg sm:text-xl font-display font-extrabold text-slate-900 dark:text-white mb-2">
              Data Access Revoked
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mb-6 leading-relaxed">
              <span className="font-bold text-slate-800 dark:text-slate-200">{patientName}</span> has revoked consent for medical record sharing. You cannot view their clinical notes until permission is re-enabled in their consent settings.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="neu-btn px-6 py-2.5 rounded-xl font-bold text-xs cursor-pointer"
            >
              Close Record
            </button>
          </div>
        ) : (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Neumorphic Navigation Tabs (Compressed into 3-column grid on mobile) */}
            <div className="px-3 sm:px-6 pt-3 pb-2 border-b border-slate-200/50 dark:border-white/5 grid grid-cols-3 gap-1.5 sm:flex sm:items-center sm:gap-2.5 shrink-0">
              <button
                type="button"
                disabled={grantedPermissions?.medical_history === false}
                onClick={() => setActiveTab('history')}
                className={`py-2 px-1 sm:px-3.5 rounded-xl text-3xs sm:text-xs font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  activeTab === 'history'
                    ? 'neu-pressed text-primary font-extrabold'
                    : 'neu-btn text-slate-600 dark:text-slate-300'
                }`}
              >
                <Activity className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="truncate">History</span>
              </button>

              <button
                type="button"
                disabled={grantedPermissions?.documents === false}
                onClick={() => setActiveTab('documents')}
                className={`py-2 px-1 sm:px-3.5 rounded-xl text-3xs sm:text-xs font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  activeTab === 'documents'
                    ? 'neu-pressed text-primary font-extrabold'
                    : 'neu-btn text-slate-600 dark:text-slate-300'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="truncate">Docs ({documents.length})</span>
              </button>

              <button
                type="button"
                disabled={grantedPermissions?.visit_notes === false}
                onClick={() => setActiveTab('notes')}
                className={`py-2 px-1 sm:px-3.5 rounded-xl text-3xs sm:text-xs font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  activeTab === 'notes'
                    ? 'neu-pressed text-primary font-extrabold'
                    : 'neu-btn text-slate-600 dark:text-slate-300'
                }`}
              >
                <ClipboardList className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="truncate">Notes</span>
              </button>
            </div>

            {/* Tab Contents Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
                  <p className="text-xs font-semibold">Loading patient records...</p>
                </div>
              ) : (
                <>
                  {/* TAB 1: MEDICAL HISTORY */}
                  {activeTab === 'history' && (
                    <div className="space-y-4">
                      {grantedPermissions?.medical_history === false ? (
                        <div className="neu-inset p-8 rounded-2xl text-center">
                          <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                          <p className="font-bold text-sm text-slate-800 dark:text-slate-200">Medical History Restricted</p>
                          <p className="text-xs text-slate-500 mt-1">Patient has not granted permission to view this section.</p>
                        </div>
                      ) : !history?.allergies && !history?.chronic_conditions && !history?.past_surgeries ? (
                        <div className="neu-inset p-8 rounded-2xl text-center">
                          <EmptyState
                            icon="activity"
                            title="No Medical History Recorded"
                            message="The patient has not updated their medical conditions or allergy details yet."
                            variant="compact"
                          />
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* Allergies Highlight Card */}
                          <div className="neu-flat rounded-2xl p-4 sm:p-5 border-l-4 border-rose-500 space-y-1">
                            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-rose-500">
                              <AlertCircle className="w-4 h-4" />
                              <span>Known Allergies</span>
                            </div>
                            <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 font-medium pl-6">
                              {history?.allergies || 'No known drug or food allergies reported.'}
                            </p>
                          </div>

                          {/* Conditions & Surgeries Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="neu-flat rounded-2xl p-4 sm:p-5 space-y-2">
                              <h4 className="font-display font-extrabold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                Chronic Conditions
                              </h4>
                              <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                                {history?.chronic_conditions || 'None reported.'}
                              </p>
                            </div>

                            <div className="neu-flat rounded-2xl p-4 sm:p-5 space-y-2">
                              <h4 className="font-display font-extrabold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                Past Surgeries & Procedures
                              </h4>
                              <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                                {history?.past_surgeries || 'None reported.'}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 2: DOCUMENTS */}
                  {activeTab === 'documents' && (
                    <div className="space-y-4">
                      {grantedPermissions?.documents === false ? (
                        <div className="neu-inset p-8 rounded-2xl text-center">
                          <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                          <p className="font-bold text-sm text-slate-800 dark:text-slate-200">Documents Restricted</p>
                          <p className="text-xs text-slate-500 mt-1">Patient has not granted permission to view uploaded files.</p>
                        </div>
                      ) : documents.length === 0 ? (
                        <div className="neu-inset p-8 rounded-2xl text-center">
                          <EmptyState
                            icon="document"
                            title="No Documents Uploaded"
                            message="The patient has not shared any medical certificates, prescriptions, or lab results yet."
                            variant="compact"
                          />
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          {documents.map((doc) => (
                            <div
                              key={doc.id}
                              className="neu-flat rounded-2xl p-4 flex items-center justify-between gap-3 group"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="neu-flat-sm w-10 h-10 rounded-xl flex items-center justify-center text-primary shrink-0">
                                  <FileText className="w-5 h-5" />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                                    {doc.document_title}
                                  </p>
                                  <p className="text-3xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    {new Date(doc.uploaded_at).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={async () => {
                                  const url = await getFileUrl(doc.file_path);
                                  if (url) window.open(url, '_blank');
                                  else toast.error('Could not open file URL.');
                                }}
                                className="neu-btn p-2 rounded-xl text-primary hover:text-primary-600 transition-all cursor-pointer shrink-0"
                                title="Open Document in New Tab"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 3: PROGRESS NOTES & VITALS */}
                  {activeTab === 'notes' && (
                    <div className="space-y-6">
                      {grantedPermissions?.visit_notes === false ? (
                        <div className="neu-inset p-8 rounded-2xl text-center">
                          <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                          <p className="font-bold text-sm text-slate-800 dark:text-slate-200">Progress Notes Restricted</p>
                          <p className="text-xs text-slate-500 mt-1">Patient has not granted permission to view clinical notes.</p>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          
                          {/* Top Section: Add Clinical Note Form */}
                          <div className="neu-flat rounded-2xl p-4 sm:p-5 space-y-4">
                            <div>
                              <h4 className="font-display font-extrabold text-sm text-slate-900 dark:text-white">
                                Log Clinical Note & Vitals
                              </h4>
                              <p className="text-3xs text-slate-500 mt-0.5">
                                Record biometrics, treatment given, and assessment.
                              </p>
                            </div>

                            <form onSubmit={handleSaveNote} className="space-y-3.5">
                              {/* Vital Signs */}
                              <div className="space-y-2">
                                <p className="text-3xs font-extrabold uppercase tracking-wider text-slate-400">
                                  Vital Signs
                                </p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                                  <div>
                                    <label className="text-3xs font-bold text-slate-500 dark:text-slate-400 block mb-1">BP (mmHg)</label>
                                    <input
                                      type="text"
                                      placeholder="120/80"
                                      value={newNote.bp}
                                      onChange={(e) => setNewNote({ ...newNote, bp: e.target.value })}
                                      className="w-full neu-inset rounded-xl px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 bg-transparent outline-none border border-slate-200/50 dark:border-white/5"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-3xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Temp (°C)</label>
                                    <input
                                      type="text"
                                      placeholder="36.5"
                                      value={newNote.temp}
                                      onChange={(e) => setNewNote({ ...newNote, temp: e.target.value })}
                                      className="w-full neu-inset rounded-xl px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 bg-transparent outline-none border border-slate-200/50 dark:border-white/5"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-3xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Heart Rate (bpm)</label>
                                    <input
                                      type="number"
                                      placeholder="75"
                                      value={newNote.hr}
                                      onChange={(e) => setNewNote({ ...newNote, hr: e.target.value })}
                                      className="w-full neu-inset rounded-xl px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 bg-transparent outline-none border border-slate-200/50 dark:border-white/5"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-3xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Respiratory Rate (bpm)</label>
                                    <input
                                      type="number"
                                      placeholder="18"
                                      value={newNote.rr}
                                      onChange={(e) => setNewNote({ ...newNote, rr: e.target.value })}
                                      className="w-full neu-inset rounded-xl px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 bg-transparent outline-none border border-slate-200/50 dark:border-white/5"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-3xs font-bold text-slate-500 dark:text-slate-400 block mb-1">SpO2 (%)</label>
                                    <input
                                      type="number"
                                      placeholder="98"
                                      value={newNote.spo2}
                                      onChange={(e) => setNewNote({ ...newNote, spo2: e.target.value })}
                                      className="w-full neu-inset rounded-xl px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 bg-transparent outline-none border border-slate-200/50 dark:border-white/5"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-3xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Pain Scale (0-10)</label>
                                    <input
                                      type="number"
                                      min="0"
                                      max="10"
                                      placeholder="0"
                                      value={newNote.pain}
                                      onChange={(e) => setNewNote({ ...newNote, pain: e.target.value })}
                                      className="w-full neu-inset rounded-xl px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 bg-transparent outline-none border border-slate-200/50 dark:border-white/5"
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* Services Rendered Selector */}
                              <div>
                                <label className="text-3xs font-extrabold uppercase tracking-wider text-slate-400 block mb-1.5">
                                  Services Rendered
                                </label>
                                <div className="flex flex-wrap gap-1.5">
                                  {availableServices.map((service) => {
                                    const isSelected = newNote.services.includes(service);
                                    return (
                                      <button
                                        key={service}
                                        type="button"
                                        onClick={() => toggleService(service)}
                                        className={`px-2.5 py-1 rounded-lg text-3xs font-bold transition-all cursor-pointer ${
                                          isSelected
                                            ? 'neu-pressed text-primary font-extrabold'
                                            : 'neu-btn text-slate-600 dark:text-slate-300'
                                        }`}
                                      >
                                        {service}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Clinical Note Textarea */}
                              <div>
                                <label className="text-3xs font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
                                  Assessment & Plan
                                </label>
                                <textarea
                                  required
                                  rows={3}
                                  placeholder="Document patient evaluation, wound observations, or medications administered..."
                                  value={newNote.text}
                                  onChange={(e) => setNewNote({ ...newNote, text: e.target.value })}
                                  className="w-full neu-inset rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 bg-transparent outline-none resize-none"
                                />
                              </div>

                              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
                                {/* Attachment Button */}
                                <div className="flex-1 min-w-0">
                                  <input
                                    ref={fileInputRef}
                                    type="file"
                                    id="provider-note-attachment"
                                    className="hidden"
                                    accept="image/jpeg, image/png, application/pdf"
                                    onChange={(e) => {
                                      const file = e.target.files[0];
                                      if (file && file.size > 2 * 1024 * 1024) {
                                        toast.error('File exceeds max size (2MB).');
                                        if (fileInputRef.current) fileInputRef.current.value = '';
                                        else e.target.value = '';
                                      } else {
                                        setNewNote({ ...newNote, file });
                                      }
                                    }}
                                  />
                                  <div className="flex items-center gap-1.5">
                                    <label
                                      htmlFor="provider-note-attachment"
                                      className="neu-btn px-3 py-2 rounded-xl text-3xs font-bold text-slate-600 dark:text-slate-300 flex items-center justify-center gap-1.5 cursor-pointer transition-all truncate flex-1 min-w-0"
                                    >
                                      <Paperclip className="w-3.5 h-3.5 text-primary shrink-0" />
                                      <span className="truncate">
                                        {newNote.file ? newNote.file.name : 'Attach Image/File (Max 2MB)'}
                                      </span>
                                    </label>
                                    {newNote.file && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setNewNote(n => ({ ...n, file: null }));
                                          if (fileInputRef.current) fileInputRef.current.value = '';
                                        }}
                                        className="neu-btn p-2 rounded-xl text-slate-400 hover:text-rose-500 cursor-pointer shrink-0"
                                        title="Remove attachment"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* Submit Button */}
                                <button
                                  type="submit"
                                  disabled={savingNote}
                                  className="neu-btn-primary px-5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
                                >
                                  {savingNote ? (
                                    <>
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                      <span>Saving Note...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Send className="w-4 h-4" />
                                      <span>Log Progress Note</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </form>
                          </div>

                          {/* Bottom Section: Historical Visit Notes with Pagination */}
                          <div className="space-y-3.5 pt-2">
                            <div className="flex items-center justify-between gap-3 border-b border-slate-200/50 dark:border-white/5 pb-2">
                              <div>
                                <h4 className="font-display font-extrabold text-sm text-slate-900 dark:text-white">
                                  Historical Progress Notes
                                </h4>
                                <p className="text-3xs text-slate-500 mt-0.5">
                                  Chronological record of medical consultations for this patient.
                                </p>
                              </div>

                              {/* Pagination Controls */}
                              {notes.length > NOTES_PER_PAGE && (() => {
                                const totalNotesPages = Math.ceil(notes.length / NOTES_PER_PAGE);
                                return (
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                      type="button"
                                      disabled={notesPage <= 1}
                                      onClick={() => setNotesPage((p) => Math.max(1, p - 1))}
                                      className="neu-btn w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:text-primary transition-all cursor-pointer"
                                      title="Previous notes"
                                    >
                                      <ChevronLeft className="w-3.5 h-3.5" />
                                    </button>
                                    <span className="text-3xs font-extrabold text-slate-500 px-1 select-none whitespace-nowrap">
                                      {notesPage} / {totalNotesPages}
                                    </span>
                                    <button
                                      type="button"
                                      disabled={notesPage >= totalNotesPages}
                                      onClick={() => setNotesPage((p) => Math.min(totalNotesPages, p + 1))}
                                      className="neu-btn w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:text-primary transition-all cursor-pointer"
                                      title="Next notes"
                                    >
                                      <ChevronRight className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                );
                              })()}
                            </div>

                            {notes.length === 0 ? (
                              <div className="neu-inset p-8 rounded-2xl text-center">
                                <EmptyState
                                  icon="inbox"
                                  title="No Visit Notes Yet"
                                  message="Clinical progress notes logged during patient consultations will be displayed here."
                                  variant="compact"
                                />
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {notes
                                  .slice((notesPage - 1) * NOTES_PER_PAGE, notesPage * NOTES_PER_PAGE)
                                  .map((note) => (
                                    <div
                                      key={note.id}
                                      className="neu-flat rounded-2xl p-4 space-y-2.5 transition-all select-text"
                                    >
                                      <div className="flex items-start justify-between gap-2">
                                        <div>
                                          <h5 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                                            Dr. {note.provider?.full_name || 'Healthcare Provider'}
                                          </h5>
                                          <p className="text-3xs text-slate-400 mt-0.5">
                                            {new Date(note.created_at).toLocaleString('en-US', {
                                              month: 'short',
                                              day: 'numeric',
                                              year: 'numeric',
                                              hour: 'numeric',
                                              minute: '2-digit',
                                            })}
                                          </p>
                                        </div>

                                        {note.provider_id === user.id && (
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteNote(note.id, note.attachment_url)}
                                            className="neu-btn p-1.5 rounded-lg text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                                            title="Delete Note"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                      </div>

                                      {/* Vitals Badges */}
                                      {(note.vitals_bp || note.vitals_temp || note.vitals_hr || note.vitals_spo2 || note.vitals_rr || note.pain_scale != null) && (
                                        <div className="flex flex-wrap gap-1.5 text-3xs font-extrabold">
                                          {note.vitals_bp && (
                                            <span className="neu-flat-sm px-2 py-0.5 rounded-md text-emerald-600 dark:text-emerald-400">
                                              BP: {note.vitals_bp}
                                            </span>
                                          )}
                                          {note.vitals_temp && (
                                            <span className="neu-flat-sm px-2 py-0.5 rounded-md text-amber-600 dark:text-amber-400">
                                              Temp: {note.vitals_temp}°C
                                            </span>
                                          )}
                                          {note.vitals_hr && (
                                            <span className="neu-flat-sm px-2 py-0.5 rounded-md text-rose-600 dark:text-rose-400">
                                              HR: {note.vitals_hr} bpm
                                            </span>
                                          )}
                                          {note.vitals_rr && (
                                            <span className="neu-flat-sm px-2 py-0.5 rounded-md text-teal-600 dark:text-teal-400">
                                              RR: {note.vitals_rr} bpm
                                            </span>
                                          )}
                                          {note.vitals_spo2 && (
                                            <span className="neu-flat-sm px-2 py-0.5 rounded-md text-blue-600 dark:text-blue-400">
                                              SpO2: {note.vitals_spo2}%
                                            </span>
                                          )}
                                          {note.pain_scale != null && (
                                            <span className="neu-flat-sm px-2 py-0.5 rounded-md text-purple-600 dark:text-purple-400">
                                              Pain: {note.pain_scale}/10
                                            </span>
                                          )}
                                        </div>
                                      )}

                                      {/* Services Tag */}
                                      {note.services_rendered && (
                                        <p className="text-3xs font-bold text-primary">
                                          Services: <span className="font-medium text-slate-600 dark:text-slate-300">{note.services_rendered}</span>
                                        </p>
                                      )}

                                      {/* Doctor's Assessment / Clinical Summary Note */}
                                      {note.notes && (
                                        <div className="neu-inset p-3 rounded-xl border border-slate-200/40 dark:border-white/5 space-y-1">
                                          <p className="text-3xs font-extrabold uppercase tracking-wider text-primary">
                                            Doctor&apos;s Note
                                          </p>
                                          <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed italic whitespace-pre-wrap">
                                            &ldquo;{note.notes}&rdquo;
                                          </p>
                                        </div>
                                      )}

                                      {/* Attachment */}
                                      {note.attachment_url && (
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            const url = await getFileUrl(note.attachment_url);
                                            if (url) window.open(url, '_blank');
                                            else toast.error('Could not load attachment.');
                                          }}
                                          className="neu-btn px-2.5 py-1.5 rounded-lg text-3xs font-bold text-primary flex items-center gap-1.5 cursor-pointer mt-1"
                                        >
                                          <Paperclip className="w-3 h-3" />
                                          <span>View Attached Document</span>
                                        </button>
                                      )}
                                    </div>
                                  ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </div>,
    document.body
  );
};

export default PatientRecordModal;
