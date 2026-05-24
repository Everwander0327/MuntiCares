import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, Image, Trash2, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { Button } from './ui/button';

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
    if (isOpen && request?.id) {
      setChecklist(loadChecklist(request.id));
    }
  }, [isOpen, request?.id]);

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
    if (file.type.startsWith('image/')) return <Image className="w-4 h-4 text-blue-500" />;
    return <FileText className="w-4 h-4 text-orange-500" />;
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
        const fileName = `${request.patientId}/${request.id}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('medical-documents')
          .upload(fileName, file);

        if (uploadError) {
          console.warn('Storage upload failed:', uploadError);
          // Try alternative bucket name
          const { error: altError } = await supabase.storage
            .from('documents')
            .upload(fileName, file);
          
          if (altError) {
            console.warn('Alt storage upload also failed:', altError);
            continue;
          }
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

  if (!request) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg p-8 overflow-y-auto max-h-[90vh]">
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogHeader>
            <div className="text-center">
              <span className="text-3xl">🩺</span>
              <DialogTitle className="mt-2">Pre-Session Information</DialogTitle>
              <DialogDescription className="mt-1">
                Help <span className="font-bold text-primary">{request.providerName}</span> prepare for your visit
              </DialogDescription>
            </div>
          </DialogHeader>

            {/* Preparation Checklist */}
            <div className="space-y-3">
              <h4 className="text-xs uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">Preparation Checklist</h4>
              <div className="bg-blue-50/50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 rounded-2xl p-4 space-y-2">
                {CHECKLIST_ITEMS.map(item => (
                  <label
                    key={item.key}
                    className="flex items-center gap-3 py-1 cursor-pointer group"
                  >
                    <div
                      onClick={(e) => {
                        e.preventDefault();
                        setChecklist(prev => {
                          const next = { ...prev, [item.key]: !prev[item.key] };
                          saveChecklist(request.id, next);
                          return next;
                        });
                      }}
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                        checklist[item.key]
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 group-hover:border-primary/40'
                      }`}
                    >
                      {checklist[item.key] && (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className={`text-sm transition-colors ${checklist[item.key] ? 'text-slate-500 dark:text-slate-400 line-through' : 'text-slate-700 dark:text-slate-200'}`}>
                      {item.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Self-Measured Vitals */}
            <div className="space-y-3">
              <h4 className="text-xs uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">Self-Measured Vitals (Optional)</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Blood Pressure</label>
                  <input
                    type="text"
                    placeholder="e.g. 120/80"
                    value={vitals.bp}
                    onChange={e => setVitals({ ...vitals, bp: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl py-2.5 px-3 outline-none focus:ring-2 focus:ring-primary/10 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-300 dark:placeholder-slate-500 transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Temperature (°C)</label>
                  <input
                    type="text"
                    placeholder="e.g. 36.5"
                    value={vitals.temp}
                    onChange={e => setVitals({ ...vitals, temp: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl py-2.5 px-3 outline-none focus:ring-2 focus:ring-primary/10 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-300 dark:placeholder-slate-500 transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Heart Rate (bpm)</label>
                  <input
                    type="text"
                    placeholder="e.g. 72"
                    value={vitals.hr}
                    onChange={e => setVitals({ ...vitals, hr: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl py-2.5 px-3 outline-none focus:ring-2 focus:ring-primary/10 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-300 dark:placeholder-slate-500 transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Weight (kg)</label>
                  <input
                    type="text"
                    placeholder="e.g. 65"
                    value={vitals.weight}
                    onChange={e => setVitals({ ...vitals, weight: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl py-2.5 px-3 outline-none focus:ring-2 focus:ring-primary/10 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-300 dark:placeholder-slate-500 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Symptom Notes */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Describe Your Symptoms</label>
              <textarea
                value={symptomNotes}
                onChange={e => setSymptomNotes(e.target.value)}
                placeholder="Describe what you're experiencing — headache, fever, dizziness, etc..."
                rows={3}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-primary/10 transition-all text-sm resize-none text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
              />
            </div>

            {/* File Upload */}
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
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
                className="w-full border-2 border-dashed border-slate-200 dark:border-slate-600 hover:border-primary/30 rounded-2xl py-6 flex flex-col items-center gap-2 transition-all hover:bg-blue-50/30 dark:hover:bg-blue-900/10 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Upload className="w-6 h-6 text-slate-400 dark:text-slate-500" />
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Tap to upload photos or documents</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">JPG, PNG, PDF • Max 5 files</p>
              </button>

              {/* File Preview List */}
              {files.length > 0 && (
                <div className="space-y-2">
                  {files.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl">
                      <div className="flex items-center gap-3 min-w-0">
                        {getFileIcon(file)}
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{file.name}</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500">{formatFileSize(file.size)}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="p-1.5 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={uploading}>
                {uploading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
                ) : (
                  <><CheckCircle2 className="w-4 h-4" /> Submit Info</>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    );
  };

export default PreSessionUploadModal;
