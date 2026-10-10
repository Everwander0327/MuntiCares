import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Send, UserCircle, Loader2, Check, CheckCheck, Video, ArrowLeft, Clock, Mic, MicOff, Camera, CameraOff, PhoneOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { JitsiMeeting } from '@jitsi/react-sdk';
import { useCalls } from '../contexts/CallContext';
import { usePresence } from '../contexts/PresenceContext';

const addReadMsgIds = (userId, ids) => {
  if (!ids.length) return;
  try {
    const key = `read_msgs_${userId}`;
    const stored = JSON.parse(localStorage.getItem(key) || '[]');
    const set = new Set(stored);
    ids.forEach(id => set.add(id));
    const arr = Array.from(set).slice(-500);
    localStorage.setItem(key, JSON.stringify(arr));
    window.dispatchEvent(new Event('messages-read'));
  } catch {}
};

const formatDateLabel = (dateStr) => {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
};

const shouldShowTimestamp = (msg, nextMsg) => {
  if (!nextMsg) return true;
  if (msg.sender_id !== nextMsg.sender_id) return true;
  const diff = new Date(nextMsg.created_at) - new Date(msg.created_at);
  return diff > 5 * 60 * 1000;
};

const ChatWindow = ({ currentUser, otherUser, onBack, autoStartVideo }) => {
  const { startCallBroadcast, sendCallEnded, callDeclinedByPeer } = useCalls();
  const { isUserOnline } = usePresence();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [callStatus, setCallStatus] = useState('idle'); // idle | connecting | connected | ended
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const [callTimer, setCallTimer] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [isCameraOff, setIsCameraOff] = useState(true);
  const [showDeclinedCall, setShowDeclinedCall] = useState(false);
  const [jitsiReady, setJitsiReady] = useState(false);
  const [jitsiError, setJitsiError] = useState(null);

  const messagesEndRef = useRef(null);
  const scrollRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const channelRef = useRef(null);
  const jitsiApiRef = useRef(null);
  const locallyEndingRef = useRef(false);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    if (!currentUser?.id || !otherUser?.id) return;

    const fetchMessages = async () => {
      setLoading(true);

      try {
        await supabase
          .from('messages')
          .delete()
          .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      } catch (err) {
        console.warn('Chat cleanup error:', err);
      }

      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('messages')
        .select('*')
        .gte('created_at', yesterday)
        .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${otherUser.id}),and(sender_id.eq.${otherUser.id},receiver_id.eq.${currentUser.id})`)
        .order('created_at', { ascending: true });

      if (data) {
        setMessages(data);
        const unreadIds = data.filter(m => m.receiver_id === currentUser.id && !m.is_read).map(m => m.id);
        if (unreadIds.length > 0) {
          addReadMsgIds(currentUser.id, unreadIds);
        }
      }
      setLoading(false);
      setTimeout(scrollToBottom, 100);
    };

    fetchMessages();

    const roomName = `chat_${[currentUser.id, otherUser.id].sort().join('_')}`;
    const channel = supabase.channel(roomName, {
      config: { presence: { key: currentUser.id }, broadcast: { self: true } }
    });
    channelRef.current = channel;

    channel
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        const msg = payload.new;
        if (
          (msg.sender_id === currentUser.id && msg.receiver_id === otherUser.id) ||
          (msg.sender_id === otherUser.id && msg.receiver_id === currentUser.id)
        ) {
          if (msg.receiver_id === currentUser.id) {
            msg.is_read = true;
            addReadMsgIds(currentUser.id, [msg.id]);
          }
          setMessages(prev => {
            if (prev.find(m => m.id === msg.id)) return prev;
            const tempMatch = prev.find(m =>
              typeof m.id === 'string' &&
              m.id.startsWith('temp-') &&
              m.content === msg.content &&
              m.sender_id === msg.sender_id
            );
            if (tempMatch) {
              return prev.map(m => m.id === tempMatch.id ? { ...msg, status: 'sent' } : m);
            }
            return [...prev, msg];
          });
          setTimeout(scrollToBottom, 100);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
        setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...payload.new, status: payload.new.is_read ? 'read' : 'sent' } : m));
      })
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (payload.payload.sender_id === otherUser.id && payload.payload.receiver_id === currentUser.id) {
          setIsTyping(payload.payload.isTyping);
        }
      })
      .on('broadcast', { event: 'new_message' }, (payload) => {
        const msg = payload.payload;
        if (msg.sender_id === otherUser.id && msg.receiver_id === currentUser.id) {
          setMessages(prev => {
            if (prev.find(m => m.id === msg.id || m.content === msg.content && Math.abs(new Date(m.created_at) - new Date(msg.created_at)) < 5000)) return prev;
            return [...prev, msg];
          });
          setTimeout(scrollToBottom, 50);
        }
      })
      .on('broadcast', { event: 'call_accepted' }, () => {
        // Peer accepted the call — if we're still connecting, transition
      })
      .on('broadcast', { event: 'call_ended' }, () => {
        setCallStatus('ended');
        setIsMuted(true);
        setIsCameraOff(true);
        setJitsiReady(false);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: currentUser.id, online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser, otherUser]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setIsScrolledUp(scrollHeight - scrollTop - clientHeight > 100);
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { sender_id: currentUser.id, receiver_id: otherUser.id, isTyping: true }
      });
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        channelRef.current.send({
          type: 'broadcast',
          event: 'typing',
          payload: { sender_id: currentUser.id, receiver_id: otherUser.id, isTyping: false }
        });
      }, 2000);
    }
  };

  const sendMessage = async (text) => {
    if (!text.trim()) return;

    const tempMsg = {
      id: `temp-${Date.now()}`,
      sender_id: currentUser.id,
      receiver_id: otherUser.id,
      content: text,
      created_at: new Date().toISOString(),
      is_read: false,
      status: 'sending',
    };

    if (channelRef.current) {
      channelRef.current.send({ type: 'broadcast', event: 'typing', payload: { sender_id: currentUser.id, receiver_id: otherUser.id, isTyping: false } });
      channelRef.current.send({ type: 'broadcast', event: 'new_message', payload: { ...tempMsg, status: undefined } });
    }

    setMessages(prev => [...prev, { ...tempMsg, status: 'sending' }]);
    setTimeout(scrollToBottom, 100);

    const { data } = await supabase.from('messages').insert([{
      sender_id: currentUser.id,
      receiver_id: otherUser.id,
      content: text,
      is_read: false,
    }]).select();

    if (data?.[0]) {
      setMessages(prev => prev.map(m => m.id === tempMsg.id ? { ...data[0], status: 'sent' } : m));
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    const msgText = newMessage.trim();
    setNewMessage('');
    clearTimeout(typingTimeoutRef.current);
    await sendMessage(msgText);
  };

  useEffect(() => {
    if (callStatus !== 'connected') return;
    setCallTimer(0);
    const interval = setInterval(() => setCallTimer(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [callStatus]);

  useEffect(() => {
    if (autoStartVideo && otherUser?.id && currentUser) {
      setCallStatus('connecting');
    }
  }, [autoStartVideo, currentUser, otherUser?.id]);

  useEffect(() => {
    if (callStatus !== 'connecting') {
      setJitsiError(null);
      return;
    }
    const timer = setTimeout(() => {
      if (!jitsiReady) {
        setJitsiError('Timed out waiting for video connection. The meeting server may be unreachable on this network.');
      }
    }, 20000);
    return () => clearTimeout(timer);
  }, [callStatus, jitsiReady]);

  useEffect(() => {
    if (callDeclinedByPeer) {
      setShowDeclinedCall(true);
      setCallStatus('idle');
      setIsMuted(true);
      setIsCameraOff(true);
      setJitsiReady(false);
      setTimeout(() => setShowDeclinedCall(false), 3000);
    }
  }, [callDeclinedByPeer]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const startVideoCall = () => {
    setCallTimer(0);
    setCallStatus('connecting');
    sendMessage("📞 I've started a video consultation. Please click the Video icon at the top right to join the call!");
    if (otherUser?.id && currentUser) {
      startCallBroadcast(otherUser.id, currentUser.name);
    }
  };

  const endVideoCall = () => {
    if (locallyEndingRef.current) return;
    locallyEndingRef.current = true;
    channelRef.current?.send({
      type: 'broadcast',
      event: 'call_ended',
      payload: { sender_id: currentUser.id }
    });
    if (otherUser?.id) {
      sendCallEnded(otherUser.id);
    }
    jitsiApiRef.current?.executeCommand('hangup');
    setCallStatus('ended');
    setIsMuted(true);
    setIsCameraOff(true);
    setJitsiReady(false);
  };

  const closeVideoOverlay = () => {
    locallyEndingRef.current = false;
    setCallStatus('idle');
    setJitsiReady(false);
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    jitsiApiRef.current?.executeCommand('toggleAudio');
  };

  const toggleCamera = () => {
    const next = !isCameraOff;
    setIsCameraOff(next);
    jitsiApiRef.current?.executeCommand('toggleVideo');
  };

  const handleJitsiReady = (api) => {
    jitsiApiRef.current = api;
    setJitsiReady(true);
    setCallStatus('connected');

    api.addListener('participantLeft', () => {
      if (locallyEndingRef.current) return;
      if (api.getNumberOfParticipants() <= 1) {
        channelRef.current?.send({
          type: 'broadcast',
          event: 'call_ended',
          payload: { sender_id: currentUser.id }
        });
        setCallStatus('ended');
        setIsMuted(true);
        setIsCameraOff(true);
        setJitsiReady(false);
      }
    });
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const roomName = `MuntiCaresRoom_${[currentUser.id, otherUser.id].sort().join('')}`.replace(/-/g, '');

  const statusIcon = (msg) => {
    if (typeof msg.id === 'string' && msg.id.startsWith('temp-')) {
      return <Clock className="w-3 h-3 text-slate-400" />;
    }
    if (msg.is_read) return <CheckCheck className="w-3 h-3 text-blue-500" />;
    return <Check className="w-3 h-3 text-slate-400" />;
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-800 relative overflow-hidden">
      {/* Video Call Overlay - Neumorphic Teleconsultation Suite */}
      <AnimatePresence>
        {callStatus !== 'idle' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="absolute inset-0 z-[100] bg-[#ebf1f8] dark:bg-[#172236] flex flex-col select-text"
          >
            {/* Connecting Screen */}
            {callStatus === 'connecting' && (
              <div className="flex-1 flex flex-col items-center justify-center px-6">
                {jitsiError ? (
                  <div className="neu-flat p-8 rounded-[2.5rem] max-w-sm w-full text-center border border-white/80 dark:border-white/10 shadow-2xl">
                    <div className="w-16 h-16 rounded-2xl neu-flat flex items-center justify-center mb-4 mx-auto text-rose-500">
                      <PhoneOff className="w-7 h-7" />
                    </div>
                    <h3 className="text-slate-900 dark:text-white text-lg font-display font-black">Connection Failed</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-xs mt-2 max-w-xs mx-auto">{jitsiError}</p>
                    <p className="text-slate-400 dark:text-slate-500 text-3xs mt-2 text-center max-w-xs mx-auto">
                      Make sure the app is served over HTTPS (required for camera/mic access).
                    </p>
                    <button
                      type="button"
                      onClick={() => { endVideoCall(); closeVideoOverlay(); }}
                      className="mt-6 px-6 py-2.5 neu-btn text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs transition-all active:scale-95 cursor-pointer"
                    >
                      Close Window
                    </button>
                  </div>
                ) : (
                  <div className="neu-flat p-8 sm:p-10 rounded-[2.5rem] max-w-sm w-full text-center border border-white/80 dark:border-white/10 shadow-2xl">
                    {/* Radar Pulse Avatar */}
                    <div className="relative w-28 h-28 mx-auto mb-5">
                      <motion.div
                        className="absolute inset-0 rounded-full border-2 border-primary/40"
                        animate={{ scale: [1, 1.25, 1], opacity: [0.6, 0, 0.6] }}
                        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                      />
                      <motion.div
                        className="absolute inset-0 rounded-full border-2 border-emerald-400/40"
                        animate={{ scale: [1, 1.25, 1], opacity: [0.6, 0, 0.6] }}
                        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
                      />
                      <div className="absolute inset-1.5 rounded-full neu-flat flex items-center justify-center p-1 overflow-hidden shadow-inner">
                        <span className="text-2xl font-black text-primary">
                          {otherUser?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'}
                        </span>
                      </div>
                    </div>

                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full neu-flat-sm text-3xs font-extrabold text-primary uppercase tracking-widest mb-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                      Connecting Teleconsultation
                    </div>

                    <h3 className="text-slate-900 dark:text-white text-lg font-display font-black truncate">
                      {otherUser?.name || 'Healthcare Provider'}
                    </h3>
                    
                    <div className="flex items-center justify-center gap-2 mt-3 text-xs text-slate-500 dark:text-slate-400">
                      <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                      <span>Securing encrypted video stream...</span>
                    </div>

                    <div className="mt-8 flex justify-center">
                      <button
                        type="button"
                        onClick={() => { endVideoCall(); closeVideoOverlay(); }}
                        className="neu-btn w-14 h-14 rounded-2xl flex items-center justify-center text-rose-500 hover:text-rose-600 transition-all active:scale-90 shadow-md cursor-pointer"
                        title="Cancel Call"
                      >
                        <PhoneOff className="w-6 h-6 stroke-[2.5]" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Jitsi Teleconsultation Screen */}
            <div className={`absolute inset-0 flex flex-col ${callStatus === 'connected' ? 'z-0' : 'z-[-1] opacity-0 pointer-events-none'}`}>
              {/* Neumorphic Header Bar */}
              <div className="flex items-center justify-between px-5 py-3.5 bg-[#ebf1f8] dark:bg-[#172236] neu-flat border-b border-white/60 dark:border-white/10 shrink-0 z-10 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl neu-flat-sm flex items-center justify-center text-primary">
                    <Video className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-display font-black text-xs sm:text-sm text-slate-900 dark:text-white leading-tight">
                      Teleconsultation Session
                    </h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <p className="text-3xs text-emerald-600 dark:text-emerald-400 font-mono font-bold tracking-wider">
                        {formatTime(callTimer)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="hidden sm:inline-block text-2xs text-slate-400 font-semibold truncate max-w-[150px]">
                    {otherUser?.name}
                  </span>
                  <button
                    type="button"
                    onClick={endVideoCall}
                    className="neu-btn px-3 py-1.5 rounded-xl text-rose-500 hover:text-rose-600 text-xs font-black flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-sm"
                    title="End Call"
                  >
                    <PhoneOff className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Leave</span>
                  </button>
                </div>
              </div>

              {/* Jitsi Video Embed Container */}
              <div className="flex-1 w-full bg-slate-950 relative overflow-hidden">
                {!jitsiReady && (
                  <div className="absolute inset-0 flex items-center justify-center bg-[#ebf1f8] dark:bg-[#172236] z-10">
                    <div className="neu-flat p-6 rounded-2xl text-center border border-white/80 dark:border-white/10 shadow-lg">
                      <Loader2 className="w-7 h-7 text-primary animate-spin mx-auto mb-2.5" />
                      <p className="text-slate-700 dark:text-slate-200 text-xs font-bold">Initializing video feed...</p>
                    </div>
                  </div>
                )}
                <JitsiMeeting
                  domain="meet.jit.si"
                  roomName={roomName}
                  configOverwrite={{
                    startWithAudioMuted: true,
                    startWithVideoMuted: true,
                    disableInitialGUM: true,
                    disableModeratorIndicator: true,
                    enableEmailInStats: false,
                    prejoinPageEnabled: false,
                    hideConferenceSubject: true,
                    hideParticipantsStats: true,
                    disableFilmstripAutohiding: false,
                    disableDeepLinking: true,
                  }}
                  interfaceConfigOverwrite={{
                    DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
                    SHOW_JITSI_WATERMARK: false,
                    SHOW_WATERMARK_FOR_GUESTS: false,
                    SHOW_BRAND_WATERMARK: false,
                    TOOLBAR_BUTTONS: [],
                    FILM_STRIP_MAX_HEIGHT: 0,
                    SHOW_CHROME_EXTENSION_BANNER: false,
                    SHOW_POWERED_BY: false,
                    SHOW_PROMOTIONAL_CLOSE_PAGE: false,
                    MOBILE_APP_PROMO: false,
                  }}
                  userInfo={{ displayName: currentUser.name }}
                  getIFrameRef={(iframeRef) => {
                    iframeRef.style.height = '100%';
                    iframeRef.style.width = '100%';
                    iframeRef.style.border = 'none';
                    iframeRef.setAttribute('allow', 'camera *; microphone *; display-capture *');
                  }}
                  onApiReady={handleJitsiReady}
                />
              </div>

              {/* Bottom Tactile Neumorphic Controls Bar */}
              <div className="px-6 py-4 bg-[#ebf1f8] dark:bg-[#172236] neu-flat border-t border-white/60 dark:border-white/10 flex items-center justify-center gap-5 shrink-0 z-10 shadow-lg">
                <button
                  type="button"
                  onClick={toggleMute}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-md ${
                    isMuted 
                      ? 'neu-pressed text-rose-500 border border-rose-500/30' 
                      : 'neu-btn text-slate-700 dark:text-slate-200'
                  }`}
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? <MicOff className="w-5 h-5 stroke-[2.5]" /> : <Mic className="w-5 h-5" />}
                </button>

                <button
                  type="button"
                  onClick={toggleCamera}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-md ${
                    isCameraOff 
                      ? 'neu-pressed text-rose-500 border border-rose-500/30' 
                      : 'neu-btn text-slate-700 dark:text-slate-200'
                  }`}
                  title={isCameraOff ? 'Turn Camera On' : 'Turn Camera Off'}
                >
                  {isCameraOff ? <CameraOff className="w-5 h-5 stroke-[2.5]" /> : <Camera className="w-5 h-5" />}
                </button>

                <button
                  type="button"
                  onClick={endVideoCall}
                  className="w-14 h-14 rounded-2xl neu-btn text-rose-600 hover:text-rose-700 flex items-center justify-center transition-all active:scale-90 shadow-lg cursor-pointer"
                  title="End Call"
                >
                  <PhoneOff className="w-6 h-6 stroke-[2.5]" />
                </button>
              </div>
            </div>

            {/* Ended Screen */}
            {callStatus === 'ended' && (
              <div className="flex-1 flex flex-col items-center justify-center px-6">
                <div className="neu-flat p-8 sm:p-10 rounded-[2.5rem] max-w-sm w-full text-center border border-white/80 dark:border-white/10 shadow-2xl">
                  <div className="w-16 h-16 rounded-2xl neu-flat flex items-center justify-center mb-4 mx-auto text-slate-400">
                    <PhoneOff className="w-7 h-7" />
                  </div>
                  <h3 className="text-slate-900 dark:text-white text-xl font-display font-black">Session Concluded</h3>
                  {callTimer > 0 && (
                    <div className="mt-2 inline-block px-3 py-1 rounded-full neu-flat-sm text-xs font-mono font-bold text-primary">
                      Duration: {formatTime(callTimer)}
                    </div>
                  )}
                  <p className="text-slate-500 dark:text-slate-400 text-xs mt-3 text-center max-w-xs mx-auto">
                    {otherUser?.name || 'The provider'} has left the teleconsultation room.
                  </p>
                  <button
                    type="button"
                    onClick={closeVideoOverlay}
                    className="mt-6 px-6 py-2.5 neu-btn text-primary rounded-xl font-extrabold text-xs transition-all active:scale-95 cursor-pointer shadow-sm"
                  >
                    Return to Conversation
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {showDeclinedCall && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="absolute inset-0 z-[300] bg-black/50 backdrop-blur-sm flex items-center justify-center"
        >
          <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 max-w-xs w-full mx-4 shadow-2xl border border-slate-100 dark:border-slate-700 text-center">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <PhoneOff className="w-9 h-9 text-red-500" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Call Declined</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
              {otherUser?.name || 'The other party'} declined the call
            </p>
          </div>
        </motion.div>
      )}

      {/* Chat Header */}
      <div className="px-4 py-3 sm:py-3.5 neu-flat border-b border-white/60 dark:border-white/5 flex items-center gap-3 shrink-0 z-10">
        {onBack && (
          <button
            onClick={onBack}
            className="neu-btn w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer -ml-1 text-slate-600 dark:text-slate-300 hover:text-primary"
            title="Back to conversations"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <div className="relative shrink-0">
          <div className="neu-flat-sm w-10 h-10 sm:w-11 sm:h-11 rounded-2xl overflow-hidden p-0.5 flex items-center justify-center">
            {otherUser.photoUrl ? (
              <img src={otherUser.photoUrl} alt="" className="w-full h-full object-cover rounded-xl" />
            ) : (
              <UserCircle className="w-6 h-6 text-primary" />
            )}
          </div>
          <div 
            className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-[#172236] transition-colors duration-300 ${
              isUserOnline(otherUser.id) ? 'bg-emerald-500' : 'bg-slate-400'
            }`} 
            title={isUserOnline(otherUser.id) ? 'Online' : 'Offline'}
          />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-extrabold text-sm sm:text-base text-slate-800 dark:text-slate-100 leading-tight truncate">
            {otherUser.name}
          </h3>
          <p className={`text-3xs sm:text-xs font-bold transition-colors duration-300 ${
            isUserOnline(otherUser.id) ? 'text-emerald-500' : 'text-slate-400 dark:text-slate-500'
          }`}>
            {isUserOnline(otherUser.id) ? 'Active now' : 'Offline'}
          </p>
        </div>
        <motion.button
          onClick={startVideoCall}
          className="neu-btn w-10 h-10 sm:w-11 sm:h-11 rounded-2xl text-primary flex items-center justify-center hover:text-primary-700 transition-all shrink-0 cursor-pointer"
          title="Start Teleconsultation"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Video className="w-5 h-5 fill-current" />
        </motion.button>
      </div>

      {/* Messages Area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto bg-slate-50/40 dark:bg-slate-900/40"
      >
        <div className="px-4 md:px-6 py-4">
          {messages.length === 0 ? (
            <div className="text-center text-slate-400 dark:text-slate-500 mt-16">
              <div className="neu-flat w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3 text-2xl">
                <span>👋</span>
              </div>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Say hello to start the conversation!</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Feel free to discuss details regarding your appointment.</p>
            </div>
          ) : (
            <>
              {messages.map((msg, idx) => {
                const isMe = msg.sender_id === currentUser.id;
                const prevMsg = messages[idx - 1];
                const nextMsg = messages[idx + 1];
                const showAvatar = !prevMsg || prevMsg.sender_id !== msg.sender_id;
                const showDate = !prevMsg || new Date(msg.created_at).toDateString() !== new Date(prevMsg.created_at).toDateString();
                const showTime = shouldShowTimestamp(msg, nextMsg);

                return (
                  <React.Fragment key={msg.id}>
                    {showDate && (
                      <div className="flex justify-center my-4">
                        <span className="neu-flat-sm text-3xs font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-400 px-3.5 py-1 rounded-full">
                          {formatDateLabel(msg.created_at)}
                        </span>
                      </div>
                    )}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${showAvatar ? 'mt-4' : 'mt-1'}`}
                    >
                      {!isMe && (
                        <div className={`neu-flat-sm w-8 h-8 rounded-xl overflow-hidden shrink-0 mr-2.5 self-end p-0.5 ${showAvatar ? '' : 'invisible'}`}>
                          {otherUser.photoUrl ? (
                            <img src={otherUser.photoUrl} alt="" className="w-full h-full object-cover rounded-lg" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-primary font-black text-xs">
                              {otherUser.name?.[0] || '?'}
                            </div>
                          )}
                        </div>
                      )}
                      <div className={`max-w-[80%] md:max-w-[65%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        <div className={`px-4 py-2.5 relative ${
                          isMe
                            ? 'neu-btn-primary rounded-2xl rounded-br-sm shadow-md'
                            : 'neu-flat rounded-2xl rounded-bl-sm text-slate-800 dark:text-slate-100 font-medium'
                        }`}>
                          <p className="text-sm whitespace-pre-wrap leading-relaxed select-text">{msg.content}</p>
                        </div>
                        {showTime && (
                          <div className="flex items-center gap-1.5 mt-1 px-1">
                            <span className="text-3xs text-slate-400 dark:text-slate-500 font-semibold tabular-nums">
                              {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {isMe && (
                              <span className="text-slate-400 dark:text-slate-500">{statusIcon(msg)}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  </React.Fragment>
                );
              })}

              {/* 24-Hour Notice */}
              <div className="flex justify-center my-6">
                <span className="neu-flat-sm text-3xs text-slate-400 dark:text-slate-500 font-extrabold tracking-widest uppercase px-3.5 py-1.5 rounded-full flex items-center gap-1.5">
                  <span>🔒</span> Messages disappear after 24 hours
                </span>
              </div>
            </>
          )}

          {/* Typing Indicator */}
          <AnimatePresence>
            {isTyping && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 10 }}
                className="flex justify-start mt-2"
              >
                <div className="neu-flat-sm w-8 h-8 rounded-xl overflow-hidden mr-2.5 shrink-0 p-0.5">
                  {otherUser.photoUrl ? (
                    <img src={otherUser.photoUrl} alt="" className="w-full h-full object-cover rounded-lg" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-primary font-black text-xs">
                      {otherUser.name?.[0] || '?'}
                    </div>
                  )}
                </div>
                <div className="neu-flat rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5">
                  <motion.div className="w-1.5 h-1.5 bg-primary rounded-full" animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0 }} />
                  <motion.div className="w-1.5 h-1.5 bg-primary rounded-full" animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }} />
                  <motion.div className="w-1.5 h-1.5 bg-primary rounded-full" animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={messagesEndRef} />
        </div>

        {/* Scroll-to-bottom button */}
        {isScrolledUp && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={scrollToBottom}
            className="fixed bottom-20 right-6 neu-btn w-10 h-10 rounded-full flex items-center justify-center z-30 cursor-pointer"
          >
            <svg className="w-5 h-5 text-slate-500 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </motion.button>
        )}
      </div>

      {/* Input Area */}
      <div className="p-3 sm:p-4 neu-flat border-t border-white/60 dark:border-white/5 shrink-0">
        <form onSubmit={handleSend} className="flex gap-2.5 max-w-4xl mx-auto items-center">
          <div className="neu-inset flex-1 flex items-center rounded-2xl px-3.5 sm:px-4 h-[46px] sm:h-[50px] transition-all">
            <input
              type="text"
              value={newMessage}
              onChange={handleTyping}
              placeholder="Type a message..."
              className="w-full bg-transparent border-0 px-1 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 outline-none focus:outline-none focus:ring-0 placeholder:text-slate-400 placeholder:font-normal min-w-0"
            />
          </div>
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="neu-btn-primary w-[46px] h-[46px] sm:w-[50px] sm:h-[50px] rounded-2xl flex items-center justify-center transition-all disabled:opacity-40 disabled:pointer-events-none shrink-0 cursor-pointer shadow-md"
            title="Send Message"
          >
            <Send className="w-4 h-4 ml-0.5" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatWindow;
