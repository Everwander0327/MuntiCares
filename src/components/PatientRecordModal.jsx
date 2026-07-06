import { useState } from 'react';
import { X, Activity, FileText, ClipboardList } from 'lucide-react';

const historyData = [
  { date: 'Jan 12, 2026', diagnosis: 'Hypertension - Routine Checkup', doctor: 'Dr. Maria Reyes' },
  { date: 'Dec 5, 2025', diagnosis: 'Upper Respiratory Tract Infection', doctor: 'Dr. Maria Reyes' },
  { date: 'Oct 20, 2025', diagnosis: 'Annual Physical Examination', doctor: 'Dr. Juan Santos' },
];

const documentsData = [
  { name: 'Medical History Form.pdf', date: 'Jan 10, 2026' },
  { name: 'Lab Results - Blood Work.pdf', date: 'Dec 15, 2025' },
  { name: 'Vaccination Record.pdf', date: 'Oct 5, 2025' },
];

const notesData = [
  { date: 'Jan 12, 2026', note: 'Patient is responding well to medication. BP has stabilized at 120/80. Continue current prescription.', provider: 'Maria Reyes' },
  { date: 'Dec 5, 2025', note: 'Prescribed antibiotics for URTI. Patient advised to rest and increase fluid intake. Follow-up in 1 week.', provider: 'Maria Reyes' },
];

const PatientRecordModal = ({ isOpen, onClose, patientName }) => {
  const [activeTab, setActiveTab] = useState('history');

  if (!isOpen) return null;

  const tabs = [
    { key: 'history', label: 'History', icon: Activity },
    { key: 'documents', label: 'Documents', icon: FileText },
    { key: 'notes', label: 'Visit Notes', icon: ClipboardList },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-lg font-bold text-slate-900">{patientName || 'Patient'}'s Records</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        <div className="flex border-b border-slate-100 px-6">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all ${active ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                <Icon className="w-4 h-4" />{tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-6">
          {activeTab === 'history' && (
            <div className="space-y-3">
              {historyData.map((h, i) => (
                <div key={i} className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="flex justify-between text-xs text-slate-400 mb-1"><span>{h.date}</span><span>{h.doctor}</span></div>
                  <p className="text-sm font-semibold text-slate-700">{h.diagnosis}</p>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="space-y-2">
              {documentsData.map((d, i) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-primary" />
                    <div><p className="text-sm font-semibold text-slate-700">{d.name}</p><p className="text-xs text-slate-400">{d.date}</p></div>
                  </div>
                  <span className="text-xs text-primary font-semibold">View</span>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="space-y-3">
              {notesData.map((n, i) => (
                <div key={i} className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="flex justify-between text-xs text-slate-400 mb-1"><span>{n.date}</span><span className="font-semibold text-primary">{n.provider}</span></div>
                  <p className="text-sm text-slate-700">{n.note}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PatientRecordModal;
