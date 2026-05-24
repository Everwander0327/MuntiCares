import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { MessageCircle, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ChatWindow from '../../components/ChatWindow';
import ConversationList from '../../components/ConversationList';
import IncomingCallOverlay from '../../components/IncomingCallOverlay';
import { CallProvider } from '../../contexts/CallContext';
import { useLocation } from 'react-router-dom';
import useMediaQuery from '../../hooks/useMediaQuery';

const slideVariants = {
  initial: { x: '30%', opacity: 0 },
  animate: { x: 0, opacity: 1, transition: { type: 'spring', damping: 25, stiffness: 250 } },
  exit: { x: '30%', opacity: 0, transition: { duration: 0.15 } },
};

const PatientMessages = () => {
  const { user } = useAuth();
  const location = useLocation();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [view, setView] = useState('list');
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [currentUserData, setCurrentUserData] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [autoStartVideo, setAutoStartVideo] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('users')
      .select('full_name, email')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        setCurrentUserData({
          id: user.id,
          name: data?.full_name || 'Patient',
          email: data?.email,
        });
      });
  }, [user]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const targetId = params.get('provider') || params.get('partner');
    if (targetId && currentUserData) {
      const partnerName = params.get('name') || undefined;
      setSelectedPartner({ id: targetId, name: partnerName });
      setView('chat');
      if (params.get('startVideo') === '1') {
        setAutoStartVideo(true);
      }
      window.history.replaceState({}, '', location.pathname);
    }
  }, [location.search, currentUserData]);

  const handleSelect = (partner) => {
    setSelectedPartner(partner);
    setView('chat');
    setAutoStartVideo(false);
  };

  const handleBack = () => {
    setView('list');
    setSelectedPartner(null);
    setAutoStartVideo(false);
  };

  return (
    <CallProvider>
      <IncomingCallOverlay />
      <DashboardLayout role="patient">
        {view === 'list' ? (
          <div className="max-w-6xl h-[calc(100vh-120px)] md:h-[calc(100vh-80px)] flex flex-col mx-auto">
            <div className="mb-4">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Messages</h1>
              <p className="text-slate-500 dark:text-slate-400">Chat with your healthcare providers.</p>
            </div>
            <div className="flex-1 bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm dark:shadow-slate-900/50 overflow-hidden relative">
              <AnimatePresence mode="wait">
                <motion.div
                  key="list"
                  variants={slideVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="h-full flex flex-col"
                >
                  <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 space-y-3">
                    <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-primary" />
                      Conversations
                    </h3>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                      <input
                        type="text"
                        placeholder="Search conversations..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl py-2 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/10"
                      />
                    </div>
                  </div>
                  <ConversationList user={user} onSelect={handleSelect} searchTerm={searchTerm} />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        ) : isDesktop && currentUserData && selectedPartner?.id ? (
          <ChatWindow
            currentUser={currentUserData}
            otherUser={selectedPartner}
            onBack={handleBack}
            autoStartVideo={autoStartVideo}
          />
        ) : null}
      </DashboardLayout>

      {view === 'chat' && !isDesktop && currentUserData && selectedPartner?.id && (
        <div className="fixed inset-0 z-50">
          <ChatWindow
            currentUser={currentUserData}
            otherUser={selectedPartner}
            onBack={handleBack}
            autoStartVideo={autoStartVideo}
          />
        </div>
      )}
    </CallProvider>
  );
};

export default PatientMessages;
