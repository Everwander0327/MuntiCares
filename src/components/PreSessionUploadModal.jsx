import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, FileText, Image, Trash2, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

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
  const fileInputRef = useRef(null);

  if (!isOpen || !request) return null;

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

      // 2. Save pre-session data to the request notes or a dedicated table
      const presessionData = {
        symptom_notes: symptomNotes,
        vitals_bp: vitals.bp || null,
        vitals_temp: vitals.temp || null,
        vitals_hr: vitals.hr || null,
        weight: vitals.weight || null,
        attachments: uploadedUrls,
        submitted_at: new Date().toISOString()
      };

      // Try inserting into presession_data table first
      const { error: tableError } = await supabase
        .from('presession_data')
        .insert([{
          request_id: request.id,
          patient_id: request.patientId,
          provider_id: request.providerId,
          ...presessionData
        }]);

      if (tableError) {
        console.warn('presession_data table not found, appending to request notes:', tableError);
        
        // Fallback: append pre-session info to the request's notes field
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

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-white rounded-[2.5rem] p-8 max-w-lg w-full border border-slate-100 shadow-2xl relative my-8"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute right-6 top-6 p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="text-center pr-8">
              <span className="text-3xl">🩺</span>
              <h2 className="text-xl font-bold text-slate-900 mt-2">Pre-Session Information</h2>
              <p className="text-sm text-slate-500 mt-1">
                Help <span className="font-bold text-primary">{request.providerName}</span> prepare for your visit
              </p>
            </div>

            {/* Self-Measured Vitals */}
            <div className="space-y-3">
              <h4 className="text-xs uppercase font-bold text-slate-400 tracking-wider">Self-Measured Vitals (Optional)</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-500">Blood Pressure</label>
                  <input
                    type="text"
                    placeholder="e.g. 120/80"
                    value={vitals.bp}
                    onChange={e => setVitals({ ...vitals, bp: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl py-2.5 px-3 outline-none focus:ring-2 focus:ring-primary/10 text-sm text-slate-800 placeholder-slate-300 transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-500">Temperature (°C)</label>
                  <input
                    type="text"
                    placeholder="e.g. 36.5"
                    value={vitals.temp}
                    onChange={e => setVitals({ ...vitals, temp: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl py-2.5 px-3 outline-none focus:ring-2 focus:ring-primary/10 text-sm text-slate-800 placeholder-slate-300 transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-500">Heart Rate (bpm)</label>
                  <input
                    type="text"
                    placeholder="e.g. 72"
                    value={vitals.hr}
                    onChange={e => setVitals({ ...vitals, hr: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl py-2.5 px-3 outline-none focus:ring-2 focus:ring-primary/10 text-sm text-slate-800 placeholder-slate-300 transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-500">Weight (kg)</label>
                  <input
                    type="text"
                    placeholder="e.g. 65"
                    value={vitals.weight}
                    onChange={e => setVitals({ ...vitals, weight: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl py-2.5 px-3 outline-none focus:ring-2 focus:ring-primary/10 text-sm text-slate-800 placeholder-slate-300 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Symptom Notes */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Describe Your Symptoms</label>
              <textarea
                value={symptomNotes}
                onChange={e => setSymptomNotes(e.target.value)}
                placeholder="Describe what you're experiencing — headache, fever, dizziness, etc..."
                rows={3}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-primary/10 transition-all text-sm resize-none text-slate-800 placeholder-slate-400"
              />
            </div>

            {/* File Upload */}
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
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
                className="w-full border-2 border-dashed border-slate-200 hover:border-primary/30 rounded-2xl py-6 flex flex-col items-center gap-2 transition-all hover:bg-blue-50/30 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Upload className="w-6 h-6 text-slate-400" />
                <p className="text-sm text-slate-500 font-medium">Tap to upload photos or documents</p>
                <p className="text-[10px] text-slate-400">JPG, PNG, PDF • Max 5 files</p>
              </button>

              {/* File Preview List */}
              {files.length > 0 && (
                <div className="space-y-2">
                  {files.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <div className="flex items-center gap-3 min-w-0">
                        {getFileIcon(file)}
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-700 truncate">{file.name}</p>
                          <p className="text-[10px] text-slate-400">{formatFileSize(file.size)}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Submit */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 border border-slate-100 hover:bg-slate-50 rounded-2xl font-bold text-slate-600 transition-all text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={uploading}
                className="w-full py-3 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white rounded-2xl font-bold transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 text-sm"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Submit Info
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PreSessionUploadModal;
