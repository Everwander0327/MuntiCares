import { useState, useEffect, useCallback, useRef } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { 
  X, Activity, FileText, ClipboardList, Send, Loader2, ExternalLink, 
  Trash2, Paperclip, HeartPulse, ShieldAlert, AlertCircle, 
  ChevronLeft, ChevronRight, User, ShieldCheck
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import useBodyScrollLock from '@/hooks/useBodyScrollLock';
import { fetchConsentGrant } from '../lib/consent';
import toast from 'react-hot-toast';
import { EmptyState } from '@/shared/ui';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

/** Consent is deny-by-default: only an explicit `true` grants a category. */
const canView = (perms, key) => perms?.[key] === true;

const PatientRecordModal = ({ 
  isOpen, 
  onClose, 
  patientId, 
  patientName, 
  patientAvatar = '', 
  triggerRef = null 
}) => {
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const permsRef = useRef(null);
  const [activeTab, setActiveTab] = useState('history');
  const [loading, setLoading] = useState(true);
  const [consentBlocked, setConsentBlocked] = useState(false);
  const [accessError, setAccessError] = useState(null);
  const [grantedPermissions, setGrantedPermissions] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(patientAvatar || '');

  useEffect(() => {
    if (patientAvatar) {
      setAvatarUrl(patientAvatar);
    } else if (patientId && isOpen) {
      supabase
        .from('users')
        .select('avatar_url')
        .eq('id', patientId)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.avatar_url) setAvatarUrl(data.avatar_url);
        })
        .catch(err => console.warn('Could not fetch patient avatar:', err));
    }
  }, [patientAvatar, patientId, isOpen]);

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

  const applyPerms = useCallback((perms) => {
    const next = perms || {};
    const changed = JSON.stringify(next) !== JSON.stringify(permsRef.current || {});
    permsRef.current = next;
    setGrantedPermissions(next);
    return changed;
  }, []);

  const logDataAccess = useCallback(async () => {
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
  }, [patientId, user]);

  const fetchPatientData = useCallback(async (perms) => {
    const granted = perms || {};
    setLoading(true);
    try {
      // 1. History — only when the patient granted that category
      if (canView(granted, 'medical_history')) {
        const { data: histRows, error: histError } = await supabase
          .from('medical_histories')
          .select('allergies, chronic_conditions, past_surgeries')
          .eq('patient_id', patientId)
          .limit(1);
        if (histError) throw histError;
        setHistory(histRows?.[0] || { allergies: '', chronic_conditions: '', past_surgeries: '' });
      } else {
        setHistory(null);
      }

      // 2. Documents
      if (canView(granted, 'documents')) {
        const { data: docsData, error: docsError } = await supabase
          .from('patient_documents')
          .select('id, document_title, file_path, uploaded_at')
          .eq('patient_id', patientId)
          .order('uploaded_at', { ascending: false })
          .limit(50);
        if (docsError) throw docsError;
        setDocuments(docsData || []);
      } else {
        setDocuments([]);
      }

      // 3. Visit Notes - load granted notes or notes authored by this provider
      try {
        const notesQuery = supabase
          .from('visit_notes')
          .select('*, provider:provider_id(full_name)')
          .eq('patient_id', patientId)
          .order('created_at', { ascending: false })
          .limit(100);

        if (!canView(granted, 'visit_notes') && user?.id) {
          notesQuery.eq('provider_id', user.id);
        }

        const { data: notesData, error: notesError } = await notesQuery;
        if (!notesError) {
          setNotes(notesData || []);
        } else {
          setNotes([]);
        }
      } catch (notesErr) {
        setNotes([]);
      }
    } catch (error) {
      console.error('Error fetching patient data:', error);
      toast.error('Failed to load patient records');
      setHistory(null);
      setDocuments([]);
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, [patientId, user]);

  const checkConsentThenLoad = useCallback(async () => {
    setLoading(true);
    setConsentBlocked(false);
    setAccessError(null);
    if (!user) return;
    try {
      const grant = await fetchConsentGrant(patientId, user.id);

      if (!grant) {
        setConsentBlocked(true);
        setGrantedPermissions(null);
        permsRef.current = null;
        setLoading(false);
        return;
      }

      const perms = grant.permissions;
      applyPerms(perms);
      fetchPatientData(perms);
      if (canView(perms, 'medical_history') || canView(perms, 'documents') || canView(perms, 'visit_notes')) {
        logDataAccess();
      }
    } catch (err) {
      console.warn('Consent check failed:', err.message);
      // Fail closed: an unreadable consent row is not consent.
      setGrantedPermissions(null);
      setAccessError('Sharing settings could not be verified. Records stay hidden until this loads.');
      setLoading(false);
    }
  }, [patientId, user, applyPerms, fetchPatientData, logDataAccess]);

  useEffect(() => {
    if (isOpen && patientId) {
      checkConsentThenLoad();
    }
  }, [isOpen, patientId, checkConsentThenLoad]);

  useEffect(() => {
    if (!isOpen || !patientId || !user) return;

    const pollConsent = async () => {
      let grant;
      try {
        grant = await fetchConsentGrant(patientId, user.id);
      } catch {
        return;
      }

      if (!grant) {
        setConsentBlocked(true);
        setGrantedPermissions(null);
        permsRef.current = null;
        return;
      }

      setConsentBlocked(false);
      setAccessError(null);
      if (applyPerms(grant.permissions)) fetchPatientData(grant.permissions);
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

    const interval = setInterval(pollConsent, 20000);

    return () => { clearInterval(interval); supabase.removeChannel(channel); };
  }, [isOpen, patientId, user, applyPerms, fetchPatientData]);

  // Lock background scroll while the record is open
  useBodyScrollLock(isOpen);

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
      fetchPatientData(permsRef.current); // refresh
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

  const initials = patientName
    ? patientName.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()
    : 'P';

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay asChild>
          <motion.div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={onClose}
          />
        </DialogPrimitive.Overlay>

        {/* Main Dialog: Mobile Bottom Sheet + Desktop Centered Modal */}
        <DialogPrimitive.Content
          asChild
          aria-modal="true"
          onCloseAutoFocus={(event) => {
            if (!triggerRef?.current) return;
            event.preventDefault();
            triggerRef.current.focus();
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-5 overflow-hidden pointer-events-none"
          >
            <motion.div
              className="relative w-full max-w-5xl h-[92dvh] sm:h-[88vh] max-h-[92dvh] sm:max-h-[88vh] neu-flat rounded-t-[2rem] sm:rounded-[2.25rem] flex flex-col overflow-hidden border-t sm:border border-slate-200/80 dark:border-white/10 shadow-2xl pointer-events-auto bg-surface-shell select-text overscroll-contain"
            >
              {/* Modal Top Header Bar (100% Solid, Non-Collapsing Surface) */}
              <div className="bg-surface-shell border-b border-slate-200/80 dark:border-white/10 shrink-0 z-20 shadow-sm pt-2 sm:pt-0">
                {/* Mobile Pull Bar */}
                <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-sm mx-auto mb-2 sm:hidden shrink-0" />

                <div className="px-4 sm:px-6 pb-3 sm:py-4 flex items-center justify-between gap-3">
                  {/* Desktop Title Bar */}
                  <div className="hidden md:block min-w-0">
                    <DialogPrimitive.Title asChild>
                      <h2 className="font-display font-extrabold text-base sm:text-lg text-slate-900 dark:text-white truncate">
                        Clinical Chart &amp; Record
                      </h2>
                    </DialogPrimitive.Title>
                    <p className="text-xs font-semibold text-tertiary truncate">
                      Patient: <strong className="text-slate-800 dark:text-slate-100">{patientName}</strong> &bull; Muntinlupa Care Network
                    </p>
                  </div>

                  {/* Mobile Integrated Patient Identity */}
                  <div className="md:hidden flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-blue-900/40 border border-slate-200/80 dark:border-blue-700/50 flex items-center justify-center text-blue-500 dark:text-blue-300 font-black text-xs shrink-0 overflow-hidden shadow-sm">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt={patientName}
                          className="w-full h-full object-cover rounded-xl"
                          onError={() => setAvatarUrl('')}
                        />
                      ) : (
                        <span>{initials}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <DialogPrimitive.Title asChild>
                          <h2 className="font-display font-extrabold text-sm text-slate-900 dark:text-white truncate">
                            {patientName}
                          </h2>
                        </DialogPrimitive.Title>
                        <span className="px-1.5 py-0.2 rounded text-3xs font-extrabold uppercase text-success dark:text-success-dark bg-emerald-500/10 border border-emerald-500/30 shrink-0">
                          Verified
                        </span>
                      </div>
                      <p className="text-2xs font-semibold text-tertiary truncate">
                        Clinical Chart &bull; Muntinlupa
                      </p>
                    </div>
                  </div>

                  {/* Header Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      to={`/provider/patients/${patientId}/profile`}
                      onClick={onClose}
                      className="md:hidden neu-btn px-2.5 py-1.5 rounded-xl text-2xs font-bold text-slate-700 dark:text-slate-200 hover:text-link transition-all flex items-center gap-1 cursor-pointer shrink-0"
                      title="View Full Profile"
                    >
                      <span>Profile</span>
                      <span aria-hidden="true">&rarr;</span>
                    </Link>

                    <DialogPrimitive.Close
                      aria-label="Close"
                      className="neu-btn w-10 h-10 rounded-xl flex items-center justify-center text-tertiary hover:text-slate-800 dark:hover:text-white transition-all cursor-pointer shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </DialogPrimitive.Close>
                  </div>
                </div>
              </div>

              {/* Error or Blocked State */}
              {accessError ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center my-auto">
                  <div className="neu-flat w-16 h-16 rounded-2xl flex items-center justify-center mb-4 text-warning">
                    <AlertCircle className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-display font-extrabold text-slate-900 dark:text-white mb-2">
                    Records Unavailable
                  </h3>
                  <p className="text-sm text-tertiary max-w-md mb-6 leading-relaxed">{accessError}</p>
                  <button
                    type="button"
                    onClick={checkConsentThenLoad}
                    className="neu-btn px-6 py-2.5 rounded-xl font-bold text-xs cursor-pointer"
                  >
                    Try again
                  </button>
                </div>
              ) : consentBlocked ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center my-auto">
                  <div className="neu-flat w-16 h-16 rounded-2xl flex items-center justify-center mb-4 text-danger">
                    <ShieldAlert className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-display font-extrabold text-slate-900 dark:text-white mb-2">
                    Data Access Revoked
                  </h3>
                  <p className="text-sm text-tertiary max-w-md mb-6 leading-relaxed">
                    <span className="font-bold text-slate-800 dark:text-slate-200">{patientName}</span> has revoked consent for medical record sharing.
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
                /* OPTION 2: EPIC MYCHART SIDE-BY-SIDE CLINICAL SPLIT */
                <div className="flex-1 flex flex-col md:grid md:grid-cols-12 overflow-hidden min-h-0">
                  
                  {/* LEFT DOCK: PATIENT IDENTITY & CLINICAL METADATA (Desktop only) */}
                  <aside className="hidden md:flex md:col-span-4 p-4 sm:p-5 border-r border-slate-200/50 dark:border-white/5 flex-col justify-between overflow-y-auto space-y-4 bg-slate-50/60 dark:bg-[#0B131E]/40 shrink-0">
                    <div className="space-y-4">
                      {/* Patient Avatar Card */}
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-blue-900/40 border border-slate-200/80 dark:border-blue-700/50 flex items-center justify-center text-blue-500 dark:text-blue-300 font-black text-base shrink-0 shadow-sm overflow-hidden">
                          {avatarUrl ? (
                            <img
                              src={avatarUrl}
                              alt={patientName}
                              className="w-full h-full object-cover rounded-2xl"
                              onError={() => setAvatarUrl('')}
                            />
                          ) : (
                            <span>{initials}</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-display font-extrabold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                            {patientName}
                          </h3>
                        </div>
                      </div>

                      {/* Clinical Status Strip (NO pills, NO dots) */}
                      <div className="p-3 rounded-xl bg-slate-100/80 dark:bg-[#111B29] border border-slate-200/70 dark:border-slate-800 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-2xs font-bold text-tertiary uppercase tracking-wider">Access Status</span>
                          <span className="px-2 py-0.5 rounded-md text-2xs font-extrabold uppercase tracking-wider text-success dark:text-success-dark bg-emerald-500/10 border border-emerald-500/30">
                            Verified
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-2xs font-bold text-tertiary uppercase tracking-wider">Location</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">Muntinlupa City</span>
                        </div>
                      </div>

                      {/* Sharing Permissions Audit */}
                      <div className="space-y-1.5">
                        <p className="text-2xs font-extrabold uppercase tracking-wider text-tertiary">
                          Data Sharing Permissions
                        </p>
                        <div className="space-y-1 text-xs">
                          <div className="flex items-center justify-between p-2 rounded-lg bg-white/70 dark:bg-slate-800/40 border border-slate-200/50 dark:border-white/5">
                            <span className="text-slate-600 dark:text-slate-300 font-medium">Medical History</span>
                            <span className={`text-2xs font-extrabold uppercase px-1.5 py-0.2 rounded ${
                              canView(grantedPermissions, 'medical_history') 
                                ? 'text-success bg-emerald-500/10' 
                                : 'text-tertiary bg-slate-200/50 dark:bg-slate-700/50'
                            }`}>
                              {canView(grantedPermissions, 'medical_history') ? 'Granted' : 'Locked'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between p-2 rounded-lg bg-white/70 dark:bg-slate-800/40 border border-slate-200/50 dark:border-white/5">
                            <span className="text-slate-600 dark:text-slate-300 font-medium">Uploaded Docs</span>
                            <span className={`text-2xs font-extrabold uppercase px-1.5 py-0.2 rounded ${
                              canView(grantedPermissions, 'documents') 
                                ? 'text-success bg-emerald-500/10' 
                                : 'text-tertiary bg-slate-200/50 dark:bg-slate-700/50'
                            }`}>
                              {canView(grantedPermissions, 'documents') ? 'Granted' : 'Locked'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between p-2 rounded-lg bg-white/70 dark:bg-slate-800/40 border border-slate-200/50 dark:border-white/5">
                            <span className="text-slate-600 dark:text-slate-300 font-medium">Clinical Notes</span>
                            <span className={`text-2xs font-extrabold uppercase px-1.5 py-0.2 rounded ${
                              canView(grantedPermissions, 'visit_notes') 
                                ? 'text-success bg-emerald-500/10' 
                                : 'text-tertiary bg-slate-200/50 dark:bg-slate-700/50'
                            }`}>
                              {canView(grantedPermissions, 'visit_notes') ? 'Granted' : 'Locked'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Quick Action Buttons */}
                    <div className="pt-3 border-t border-slate-200/50 dark:border-white/5 space-y-2">
                      <button
                        type="button"
                        onClick={() => setActiveTab('notes')}
                        className="w-full neu-btn px-3 py-2 rounded-xl text-xs font-bold text-link hover:text-primary transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <ClipboardList className="w-3.5 h-3.5 text-link" />
                        <span>+ Log Clinical Note</span>
                      </button>

                      <Link
                        to={`/provider/patients/${patientId}/profile`}
                        onClick={onClose}
                        className="w-full neu-btn px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-link transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>View Full Profile &rarr;</span>
                      </Link>
                    </div>
                  </aside>

                  {/* RIGHT PANEL: SEGMENTED TABS & CLINICAL CARDS (md:col-span-8) */}
                  <main className="flex-1 md:col-span-8 flex flex-col overflow-hidden min-h-0">
                    
                    {/* Solid Tab Bar & Mobile Status Header (100% Solid, Non-Collapsing Surface) */}
                    <div className="bg-surface-shell border-b border-slate-200/80 dark:border-white/10 shrink-0 z-10 shadow-sm">
                      {/* Mobile Quick Data Sharing Strip */}
                      <div className="md:hidden px-4 pt-2.5 pb-1 flex items-center justify-between text-2xs text-tertiary">
                        <span className="font-bold uppercase tracking-wider text-3xs">Consent:</span>
                        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                          <span className={`px-1.5 py-0.5 rounded text-3xs font-bold whitespace-nowrap ${canView(grantedPermissions, 'medical_history') ? 'text-success bg-emerald-500/10 border border-emerald-500/20' : 'text-tertiary bg-slate-200/50 dark:bg-slate-800'}`}>
                            History: {canView(grantedPermissions, 'medical_history') ? 'Granted' : 'Locked'}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-3xs font-bold whitespace-nowrap ${canView(grantedPermissions, 'documents') ? 'text-success bg-emerald-500/10 border border-emerald-500/20' : 'text-tertiary bg-slate-200/50 dark:bg-slate-800'}`}>
                            Docs: {canView(grantedPermissions, 'documents') ? 'Granted' : 'Locked'}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-3xs font-bold whitespace-nowrap ${canView(grantedPermissions, 'visit_notes') ? 'text-success bg-emerald-500/10 border border-emerald-500/20' : 'text-tertiary bg-slate-200/50 dark:bg-slate-800'}`}>
                            Notes: {canView(grantedPermissions, 'visit_notes') ? 'Granted' : 'Locked'}
                          </span>
                        </div>
                      </div>

                      {/* Neumorphic Segmented Tab Bar (Strictly NO pills, NO dots) */}
                      <div className="p-3 sm:p-4">
                        <div className="p-1 rounded-xl bg-slate-100/70 dark:bg-[#0E1724] border border-slate-200/80 dark:border-slate-800 flex items-center gap-1 overflow-x-auto no-scrollbar">
                          <button
                            type="button"
                            onClick={() => setActiveTab('history')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer flex-1 shrink-0 ${
                              activeTab === 'history'
                                ? 'neu-pressed bg-white dark:bg-blue-600 text-link dark:text-white shadow-sm font-extrabold'
                                : 'text-tertiary hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/40 dark:hover:bg-slate-800/40'
                            }`}
                          >
                            <Activity className="w-3.5 h-3.5 shrink-0" />
                            <span>Medical History</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setActiveTab('documents')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer flex-1 shrink-0 ${
                              activeTab === 'documents'
                                ? 'neu-pressed bg-white dark:bg-blue-600 text-link dark:text-white shadow-sm font-extrabold'
                                : 'text-tertiary hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/40 dark:hover:bg-slate-800/40'
                            }`}
                          >
                            <FileText className="w-3.5 h-3.5 shrink-0" />
                            <span>Docs</span>
                            <span className={`px-1.5 py-0.2 rounded text-2xs font-extrabold ${
                              activeTab === 'documents' ? 'bg-blue-100 dark:bg-blue-800 text-link dark:text-white' : 'bg-slate-200/60 dark:bg-slate-800 text-tertiary'
                            }`}>
                              {documents.length}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setActiveTab('notes')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer flex-1 shrink-0 ${
                              activeTab === 'notes'
                                ? 'neu-pressed bg-white dark:bg-blue-600 text-link dark:text-white shadow-sm font-extrabold'
                                : 'text-tertiary hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/40 dark:hover:bg-slate-800/40'
                            }`}
                          >
                            <ClipboardList className="w-3.5 h-3.5 shrink-0" />
                            <span>Visit Notes</span>
                            <span className={`px-1.5 py-0.2 rounded text-2xs font-extrabold ${
                              activeTab === 'notes' ? 'bg-blue-100 dark:bg-blue-800 text-link dark:text-white' : 'bg-slate-200/60 dark:bg-slate-800 text-tertiary'
                            }`}>
                              {notes.length}
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Content Scrollable Body (Overscroll Contained - Smooth Touch Scrolling) */}
                    <div 
                      className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4"
                      style={{ WebkitOverflowScrolling: 'touch' }}
                    >
                      {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-tertiary">
                          <Loader2 className="w-8 h-8 animate-spin text-link mb-3" />
                          <p className="text-xs font-semibold">Loading clinical records...</p>
                        </div>
                      ) : (
                        <>
                          {/* TAB 1: MEDICAL HISTORY (Structured Clinical Scaffolding - No Empty Void) */}
                          {activeTab === 'history' && (
                            <div className="space-y-4">
                              {!canView(grantedPermissions, 'medical_history') ? (
                                <div className="neu-inset p-8 rounded-2xl text-center">
                                  <AlertCircle className="w-8 h-8 text-warning mx-auto mb-2" />
                                  <p className="font-bold text-sm text-slate-800 dark:text-slate-200">Medical History Restricted</p>
                                  <p className="text-xs text-tertiary mt-1">Patient has not granted permission to view this section.</p>
                                </div>
                              ) : (
                                <div className="space-y-4">
                                  {/* Allergies Highlight Card with Left Red Alert Line */}
                                  <div className="neu-flat rounded-2xl p-4 sm:p-5 border-l-4 border-rose-500 space-y-2">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-rose-500 dark:text-rose-400">
                                        <AlertCircle className="w-4 h-4" />
                                        <span>Allergies &amp; Adverse Reactions</span>
                                      </div>
                                      <span className="text-2xs font-bold text-tertiary uppercase">Self-Reported</span>
                                    </div>
                                    <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 font-medium pl-6">
                                      {history?.allergies && history.allergies.trim() 
                                        ? history.allergies 
                                        : 'No known drug, food, or environmental allergies reported by patient.'}
                                    </p>
                                  </div>

                                  {/* Dual Cards: Chronic Conditions & Past Surgeries */}
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {/* Chronic Conditions */}
                                    <div className="neu-flat rounded-2xl p-4 sm:p-5 space-y-2">
                                      <div className="flex items-center justify-between">
                                        <h4 className="font-display font-extrabold text-xs uppercase tracking-wider text-tertiary flex items-center gap-1.5">
                                          <HeartPulse className="w-3.5 h-3.5 text-link" />
                                          <span>Chronic Conditions</span>
                                        </h4>
                                        <span className="text-2xs text-tertiary font-semibold">
                                          {history?.chronic_conditions?.trim() ? 'Active' : 'None reported'}
                                        </span>
                                      </div>
                                      <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                                        {history?.chronic_conditions && history.chronic_conditions.trim()
                                          ? history.chronic_conditions
                                          : 'No active chronic illnesses (e.g. Hypertension, Diabetes, Asthma) registered.'}
                                      </p>
                                    </div>

                                    {/* Past Surgeries & Procedures */}
                                    <div className="neu-flat rounded-2xl p-4 sm:p-5 space-y-2">
                                      <div className="flex items-center justify-between">
                                        <h4 className="font-display font-extrabold text-xs uppercase tracking-wider text-tertiary flex items-center gap-1.5">
                                          <FileText className="w-3.5 h-3.5 text-link" />
                                          <span>Past Surgeries &amp; Procedures</span>
                                        </h4>
                                        <span className="text-2xs text-tertiary font-semibold">
                                          {history?.past_surgeries?.trim() ? 'Recorded' : 'None reported'}
                                        </span>
                                      </div>
                                      <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                                        {history?.past_surgeries && history.past_surgeries.trim()
                                          ? history.past_surgeries
                                          : 'No major prior surgical history or hospitalizations on file.'}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Bottom Informational Sync Notice */}
                                  <div className="p-3.5 rounded-xl bg-slate-100/60 dark:bg-[#0F1926] border border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-xs text-tertiary">
                                    <div className="flex items-center gap-2">
                                      <ShieldCheck className="w-4 h-4 text-link shrink-0" />
                                      <span>Medical history is maintained by the patient and updated during consultations.</span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* TAB 2: DOCUMENTS */}
                          {activeTab === 'documents' && (
                            <div className="space-y-4">
                              {!canView(grantedPermissions, 'documents') ? (
                                <div className="neu-inset p-8 rounded-2xl text-center">
                                  <AlertCircle className="w-8 h-8 text-warning mx-auto mb-2" />
                                  <p className="font-bold text-sm text-slate-800 dark:text-slate-200">Documents Restricted</p>
                                  <p className="text-xs text-tertiary mt-1">Patient has not granted permission to view uploaded files.</p>
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
                                        <div className="neu-flat-sm w-10 h-10 rounded-xl flex items-center justify-center text-link shrink-0">
                                          <FileText className="w-5 h-5" />
                                        </div>
                                        <div className="min-w-0">
                                          <p className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                                            {doc.document_title}
                                          </p>
                                          <p className="text-xs text-tertiary mt-0.5">
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
                                        className="neu-btn p-2 rounded-xl text-link hover:text-primary transition-all cursor-pointer shrink-0"
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
                              {!canView(grantedPermissions, 'visit_notes') && (
                                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs flex items-center gap-2 text-amber-700 dark:text-amber-400">
                                  <AlertCircle className="w-4 h-4 shrink-0" />
                                  <span>Viewing past notes from other providers is restricted by patient consent. You can still record and review your consultation notes.</span>
                                </div>
                              )}
                              <div className="space-y-6">
                                  {/* Top Section: Add Clinical Note Form */}
                                  <div className="neu-flat rounded-2xl p-4 sm:p-5 space-y-4">
                                    <div>
                                      <h4 className="font-display font-extrabold text-sm text-slate-900 dark:text-white">
                                        Log Clinical Progress Note &amp; Vitals
                                      </h4>
                                      <p className="text-xs text-tertiary mt-0.5">
                                        Record patient biometrics, treatments, and clinical observations.
                                      </p>
                                    </div>

                                    <form onSubmit={handleSaveNote} className="space-y-3.5">
                                      {/* Vital Signs Grid */}
                                      <div className="space-y-2">
                                        <p className="text-2xs font-extrabold uppercase tracking-wider text-tertiary">
                                          Vital Signs
                                        </p>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                                          <div>
                                            <label htmlFor="note-bp" className="text-xs font-bold text-tertiary block mb-1">BP (mmHg)</label>
                                            <input
                                              id="note-bp"
                                              type="text"
                                              placeholder="120/80"
                                              value={newNote.bp}
                                              onChange={(e) => setNewNote({ ...newNote, bp: e.target.value })}
                                              className="w-full neu-inset rounded-xl px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 bg-transparent outline-none border border-slate-200/50 dark:border-white/5"
                                            />
                                          </div>
                                          <div>
                                            <label htmlFor="note-temp" className="text-xs font-bold text-tertiary block mb-1">Temp (°C)</label>
                                            <input
                                              id="note-temp"
                                              type="text"
                                              placeholder="36.5"
                                              value={newNote.temp}
                                              onChange={(e) => setNewNote({ ...newNote, temp: e.target.value })}
                                              className="w-full neu-inset rounded-xl px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 bg-transparent outline-none border border-slate-200/50 dark:border-white/5"
                                            />
                                          </div>
                                          <div>
                                            <label htmlFor="note-hr" className="text-xs font-bold text-tertiary block mb-1">Heart Rate (bpm)</label>
                                            <input
                                              id="note-hr"
                                              type="number"
                                              placeholder="75"
                                              value={newNote.hr}
                                              onChange={(e) => setNewNote({ ...newNote, hr: e.target.value })}
                                              className="w-full neu-inset rounded-xl px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 bg-transparent outline-none border border-slate-200/50 dark:border-white/5"
                                            />
                                          </div>
                                          <div>
                                            <label htmlFor="note-rr" className="text-xs font-bold text-tertiary block mb-1">Respiratory Rate (bpm)</label>
                                            <input
                                              id="note-rr"
                                              type="number"
                                              placeholder="18"
                                              value={newNote.rr}
                                              onChange={(e) => setNewNote({ ...newNote, rr: e.target.value })}
                                              className="w-full neu-inset rounded-xl px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 bg-transparent outline-none border border-slate-200/50 dark:border-white/5"
                                            />
                                          </div>
                                          <div>
                                            <label htmlFor="note-spo2" className="text-xs font-bold text-tertiary block mb-1">SpO2 (%)</label>
                                            <input
                                              id="note-spo2"
                                              type="number"
                                              placeholder="98"
                                              value={newNote.spo2}
                                              onChange={(e) => setNewNote({ ...newNote, spo2: e.target.value })}
                                              className="w-full neu-inset rounded-xl px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 bg-transparent outline-none border border-slate-200/50 dark:border-white/5"
                                            />
                                          </div>
                                          <div>
                                            <label htmlFor="note-pain" className="text-xs font-bold text-tertiary block mb-1">Pain Scale (0-10)</label>
                                            <input
                                              id="note-pain"
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

                                      {/* Services Rendered (Rectangular buttons, NO pills) */}
                                      <div>
                                        <label className="text-2xs font-extrabold uppercase tracking-wider text-tertiary block mb-1.5">
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
                                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                                  isSelected
                                                    ? 'neu-pressed text-link font-extrabold'
                                                    : 'neu-btn text-slate-600 dark:text-slate-300'
                                                }`}
                                              >
                                                {service}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>

                                      {/* Clinical Assessment Textarea */}
                                      <div>
                                        <label htmlFor="note-assessment" className="text-2xs font-extrabold uppercase tracking-wider text-tertiary block mb-1">
                                          Clinical Evaluation &amp; Treatment Plan
                                        </label>
                                        <textarea
                                          id="note-assessment"
                                          required
                                          rows={3}
                                          placeholder="Document clinical observations, wound assessment, or medication guidance..."
                                          value={newNote.text}
                                          onChange={(e) => setNewNote({ ...newNote, text: e.target.value })}
                                          className="w-full neu-inset rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 bg-transparent outline-none resize-none"
                                        />
                                      </div>

                                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
                                        {/* File Attachment */}
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
                                              className="neu-btn px-3 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center justify-center gap-1.5 cursor-pointer transition-all truncate flex-1 min-w-0"
                                            >
                                              <Paperclip className="w-3.5 h-3.5 text-link shrink-0" />
                                              <span className="truncate">
                                                {newNote.file ? newNote.file.name : 'Attach Image/Document (Max 2MB)'}
                                              </span>
                                            </label>
                                            {newNote.file && (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setNewNote(n => ({ ...n, file: null }));
                                                  if (fileInputRef.current) fileInputRef.current.value = '';
                                                }}
                                                className="neu-btn p-2 rounded-xl text-tertiary hover:text-danger cursor-pointer shrink-0"
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

                                  {/* Bottom Section: Historical Visit Notes */}
                                  <div className="space-y-3.5 pt-2">
                                    <div className="flex items-center justify-between gap-3 border-b border-slate-200/50 dark:border-white/5 pb-2">
                                      <div>
                                        <h4 className="font-display font-extrabold text-sm text-slate-900 dark:text-white">
                                          Historical Progress Notes
                                        </h4>
                                        <p className="text-xs text-tertiary mt-0.5">
                                          Chronological record of clinical notes for this patient.
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
                                              className="neu-btn w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:text-link transition-all cursor-pointer"
                                              title="Previous notes"
                                            >
                                              <ChevronLeft className="w-3.5 h-3.5" />
                                            </button>
                                            <span className="text-xs font-extrabold text-tertiary px-1 select-none whitespace-nowrap">
                                              {notesPage} / {totalNotesPages}
                                            </span>
                                            <button
                                              type="button"
                                              disabled={notesPage >= totalNotesPages}
                                              onClick={() => setNotesPage((p) => Math.min(totalNotesPages, p + 1))}
                                              className="neu-btn w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:text-link transition-all cursor-pointer"
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
                                                  <p className="text-xs text-tertiary mt-0.5">
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
                                                    className="neu-btn p-1.5 rounded-lg text-tertiary hover:text-danger transition-colors cursor-pointer"
                                                    title="Delete Note"
                                                  >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                  </button>
                                                )}
                                              </div>

                                              {/* Vitals Badges (Rectangular, NO pills) */}
                                              {(note.vitals_bp || note.vitals_temp || note.vitals_hr || note.vitals_spo2 || note.vitals_rr || note.pain_scale != null) && (
                                                <div className="flex flex-wrap gap-1.5 text-xs font-extrabold">
                                                  {note.vitals_bp && (
                                                    <span className="neu-flat-sm px-2 py-0.5 rounded-md text-success dark:text-success-dark">
                                                      BP: {note.vitals_bp}
                                                    </span>
                                                  )}
                                                  {note.vitals_temp && (
                                                    <span className="neu-flat-sm px-2 py-0.5 rounded-md text-warning dark:text-warning-dark">
                                                      Temp: {note.vitals_temp}°C
                                                    </span>
                                                  )}
                                                  {note.vitals_hr && (
                                                    <span className="neu-flat-sm px-2 py-0.5 rounded-md text-danger dark:text-danger-dark">
                                                      HR: {note.vitals_hr} bpm
                                                    </span>
                                                  )}
                                                  {note.vitals_rr && (
                                                    <span className="neu-flat-sm px-2 py-0.5 rounded-md text-teal-600 dark:text-teal-400">
                                                      RR: {note.vitals_rr} bpm
                                                    </span>
                                                  )}
                                                  {note.vitals_spo2 && (
                                                    <span className="neu-flat-sm px-2 py-0.5 rounded-md text-link dark:text-primary-300">
                                                      SpO2: {note.vitals_spo2}%
                                                    </span>
                                                  )}
                                                  {note.pain_scale != null && (
                                                    <span className="neu-flat-sm px-2 py-0.5 rounded-md text-link dark:text-primary-400">
                                                      Pain: {note.pain_scale}/10
                                                    </span>
                                                  )}
                                                </div>
                                              )}

                                              {/* Services Tag */}
                                              {note.services_rendered && (
                                                <p className="text-xs font-bold text-link">
                                                  Services: <span className="font-medium text-slate-600 dark:text-slate-300">{note.services_rendered}</span>
                                                </p>
                                              )}

                                              {/* Assessment / Doctor's Note */}
                                              {note.notes && (
                                                <div className="neu-inset p-3 rounded-xl border border-slate-200/40 dark:border-white/5 space-y-1">
                                                  <p className="text-2xs font-extrabold uppercase tracking-wider text-link">
                                                    Clinical Assessment
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
                                                  className="neu-btn px-2.5 py-1.5 rounded-lg text-xs font-bold text-link flex items-center gap-1.5 cursor-pointer mt-1"
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
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </main>

                </div>
              )}
            </motion.div>
          </motion.div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

export default PatientRecordModal;
