import { useState, useRef } from 'react';
import { X, Upload, FileText, Image, Trash2, Info } from 'lucide-react';

const CHECKLIST_ITEMS = [
  { key: 'id', label: 'Prepare your medical ID or identification card' },
  { key: 'medications', label: 'List your current medications and dosages' },
  { key: 'insurance', label: 'Have your insurance card ready' },
  { key: 'questions', label: 'Prepare questions for your provider' },
  { key: 'space', label: 'Clear a space in your home for the visit' },
  { key: 'companion', label: 'Ensure a family member or friend can be present' },
];

const PreSessionUploadModal = ({ isOpen, onClose, request }) => {
  const [files, setFiles] = useState([]);
  const [symptomNotes, setSymptomNotes] = useState('');
  const [vitals, setVitals] = useState({ bp: '', temp: '', hr: '', weight: '' });
  const [checklist, setChecklist] = useState({});
  const [comingSoon, setComingSoon] = useState('');
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileSelect = (e) => {
    const selected = Array.from(e.target.files);
    if (files.length + selected.length > 5) return;
    setFiles(prev => [...prev, ...selected]);
  };

  const removeFile = (idx) => setFiles(prev => prev.filter((_, i) => i !== idx));

  const toggleChecklist = (key) => setChecklist(prev => ({ ...prev, [key]: !prev[key] }));

  const handleComingSoon = () => {
    setComingSoon('Pre-session preparation is coming soon.');
    setTimeout(() => { setComingSoon(''); onClose(); }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-lg font-bold text-slate-900">Prepare for Visit</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        <div className="p-6 space-y-6">
          {comingSoon && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 border border-blue-100 text-sm text-blue-700 font-semibold">
              <Info className="w-4 h-4" /> {comingSoon}
            </div>
          )}

          <div>
            <label className="text-sm font-semibold text-slate-700 mb-3 block">Pre-Visit Checklist</label>
            <div className="space-y-2">
              {CHECKLIST_ITEMS.map(item => (
                <label key={item.key} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${checklist[item.key] ? 'border-green-400 bg-green-50' : 'border-slate-100 hover:border-slate-200'}`}>
                  <input type="checkbox" checked={!!checklist[item.key]} onChange={() => toggleChecklist(item.key)} className="accent-green-500" />
                  <span className={`text-sm ${checklist[item.key] ? 'text-green-700 line-through' : 'text-slate-700'}`}>{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700 mb-2 block">Upload Files (max 5)</label>
            <input type="file" multiple ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} className="w-full p-6 rounded-2xl border-2 border-dashed border-slate-200 hover:border-primary hover:bg-blue-50 transition-all flex flex-col items-center gap-2">
              <Upload className="w-6 h-6 text-slate-400" />
              <span className="text-sm text-slate-500">Tap to upload medical documents, photos, etc.</span>
            </button>
            {files.length > 0 && (
              <div className="mt-3 space-y-2">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center justify-between bg-slate-50 p-3 rounded-xl">
                    <div className="flex items-center gap-2">
                      {f.type.startsWith('image/') ? <Image className="w-4 h-4 text-blue-500" /> : <FileText className="w-4 h-4 text-orange-500" />}
                      <span className="text-sm text-slate-700">{f.name}</span>
                      <span className="text-xs text-slate-400">({(f.size / 1024).toFixed(1)} KB)</span>
                    </div>
                    <button onClick={() => removeFile(i)} className="p-1 hover:bg-red-100 rounded-lg"><Trash2 className="w-4 h-4 text-red-400" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700 mb-2 block">Symptoms / Notes</label>
            <textarea value={symptomNotes} onChange={e => setSymptomNotes(e.target.value)} rows={3} placeholder="Describe your symptoms..." className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-primary resize-none" />
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2">Vitals (optional)</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'bp', label: 'Blood Pressure' },
                { key: 'temp', label: 'Temperature (°C)' },
                { key: 'hr', label: 'Heart Rate (bpm)' },
                { key: 'weight', label: 'Weight (kg)' },
              ].map(v => (
                <div key={v.key}>
                  <label className="text-xs text-slate-500 mb-1 block">{v.label}</label>
                    <input value={vitals[v.key]} onChange={e => setVitals(prev => ({ ...prev, [v.key]: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-primary" />
                </div>
              ))}
            </div>
          </div>

          <button onClick={handleComingSoon} className="w-full py-3 rounded-xl bg-primary text-white font-semibold hover:bg-blue-600">Save Preparation</button>
        </div>
      </div>
    </div>
  );
};

export default PreSessionUploadModal;
