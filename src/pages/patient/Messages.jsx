import { useState } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import ComingSoonModal from '../../components/ComingSoonModal';

const messages = [
  { from: 'Maria Santos', lastMessage: 'I will be there at 9am tomorrow.', time: '2 hours ago', unread: true },
  { from: 'Juan Reyes', lastMessage: 'Thank you for your feedback!', time: '1 day ago', unread: false },
];

const PatientMessages = () => {
  const [showComingSoon, setShowComingSoon] = useState(false);

  return (
    <DashboardLayout role="patient">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Messages</h1>
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          {messages.map((m, i) => (
            <div key={i} onClick={() => setShowComingSoon(true)} className={`p-4 border-b border-slate-50 flex items-center gap-4 cursor-pointer hover:bg-slate-50 transition-colors ${m.unread ? 'bg-blue-50' : ''}`}>
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                {m.from.split(' ').map(n => n[0]).join('')}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-slate-900">{m.from}</p>
                  <span className="text-xs text-slate-400">{m.time}</span>
                </div>
                <p className="text-sm text-slate-500">{m.lastMessage}</p>
              </div>
              {m.unread && <div className="w-2 h-2 rounded-full bg-primary" />}
            </div>
          ))}
        </div>
      </div>

      <ComingSoonModal isOpen={showComingSoon} onClose={() => setShowComingSoon(false)} message="Messaging is coming soon." />
    </DashboardLayout>
  );
};

export default PatientMessages;
