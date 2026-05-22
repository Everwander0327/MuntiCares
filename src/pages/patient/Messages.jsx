import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { MessageCircle, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ChatWindow from '../../components/ChatWindow';
import ConversationList from '../../components/ConversationList';
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
    const targetId = params.get('provider');
    if (targetId && currentUserData) {
      setSelectedPartner({ id: targetId });
      setView('chat');
    }
  }, [location.search, currentUserData]);

  const handleSelect = (partner) => {
    setSelectedPartner(partner);
    setView('chat');
  };

  const handleBack = () => {
    setView('list');
    setSelectedPartner(null);
  };

  return (
    <>
      <DashboardLayout role="patient">
        {view === 'list' ? (
          <div className="max-w-6xl h-[calc(100vh-120px)] md:h-[calc(100vh-80px)] flex flex-col mx-auto">
            <div className="mb-4">
              <h1 className="text-2xl font-bold text-slate-900">Messages</h1>
              <p className="text-slate-500">Chat with your healthcare providers.</p>
            </div>
            <div className="flex-1 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden relative">
              <AnimatePresence mode="wait">
                <motion.div
                  key="list"
                  variants={slideVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="h-full flex flex-col"
                >
                  <div className="p-4 border-b border-slate-100 bg-slate-50/50 space-y-3">
                    <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-primary" />
                      Conversations
                    </h3>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search conversations..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/10"
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
          />
        ) : null}
      </DashboardLayout>

      {view === 'chat' && !isDesktop && currentUserData && selectedPartner?.id && (
        <div className="fixed inset-0 z-50">
          <ChatWindow
            currentUser={currentUserData}
            otherUser={selectedPartner}
            onBack={handleBack}
          />
        </div>
      )}
    </>
  );
};

export default PatientMessages;
