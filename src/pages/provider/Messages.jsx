import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { SkeletonPage } from '../../components/Skeleton';
import { MessageSquareWarning, MessageCircle } from 'lucide-react';
import ChatWindow from '../../components/ChatWindow';

const ProviderMessages = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [providerData, setProviderData] = useState(null);
  const [patients, setPatients] = useState([]);
  const [activePatient, setActivePatient] = useState(null);

  useEffect(() => {
    const fetchChatData = async () => {
      if (!user) return;
      try {
        // 1. Fetch current provider user info
        const { data: userData } = await supabase
          .from('users')
          .select('full_name, email')
          .eq('id', user.id)
          .single();

        setProviderData({
          id: user.id,
          name: userData.full_name || 'Provider',
          email: userData.email,
        });

        // 2. Fetch all patients this provider has accepted requests with
        const { data: reqData } = await supabase
          .from('requests')
          .select('patient_id, patient:patient_id(full_name, email)')
          .eq('provider_id', user.id)
          .in('status', ['Accepted', 'On The Way', 'Arrived', 'Completed']);

        const uniquePatients = [];
        const seenIds = new Set();
        
        (reqData || []).forEach(req => {
          if (!seenIds.has(req.patient_id) && req.patient) {
            seenIds.add(req.patient_id);
            uniquePatients.push({
              id: req.patient_id,
              name: req.patient.full_name || 'Patient',
              email: req.patient.email,
              photoUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(req.patient.full_name || 'Pt')}&background=E0F2FE&color=2563EB`,
            });
          }
        });

        setPatients(uniquePatients);
        if (uniquePatients.length > 0) {
          setActivePatient(uniquePatients[0]);
        }
      } catch (err) {
        console.error('Error fetching chat data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchChatData();
  }, [user]);

  if (loading) {
    return <DashboardLayout role="provider"><SkeletonPage /></DashboardLayout>;
  }

  return (
    <DashboardLayout role="provider">
      <div className="max-w-6xl h-[calc(100vh-120px)] md:h-[calc(100vh-80px)] flex flex-col mx-auto">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-slate-900">Teleconsultation Messages</h1>
          <p className="text-slate-500">Chat directly with your patients.</p>
        </div>

        <div className="flex-1 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden relative flex">
          {patients.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 bg-slate-50">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm border border-slate-100">
                <MessageSquareWarning className="w-8 h-8 text-slate-300" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">No active chats</h3>
              <p className="text-sm">You can chat with patients once you accept their home care request.</p>
            </div>
          ) : (
            <>
              {/* Sidebar Contact List */}
              <div className="w-72 bg-white border-r border-slate-100 flex flex-col shrink-0 hidden md:flex">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-primary" /> 
                    Your Patients
                  </h3>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  {patients.map(patient => (
                    <button
                      key={patient.id}
                      onClick={() => setActivePatient(patient)}
                      className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all mb-1 ${activePatient?.id === patient.id ? 'bg-primary/10 text-primary' : 'hover:bg-slate-50 text-slate-700'}`}
                    >
                      <div className="w-10 h-10 rounded-full bg-blue-100 overflow-hidden shrink-0">
                        <img src={patient.photoUrl} alt="avatar" className="w-full h-full object-cover" />
                      </div>
                      <div className="text-left min-w-0">
                        <p className="font-bold text-sm truncate">{patient.name}</p>
                        <p className={`text-xs truncate ${activePatient?.id === patient.id ? 'text-primary/70' : 'text-slate-400'}`}>Tap to chat</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Main Chat Area */}
              <div className="flex-1 flex flex-col bg-slate-50">
                {activePatient ? (
                  <ChatWindow currentUser={providerData} otherUser={activePatient} />
                ) : (
                  <div className="flex-1 flex items-center justify-center text-slate-400">Select a patient to start chatting</div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ProviderMessages;
