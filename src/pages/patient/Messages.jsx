import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { SkeletonPage } from '../../components/Skeleton';
import { MessageSquareWarning, MessageCircle } from 'lucide-react';
import ChatWindow from '../../components/ChatWindow';

const PatientMessages = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [patientData, setPatientData] = useState(null);
  const [providers, setProviders] = useState([]);
  const [activeProvider, setActiveProvider] = useState(null);

  useEffect(() => {
    const fetchChatData = async () => {
      if (!user) return;
      try {
        // 1. Fetch current patient user info
        const { data: userData } = await supabase
          .from('users')
          .select('full_name, email')
          .eq('id', user.id)
          .single();

        setPatientData({
          id: user.id,
          name: userData.full_name || 'Patient',
          email: userData.email,
        });

        // 2. Fetch all providers this patient has accepted requests with
        const { data: reqData } = await supabase
          .from('requests')
          .select('provider_id, provider:provider_id(full_name, email)')
          .eq('patient_id', user.id)
          .in('status', ['Accepted', 'On The Way', 'Arrived', 'Completed']);

        const uniqueProviders = [];
        const seenIds = new Set();
        
        (reqData || []).forEach(req => {
          if (!seenIds.has(req.provider_id) && req.provider) {
            seenIds.add(req.provider_id);
            uniqueProviders.push({
              id: req.provider_id,
              name: req.provider.full_name || 'Doctor',
              email: req.provider.email,
              photoUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(req.provider.full_name || 'Dr')}&background=F3E8FF&color=9333EA`,
            });
          }
        });

        setProviders(uniqueProviders);
        if (uniqueProviders.length > 0) {
          setActiveProvider(uniqueProviders[0]);
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
    return <DashboardLayout role="patient"><SkeletonPage /></DashboardLayout>;
  }

  return (
    <DashboardLayout role="patient">
      <div className="max-w-6xl h-[calc(100vh-120px)] md:h-[calc(100vh-80px)] flex flex-col mx-auto">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-slate-900">Teleconsultation Messages</h1>
          <p className="text-slate-500">Chat directly with your healthcare providers.</p>
        </div>

        <div className="flex-1 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden relative flex">
          {providers.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 bg-slate-50">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm border border-slate-100">
                <MessageSquareWarning className="w-8 h-8 text-slate-300" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">No active chats</h3>
              <p className="text-sm">You can chat with providers once a home care request is accepted.</p>
            </div>
          ) : (
            <>
              {/* Sidebar Contact List */}
              <div className="w-72 bg-white border-r border-slate-100 flex flex-col shrink-0 hidden md:flex">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-primary" /> 
                    Your Providers
                  </h3>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  {providers.map(provider => (
                    <button
                      key={provider.id}
                      onClick={() => setActiveProvider(provider)}
                      className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all mb-1 ${activeProvider?.id === provider.id ? 'bg-primary/10 text-primary' : 'hover:bg-slate-50 text-slate-700'}`}
                    >
                      <div className="w-10 h-10 rounded-full bg-blue-100 overflow-hidden shrink-0">
                        <img src={provider.photoUrl} alt="avatar" className="w-full h-full object-cover" />
                      </div>
                      <div className="text-left min-w-0">
                        <p className="font-bold text-sm truncate">{provider.name}</p>
                        <p className={`text-xs truncate ${activeProvider?.id === provider.id ? 'text-primary/70' : 'text-slate-400'}`}>Tap to chat</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Main Chat Area */}
              <div className="flex-1 flex flex-col bg-slate-50">
                {activeProvider ? (
                  <ChatWindow currentUser={patientData} otherUser={activeProvider} />
                ) : (
                  <div className="flex-1 flex items-center justify-center text-slate-400">Select a provider to start chatting</div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default PatientMessages;
