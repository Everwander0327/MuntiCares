import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Activity, FileText, ClipboardList, Send, Loader2, ExternalLink, Trash2, Upload, Paperclip } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const PatientRecordModal = ({ isOpen, onClose, patientId, patientName }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('history');
  const [loading, setLoading] = useState(true);
  const [consentBlocked, setConsentBlocked] = useState(false);
  const [grantedPermissions, setGrantedPermissions] = useState(null);

  // Data States
  const [history, setHistory] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [notes, setNotes] = useState([]);

  // New Note State
  const [newNote, setNewNote] = useState({ 
    bp: '', temp: '', hr: '', rr: '', spo2: '', 
    pain: '', services: [], text: '', file: null 
  });
  const [savingNote, setSavingNote] = useState(false);

  const availableServices = ['Routine Checkup', 'Wound Care', 'IV Therapy', 'Physical Therapy', 'Medication Admin'];

  useEffect(() => {
    if (isOpen && patientId) {
      checkConsentThenLoad();
    }
  }, [isOpen, patientId]);

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
        setConsentBlocked(false);
        setGrantedPermissions(data.permissions || { medical_history: true, documents: true, visit_notes: true });
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

  const checkConsentThenLoad = async () => {
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

      setGrantedPermissions(data.permissions || { medical_history: true, documents: true, visit_notes: true });
      fetchPatientData();
      logDataAccess();
    } catch (err) {
      console.warn('Consent check failed:', err.message);
      setGrantedPermissions({ medical_history: true, documents: true, visit_notes: true });
      fetchPatientData();
      logDataAccess();
    }
  };

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
      const { data: histData } = await supabase
        .from('medical_histories')
        .select('*')
        .eq('patient_id', patientId)
        .single();
      
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
      fetchPatientData(); // refresh
    } catch (error) {
      console.error('Error saving note:', error);
      toast.error("Failed to add note. Did you run the SQL ALTER TABLE?");
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (noteId, filePath) => {
    if (!window.confirm("Are you sure you want to delete this progress note?")) return;
    
    try {
      // 1. Delete file if exists
      if (filePath) {
        await supabase.storage.from('medical_documents').remove([filePath]);
      }
      
      // 2. Delete from DB
      const { error } = await supabase.from('visit_notes').delete().eq('id', noteId);
      if (error) throw error;
      
      toast.success("Note deleted.");
      setNotes(notes.filter(n => n.id !== noteId));
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
      const { getSignedUrl } = await import('../lib/supabaseHelpers');
      return await getSignedUrl(filePath, 3600);
    } catch (err) {
      console.warn('Could not get signed url', err);
      return null;
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-4 bg-slate-900/50 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 100 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 100 }}
          className="bg-white rounded-t-3xl md:rounded-3xl w-full h-[95vh] md:h-auto max-w-4xl shadow-2xl overflow-hidden flex flex-col md:max-h-[90vh]"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Medical Record</h2>
              <p className="text-sm text-slate-500">Patient: <span className="font-bold text-primary">{patientName}</span></p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          {/* Consent Blocked Banner */}
          {consentBlocked ? (
            <div className="flex-1 flex flex-col items-center justify-center p-10 bg-slate-50/50 text-center">
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-5">
                <X className="w-10 h-10 text-red-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Data Access Revoked</h3>
              <p className="text-slate-500 max-w-md mb-6">
                <span className="font-bold">{patientName}</span> has revoked your access to their medical records. 
                You cannot view their data until they re-enable data sharing in their consent settings.
              </p>
              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-colors"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex border-b border-slate-100 bg-white shrink-0">
                <button 
                  onClick={() => grantedPermissions?.medical_history !== false && setActiveTab('history')}
                  className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-3 sm:py-4 font-bold text-sm border-b-2 transition-colors ${!grantedPermissions || grantedPermissions.medical_history !== false ? activeTab === 'history' ? 'border-primary text-primary bg-blue-50/50' : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50' : 'border-transparent text-slate-300 bg-slate-50 cursor-not-allowed'}`}
                >
                  <Activity className="w-5 h-5 sm:w-4 sm:h-4" /> <span className="text-[10px] sm:text-sm leading-tight text-center">Medical History</span>
                  {grantedPermissions?.medical_history === false && <span className="text-[8px] text-slate-300 ml-1">🔒</span>}
                </button>
                <button 
                  onClick={() => grantedPermissions?.documents !== false && setActiveTab('documents')}
                  className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-3 sm:py-4 font-bold text-sm border-b-2 transition-colors ${!grantedPermissions || grantedPermissions.documents !== false ? activeTab === 'documents' ? 'border-primary text-primary bg-blue-50/50' : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50' : 'border-transparent text-slate-300 bg-slate-50 cursor-not-allowed'}`}
                >
                  <FileText className="w-5 h-5 sm:w-4 sm:h-4" /> <span className="text-[10px] sm:text-sm leading-tight text-center">Docs ({documents.length})</span>
                  {grantedPermissions?.documents === false && <span className="text-[8px] text-slate-300 ml-1">🔒</span>}
                </button>
                <button 
                  onClick={() => grantedPermissions?.visit_notes !== false && setActiveTab('notes')}
                  className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-3 sm:py-4 font-bold text-sm border-b-2 transition-colors ${!grantedPermissions || grantedPermissions.visit_notes !== false ? activeTab === 'notes' ? 'border-primary text-primary bg-blue-50/50' : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50' : 'border-transparent text-slate-300 bg-slate-50 cursor-not-allowed'}`}
                >
                  <ClipboardList className="w-5 h-5 sm:w-4 sm:h-4" /> <span className="text-[10px] sm:text-sm leading-tight text-center">Progress Notes</span>
                  {grantedPermissions?.visit_notes === false && <span className="text-[8px] text-slate-300 ml-1">🔒</span>}
                </button>
              </div>

              {/* Content Area */}
              <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                {loading ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin mb-2" />
                <p>Loading patient records...</p>
              </div>
            ) : (
              <>
                {/* TAB 1: HISTORY */}
                {activeTab === 'history' && (
                  grantedPermissions?.medical_history === false ? (
                    <div className="text-center py-16">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <X className="w-7 h-7 text-slate-300" />
                      </div>
                      <p className="text-slate-600 font-bold">Medical History Not Shared</p>
                      <p className="text-sm text-slate-400 mt-1">The patient has not granted access to their medical history.</p>
                    </div>
                  ) : (
                  <div className="space-y-6">
                    {(!history?.allergies && !history?.chronic_conditions && !history?.past_surgeries) ? (
                      <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                          <Activity className="w-6 h-6 text-slate-300" />
                        </div>
                        <p className="text-slate-600 font-bold">No Medical History</p>
                        <p className="text-sm text-slate-500 mt-1">The patient has not updated their medical profile yet.</p>
                      </div>
                    ) : (
                      <>
                        <div className="bg-red-50/50 border border-red-100 rounded-2xl p-5">
                          <h3 className="text-red-800 font-bold mb-2 flex items-center gap-2">⚠️ Allergies</h3>
                          <p className="text-red-700 font-medium">{history?.allergies || 'No known allergies reported.'}</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                            <h3 className="text-slate-800 font-bold mb-2">Chronic Conditions</h3>
                            <p className="text-slate-600">{history?.chronic_conditions || 'None reported.'}</p>
                          </div>
                          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                            <h3 className="text-slate-800 font-bold mb-2">Past Surgeries</h3>
                            <p className="text-slate-600">{history?.past_surgeries || 'None reported.'}</p>
                          </div>
                        </div>
                      </>
                    )}
                    </div>
                  )
                )}

                {/* TAB 2: DOCUMENTS */}
                {activeTab === 'documents' && (
                  grantedPermissions?.documents === false ? (
                    <div className="text-center py-16">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <X className="w-7 h-7 text-slate-300" />
                      </div>
                      <p className="text-slate-600 font-bold">Documents Not Shared</p>
                      <p className="text-sm text-slate-400 mt-1">The patient has not granted access to their documents.</p>
                    </div>
                  ) : (
                  <div>
                    {documents.length === 0 ? (
                      <div className="text-center py-12">
                        <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500 font-medium">No documents uploaded by the patient yet.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {documents.map(doc => (
                          <div key={doc.id} className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-4 hover:border-primary/30 transition-colors">
                            <div className="w-12 h-12 bg-blue-50 text-primary rounded-xl flex items-center justify-center shrink-0">
                              <FileText className="w-6 h-6" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-slate-800 truncate">{doc.document_title}</p>
                              <p className="text-xs text-slate-500">{new Date(doc.uploaded_at).toLocaleDateString()}</p>
                            </div>
                            <button
                              onClick={async () => {
                                const url = await getFileUrl(doc.file_path);
                                if (url) window.open(url, '_blank');
                              }}
                              className="p-2 text-primary hover:bg-blue-50 rounded-lg transition-colors"
                              title="View Document"
                            >
                              <ExternalLink className="w-5 h-5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  )
                )}

                {/* TAB 3: PROGRESS NOTES */}
                {activeTab === 'notes' && (
                  grantedPermissions?.visit_notes === false ? (
                    <div className="text-center py-16">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <X className="w-7 h-7 text-slate-300" />
                      </div>
                      <p className="text-slate-600 font-bold">Progress Notes Not Shared</p>
                      <p className="text-sm text-slate-400 mt-1">The patient has not granted access to their visit notes.</p>
                    </div>
                  ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    {/* Add Note Form */}
                    <div className="lg:col-span-2">
                      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm sticky top-0">
                        <h3 className="font-bold text-slate-800 mb-4">Add Progress Note</h3>
                        <form onSubmit={handleSaveNote} className="space-y-4">
                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                            <div className="col-span-2 sm:col-span-3">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Vital Signs</p>
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-500">BP (mmHg)</label>
                              <input 
                                type="text" placeholder="120/80" value={newNote.bp} onChange={e => setNewNote({...newNote, bp: e.target.value})}
                                className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-500">Temp (°C)</label>
                              <input 
                                type="text" placeholder="36.5" value={newNote.temp} onChange={e => setNewNote({...newNote, temp: e.target.value})}
                                className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-500">Heart Rate</label>
                              <input 
                                type="number" placeholder="80" value={newNote.hr} onChange={e => setNewNote({...newNote, hr: e.target.value})}
                                className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-500">Resp Rate</label>
                              <input 
                                type="number" placeholder="16" value={newNote.rr} onChange={e => setNewNote({...newNote, rr: e.target.value})}
                                className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-500">SpO2 (%)</label>
                              <input 
                                type="number" placeholder="98" value={newNote.spo2} onChange={e => setNewNote({...newNote, spo2: e.target.value})}
                                className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none"
                              />
                            </div>
                            <div className="col-span-2 sm:col-span-1">
                              <label className="text-[10px] font-bold text-slate-500 text-orange-600">Pain Scale (1-10)</label>
                              <input 
                                type="number" min="0" max="10" placeholder="0" value={newNote.pain} onChange={e => setNewNote({...newNote, pain: e.target.value})}
                                className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Services Rendered</label>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {availableServices.map(service => (
                                <button
                                  key={service} type="button"
                                  onClick={() => toggleService(service)}
                                  className={`px-2 py-1 text-[10px] font-bold rounded-lg border transition-colors ${
                                    newNote.services.includes(service) ? 'bg-primary text-white border-primary' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                                  }`}
                                >
                                  {service}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="text-xs font-bold text-slate-500">Assessment & Plan</label>
                            <textarea 
                              required rows={3} placeholder="Type your clinical notes here..."
                              value={newNote.text} onChange={e => setNewNote({...newNote, text: e.target.value})}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none resize-none mt-1"
                            />
                          </div>

                          <div>
                            <input 
                              type="file" id="note-attachment" className="hidden" 
                              accept="image/jpeg, image/png, application/pdf"
                              onChange={(e) => {
                                const file = e.target.files[0];
                                if(file && file.size > 2*1024*1024) {
                                  toast.error("File is too large! Max 2MB.");
                                  e.target.value = '';
                                } else {
                                  setNewNote({...newNote, file});
                                }
                              }}
                            />
                            <label htmlFor="note-attachment" className="flex items-center gap-2 text-xs font-bold text-primary cursor-pointer hover:bg-blue-50 px-3 py-2 rounded-lg border border-dashed border-blue-200 w-full justify-center transition-colors">
                              <Paperclip className="w-3 h-3" />
                              {newNote.file ? newNote.file.name : 'Attach Photo/Document (Max 2MB)'}
                            </label>
                          </div>

                          <button 
                            type="submit" 
                            disabled={savingNote}
                            className="w-full flex items-center justify-center gap-2 bg-primary text-white font-bold py-2.5 rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
                          >
                            {savingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            Save Note
                          </button>
                        </form>
                      </div>
                    </div>

                    {/* Timeline */}
                    <div className="lg:col-span-3 space-y-4">
                      <h3 className="font-bold text-slate-800">Visit History</h3>
                      {notes.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
                          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                            <ClipboardList className="w-6 h-6 text-slate-300" />
                          </div>
                          <p className="text-slate-600 font-bold">No Visit History</p>
                          <p className="text-sm text-slate-500 mt-1">There are no progress notes for this patient yet.</p>
                        </div>
                      ) : (
                        <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                          {notes.map((note, idx) => (
                            <div key={note.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                              <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-blue-100 text-primary shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm relative z-10">
                                <ClipboardList className="w-4 h-4" />
                              </div>
                              <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                <div className="flex justify-between items-start mb-2">
                                  <h4 className="font-bold text-slate-800 text-sm">Dr. {note.provider?.full_name || 'Provider'}</h4>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-full">
                                      {new Date(note.created_at).toLocaleDateString()}
                                    </span>
                                    {note.provider_id === user.id && (
                                      <button onClick={() => handleDeleteNote(note.id, note.attachment_url)} className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors" title="Delete Note">
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-2 mb-2 text-[10px] font-bold text-slate-500 bg-slate-50 p-2 rounded-lg">
                                  {note.vitals_bp && <span>🩸 BP: {note.vitals_bp}</span>}
                                  {note.vitals_temp && <span>🌡️ T: {note.vitals_temp}°C</span>}
                                  {note.vitals_hr && <span>❤️ HR: {note.vitals_hr}</span>}
                                  {note.vitals_rr && <span>🫁 RR: {note.vitals_rr}</span>}
                                  {note.vitals_spo2 && <span>💨 SpO2: {note.vitals_spo2}%</span>}
                                  {note.pain_scale != null && <span className="text-orange-600">💥 Pain: {note.pain_scale}/10</span>}
                                </div>
                                {note.services_rendered && (
                                  <div className="mb-2">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Services:</span>
                                    <span className="text-xs font-semibold text-primary bg-blue-50 px-2 py-1 rounded-lg">{note.services_rendered}</span>
                                  </div>
                                )}
                                <p className="text-sm text-slate-700 whitespace-pre-wrap">{note.notes}</p>
                                
                                {note.attachment_url && (
                                  <a href={getFileUrl(note.attachment_url)} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-primary bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg transition-colors">
                                    <Paperclip className="w-3 h-3" /> View Attached File
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  )
                )}
              </>
            )}
          </div>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default PatientRecordModal;
