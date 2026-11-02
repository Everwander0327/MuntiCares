import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import DashboardLayout from '@/layouts/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { initialsAvatar } from '@/lib/avatar';
import { MessageCircle, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChatWindow, ConversationList } from '@/features/chat';
import { useLocation } from 'react-router-dom';

const PatientMessages = () => {
  const { user } = useAuth();
  const location = useLocation();

  const [view, setView] = useState('list');
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [isDesktop, setIsDesktop] = useState(() => 
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );
  const [currentUserData, setCurrentUserData] = useState(() =>
    user
      ? {
          id: user.id,
          name: user.full_name || 'Patient',
          email: user.email,
          avatar_url: user.avatar_url || '',
        }
      : null
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [autoStartVideo, setAutoStartVideo] = useState(false);
  const [autoStartCall, setAutoStartCall] = useState(null);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!user) return;
    setCurrentUserData((prev) =>
      prev?.id === user.id
        ? prev
        : {
            id: user.id,
            name: user.full_name || 'Patient',
            email: user.email,
            avatar_url: user.avatar_url || '',
          }
    );
    supabase
      .from('users')
      .select('full_name, email, avatar_url')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (!data) return;
        setCurrentUserData((prev) => {
          const next = {
            id: user.id,
            name: data.full_name || user.full_name || 'Patient',
            email: data.email || user.email,
            avatar_url: data.avatar_url || user.avatar_url || '',
          };
          if (
            prev &&
            prev.id === next.id &&
            prev.name === next.name &&
            prev.email === next.email &&
            prev.avatar_url === next.avatar_url
          ) {
            return prev;
          }
          return next;
        });
      });
  }, [user]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const targetId = params.get('provider') || params.get('partner') || params.get('user');
    if (targetId && currentUserData) {
      const partnerName = params.get('name') || undefined;
      const initialName = partnerName || 'Provider';
      setSelectedPartner({
        id: targetId,
        name: initialName,
        photoUrl: initialsAvatar(initialName, { background: 'DDEBF8', color: '2F6FB5' }),
      });
      supabase
        .from('users')
        .select('full_name, avatar_url')
        .eq('id', targetId)
        .single()
        .then(({ data: partData }) => {
          const resolvedName = partData?.full_name || partnerName || 'Provider';
          setSelectedPartner({
            id: targetId,
            name: resolvedName,
            photoUrl:
              partData?.avatar_url ||
              initialsAvatar(resolvedName, { background: 'DDEBF8', color: '2F6FB5' }),
          });
        })
        .catch(() => {
          setSelectedPartner({
            id: targetId,
            name: initialName,
            photoUrl: initialsAvatar(initialName, { background: 'DDEBF8', color: '2F6FB5' }),
          });
        });

      setView('chat');
      const startCallParam = params.get('startCall');
      const startVideoParam = params.get('startVideo');
      const tsParam = params.get('ts');
      const callIdParam = params.get('call');
      if (startCallParam) {
        setAutoStartCall({ active: true, type: startCallParam, ts: tsParam || Date.now(), callId: callIdParam || null });
        if (startCallParam === 'video') setAutoStartVideo(true);
      } else if (startVideoParam === '1') {
        setAutoStartCall({ active: true, type: 'video', ts: tsParam || Date.now(), callId: callIdParam || null });
        setAutoStartVideo(true);
      }
      window.history.replaceState({}, '', location.pathname);
    }
  }, [location.search, currentUserData, location.pathname]);

  useEffect(() => {
    if (view === 'chat' && !isDesktop) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [view, isDesktop]);

  const handleSelect = (partner) => {
    setSelectedPartner(partner);
    setView('chat');
    setAutoStartVideo(false);
    setAutoStartCall(null);
  };

  const handleBack = () => {
    setView('list');
    setSelectedPartner(null);
    setAutoStartVideo(false);
    setAutoStartCall(null);
  };

  return (
    <>
      <DashboardLayout role="patient">
        {/* ================= UNIFIED MESSENGER CONTAINER ================= */}
        <div className="flex-1 neu-flat rounded-2xl sm:rounded-[2rem] overflow-hidden flex flex-col lg:flex-row h-full max-h-full min-h-0 border border-slate-200/80 dark:border-white/10 shadow-sm w-full">
          {/* Threads List Pane (Full width on mobile, 288px-320px on desktop) */}
          <div className="w-full lg:w-72 xl:w-80 border-b lg:border-b-0 lg:border-r border-slate-200/80 dark:border-white/10 flex flex-col h-full bg-surface-shell/40 shrink-0 select-text">
            <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-white/10 space-y-3 shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="font-display font-black text-xl sm:text-2xl text-slate-900 dark:text-white">
                    Messages
                  </h1>
                  <span className="text-2xs font-extrabold uppercase tracking-wider text-link">Direct Communication</span>
                </div>
              </div>
              <div className="neu-inset p-1.5 rounded-xl flex items-center gap-2 h-10">
                <Search className="w-3.5 h-3.5 text-link ml-1.5 shrink-0" />
                <input
                  type="text"
                  aria-label="Search conversations"
                  placeholder="Search conversations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-transparent border-0 px-1 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:outline-none placeholder:text-tertiary"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="text-xs text-tertiary hover:text-danger pr-1.5 cursor-pointer font-bold"
                    title="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 min-h-0 space-y-2">
              <ConversationList
                user={user}
                onSelect={handleSelect}
                searchTerm={searchTerm}
                selectedId={selectedPartner?.id}
              />
            </div>
          </div>

          {/* Desktop Right Chat Pane: Only rendered on desktop to prevent duplicate chat subscriptions */}
          <div className="hidden lg:flex flex-1 flex-col h-full min-w-0 bg-white dark:bg-slate-800/50">
            {isDesktop && (
              selectedPartner && currentUserData ? (
                <ChatWindow
                  key={selectedPartner.id}
                  currentUser={currentUserData}
                  otherUser={selectedPartner}
                  autoStartVideo={autoStartVideo}
                  autoStartCall={autoStartCall}
                />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-tertiary">
                  <div className="neu-flat w-16 h-16 rounded-2xl flex items-center justify-center mb-3 text-link">
                    <MessageCircle className="w-8 h-8" />
                  </div>
                  <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-100">Select a conversation</h3>
                  <p className="text-xs text-tertiary mt-1 max-w-xs">
                    Choose a provider from your list on the left to start or continue chatting.
                  </p>
                </div>
              )
            )}
          </div>
        </div>
      </DashboardLayout>

      {/* Mobile-Only Portal: Only rendered when NOT desktop to prevent duplicate chat subscriptions */}
      {!isDesktop && createPortal(
        <AnimatePresence>
          {view === 'chat' && currentUserData && selectedPartner?.id && (
            <motion.div
              initial={{ opacity: 0, scale: 0.99 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.99 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-0 z-[60] bg-surface-shell flex flex-col w-screen h-[100dvh] max-h-[100dvh] overflow-hidden"
            >
              <ChatWindow
                currentUser={currentUserData}
                otherUser={selectedPartner}
                onBack={handleBack}
                autoStartVideo={autoStartVideo}
                autoStartCall={autoStartCall}
              />
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
};

export default PatientMessages;
