import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Send, UserCircle, Loader2, Check, CheckCheck, Video, X, ArrowLeft, Clock, Mic, MicOff, Camera, CameraOff, Phone, PhoneOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { JitsiMeeting } from '@jitsi/react-sdk';
import { useCalls } from '../contexts/CallContext';

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
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
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
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const otherUserPresent = Object.values(state).flat().some(p => p.presence_ref === otherUser.id || p.user_id === otherUser.id || state[otherUser.id]);
        setIsOnline(!!state[otherUser.id] || otherUserPresent);
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
  }, [autoStartVideo]);

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
      {/* Video Call Overlay */}
      <AnimatePresence>
        {callStatus !== 'idle' && (
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute inset-0 z-[100] bg-slate-900 flex flex-col"
          >
            {/* Connecting Screen */}
            {callStatus === 'connecting' && (
              <div className="flex-1 flex flex-col items-center justify-center px-6">
                {jitsiError ? (
                  <>
                    <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mb-6">
                      <PhoneOff className="w-9 h-9 text-red-400" />
                    </div>
                    <h3 className="text-white text-lg font-bold">Connection Failed</h3>
                    <p className="text-slate-400 text-sm mt-2 text-center max-w-xs">{jitsiError}</p>
                    <p className="text-slate-500 text-xs mt-3 text-center max-w-xs">
                      Make sure the app is served over HTTPS (required for camera/mic access on mobile browsers).
                    </p>
                    <button
                      onClick={() => { endVideoCall(); closeVideoOverlay(); }}
                      className="mt-8 px-8 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold text-sm transition-all active:scale-95 backdrop-blur-sm"
                    >
                      Close
                    </button>
                  </>
                ) : (
                  <>
                    <div className="relative w-24 h-24 mb-6">
                      <motion.div
                        className="absolute inset-0 rounded-full border-2 border-blue-400"
                        animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                      />
                      <div className="absolute inset-1 rounded-full bg-blue-500/20 flex items-center justify-center">
                        <span className="text-2xl font-bold text-blue-400">
                          {otherUser?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'}
                        </span>
                      </div>
                    </div>
                    <h3 className="text-white text-lg font-bold">Connecting...</h3>
                    <p className="text-slate-400 text-sm mt-1">{otherUser?.name || 'User'}</p>
                    <div className="flex items-center gap-2 mt-6">
                      <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                      <span className="text-slate-400 text-sm">Establishing secure connection</span>
                    </div>
                    <button
                      onClick={() => { endVideoCall(); closeVideoOverlay(); }}
                      className="mt-10 w-14 h-14 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-all shadow-lg shadow-red-500/30 active:scale-90"
                      title="Cancel Call"
                    >
                      <PhoneOff className="w-6 h-6" />
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Jitsi always mounts here but is hidden behind connecting/ended overlays */}
            <div className={`absolute inset-0 flex flex-col ${callStatus === 'connected' ? 'z-0' : 'z-[-1] opacity-0 pointer-events-none'}`}>
              <div className="flex items-center justify-between px-4 py-3 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 text-white shrink-0 shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <Video className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">Teleconsultation</h3>
                    <p className="text-[11px] text-slate-400 font-mono font-medium">{formatTime(callTimer)}</p>
                  </div>
                </div>
                <button
                  onClick={endVideoCall}
                  className="w-9 h-9 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-all shadow-lg shadow-red-500/30 active:scale-90"
                  title="End Call"
                >
                  <PhoneOff className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 w-full bg-black relative">
                {!jitsiReady && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                    <div className="text-center">
                      <Loader2 className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-3" />
                      <p className="text-slate-400 text-sm">Connecting to video...</p>
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

              {/* Bottom Controls */}
              <div className="px-6 py-4 bg-slate-900/90 backdrop-blur-md border-t border-slate-800 flex items-center justify-center gap-6 shrink-0">
                <button
                  onClick={toggleMute}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-90 ${isMuted ? 'bg-red-500/20 text-red-400' : 'bg-slate-700/60 text-white hover:bg-slate-600'}`}
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>
                <button
                  onClick={toggleCamera}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-90 ${isCameraOff ? 'bg-red-500/20 text-red-400' : 'bg-slate-700/60 text-white hover:bg-slate-600'}`}
                  title={isCameraOff ? 'Turn Camera On' : 'Turn Camera Off'}
                >
                  {isCameraOff ? <CameraOff className="w-5 h-5" /> : <Camera className="w-5 h-5" />}
                </button>
                <button
                  onClick={endVideoCall}
                  className="w-14 h-14 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-all shadow-lg shadow-red-500/30 active:scale-90"
                  title="End Call"
                >
                  <PhoneOff className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Ended Screen */}
            {callStatus === 'ended' && (
              <div className="flex-1 flex flex-col items-center justify-center px-6">
                <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mb-5 border border-slate-700">
                  <PhoneOff className="w-9 h-9 text-slate-400" />
                </div>
                <h3 className="text-white text-xl font-bold">Call Ended</h3>
                {callTimer > 0 && (
                  <p className="text-slate-400 text-sm mt-1 font-mono">
                    Duration: {formatTime(callTimer)}
                  </p>
                )}
                <p className="text-slate-500 text-xs mt-4 text-center max-w-xs">
                  {otherUser?.name || 'The other party'} has left the call
                </p>
                <button
                  onClick={closeVideoOverlay}
                  className="mt-8 px-8 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold text-sm transition-all active:scale-95 backdrop-blur-sm"
                >
                  Return to Chat
                </button>
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
      <div className="px-4 py-3 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3 shrink-0 z-10">
        {onBack && (
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center transition-colors -ml-1"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </button>
        )}
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 text-primary flex items-center justify-center font-bold overflow-hidden shrink-0 border border-slate-200 dark:border-slate-600">
            {otherUser.photoUrl ? (
              <img src={otherUser.photoUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <UserCircle className="w-6 h-6" />
            )}
          </div>
          <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white transition-colors duration-300 ${isOnline ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-slate-900 dark:text-slate-100 leading-tight truncate">{otherUser.name}</h3>
          <p className={`text-xs font-medium transition-colors duration-300 ${isOnline ? 'text-green-500' : 'text-slate-400 dark:text-slate-500'}`}>
            {isOnline ? 'Active now' : 'Offline'}
          </p>
        </div>
        <motion.button
          onClick={startVideoCall}
          className="w-11 h-11 rounded-full bg-blue-50 dark:bg-blue-900/30 text-primary flex items-center justify-center hover:bg-blue-100 dark:hover:bg-blue-900/20 transition-all shrink-0 border border-blue-100 dark:border-blue-900/30"
          title="Start Teleconsultation"
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          animate={{ scale: [1, 1.04, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Video className="w-5 h-5 fill-current" />
        </motion.button>
      </div>

      {/* Messages Area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-slate-900/50"
      >
        <div className="px-4 md:px-6 py-4">
          {messages.length === 0 ? (
            <div className="text-center text-slate-400 dark:text-slate-500 mt-16">
              <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm dark:shadow-slate-900/50 border border-slate-100 dark:border-slate-700">
                <span className="text-2xl">👋</span>
              </div>
              <p className="text-sm font-medium">Say hello to start the conversation!</p>
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
                        <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-100 dark:border-slate-700 shadow-sm">
                          {formatDateLabel(msg.created_at)}
                        </span>
                      </div>
                    )}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${showAvatar ? 'mt-4' : 'mt-0.5'}`}
                    >
                      {!isMe && (
                        <div className={`w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 overflow-hidden shrink-0 mr-2 self-end ${showAvatar ? '' : 'invisible'}`}>
                          {otherUser.photoUrl ? (
                            <img src={otherUser.photoUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-primary font-bold text-xs">
                              {otherUser.name?.[0] || '?'}
                            </div>
                          )}
                        </div>
                      )}
                      <div className={`max-w-[75%] md:max-w-[60%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        <div className={`px-4 py-2.5 relative ${
                          isMe
                            ? 'bg-gradient-to-tr from-primary to-blue-500 text-white rounded-2xl rounded-br-sm'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-slate-700 rounded-2xl rounded-bl-sm shadow-sm dark:shadow-slate-900/50'
                        }`}>
                          <p className="text-[15px] whitespace-pre-wrap leading-snug">{msg.content}</p>
                        </div>
                        {showTime && (
                          <div className="flex items-center gap-1 mt-1 px-1">
                            <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium">
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
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold tracking-widest uppercase bg-slate-200/50 dark:bg-slate-700/50 px-3 py-1 rounded-full">
                  🔒 Messages disappear after 24 hours
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
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 overflow-hidden mr-2 shadow-sm shrink-0">
                  {otherUser.photoUrl ? (
                    <img src={otherUser.photoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-primary font-bold text-xs">
                      {otherUser.name?.[0] || '?'}
                    </div>
                  )}
                </div>
                <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1">
                  <motion.div className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full" animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0 }} />
                  <motion.div className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full" animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }} />
                  <motion.div className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full" animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }} />
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
            className="fixed bottom-20 right-6 w-10 h-10 bg-white dark:bg-slate-800 rounded-full shadow-lg dark:shadow-slate-900/50 border border-slate-100 dark:border-slate-700 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors z-30"
          >
            <svg className="w-5 h-5 text-slate-500 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </motion.button>
        )}
      </div>

      {/* Input Area */}
      <div className="p-3 md:p-4 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 shrink-0">
        <form onSubmit={handleSend} className="flex gap-2 max-w-4xl mx-auto">
          <div className="flex-1 flex items-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-full px-4 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary focus-within:bg-white dark:focus-within:bg-slate-800 transition-all">
            <input
              type="text"
              value={newMessage}
              onChange={handleTyping}
              placeholder="Type a message..."
              className="flex-1 bg-transparent py-3 focus:outline-none text-sm font-medium text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
              style={{ fontSize: '16px' }}
            />
          </div>
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="w-11 h-11 bg-primary text-white rounded-full flex items-center justify-center hover:bg-primary/90 transition-all disabled:opacity-50 disabled:scale-95 shrink-0 shadow-lg shadow-primary/20"
          >
            <Send className="w-4 h-4 ml-0.5" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatWindow;
