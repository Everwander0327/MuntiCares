import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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

const ProviderMessages = () => {
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
      .select('full_name, email, avatar_url')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        setCurrentUserData({
          id: user.id,
          name: data?.full_name || 'Provider',
          email: data?.email,
          avatar_url: data?.avatar_url || '',
        });
      });
  }, [user]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const targetId = params.get('provider') || params.get('partner') || params.get('user');
    if (targetId && currentUserData) {
      const partnerName = params.get('name') || undefined;
      supabase
        .from('users')
        .select('full_name, avatar_url')
        .eq('id', targetId)
        .single()
        .then(({ data: partData }) => {
          setSelectedPartner({
            id: targetId,
            name: partData?.full_name || partnerName || 'User',
            photoUrl: partData?.avatar_url || '',
          });
        })
        .catch(() => {
          setSelectedPartner({ id: targetId, name: partnerName });
        });

      setView('chat');
      if (params.get('startVideo') === '1') {
        setAutoStartVideo(true);
      }
      window.history.replaceState({}, '', location.pathname);
    }
  }, [location.search, currentUserData, location.pathname]);

  useEffect(() => {
    if (view === 'chat') {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [view]);

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
      <DashboardLayout role="provider">
        {view === 'list' ? (
          <div className="flex-1 flex flex-col space-y-4 sm:space-y-6 relative w-full max-w-full">
            {/* Neumorphic Header Card */}
            <section className="neu-flat p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-[2.25rem] space-y-4 sm:space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h1 className="font-display font-extrabold tracking-tight text-xl sm:text-2xl md:text-3xl text-slate-900 dark:text-white">
                    Messages
                  </h1>
                  <p className="text-2xs sm:text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-0.5 sm:mt-1 max-w-xl">
                    Chat in real-time or conduct teleconsultations with your registered patients.
                  </p>
                </div>
              </div>

              {/* Neumorphic Inset Search Bar */}
              <div className="neu-inset p-1.5 sm:p-2 rounded-2xl flex items-center gap-2.5 h-[48px] sm:h-[52px]">
                <Search className="w-4 h-4 text-primary ml-2 shrink-0" />
                <input
                  type="text"
                  placeholder="Search patient, conversations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-transparent border-0 px-1 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 outline-none focus:outline-none focus:ring-0 placeholder:text-slate-400 placeholder:font-normal min-w-0"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="neu-btn w-7 h-7 rounded-xl flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors shrink-0 mr-1 cursor-pointer"
                    title="Clear search"
                  >
                    <span className="text-xs font-bold leading-none">✕</span>
                  </button>
                )}
              </div>
            </section>

            {/* Conversation Feed */}
            <div className="flex-1 min-h-0">
              <ConversationList user={user} onSelect={handleSelect} searchTerm={searchTerm} />
            </div>
          </div>
        ) : null}
      </DashboardLayout>

      {/* Full-Screen Immersive Chat Window (Escapes DashboardLayout stacking via Portal) */}
      {createPortal(
        <AnimatePresence>
          {view === 'chat' && currentUserData && selectedPartner?.id && (
            <motion.div
              initial={{ opacity: 0, scale: 0.99 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.99 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-0 z-[9999] bg-[#ebf1f8] dark:bg-[#172236] flex flex-col w-screen h-screen overflow-hidden"
            >
              <ChatWindow
                currentUser={currentUserData}
                otherUser={selectedPartner}
                onBack={handleBack}
                autoStartVideo={autoStartVideo}
              />
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </CallProvider>
  );
};

export default ProviderMessages;
