import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Send, UserCircle, Loader2, Check, CheckCheck, Video, Phone, ArrowLeft, Clock, Mic, MicOff, Camera, CameraOff, PhoneOff, AlertCircle, SwitchCamera, RotateCw, Paperclip, X, Maximize2, Info, MessageSquare, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCalls } from '@/contexts/CallContext';
import { usePresence } from '@/contexts/PresenceContext';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import useBottomDrawerDrag from '@/hooks/useBottomDrawerDrag';
import useWebRTCCall from '../hooks/useWebRTCCall';
import {
  newCallId,
  createCallRecord,
  markCallAnswered,
  markCallEnded,
  markCallMissed,
  markCallFailed,
  fetchCallRecord,
  fetchConversationCalls,
  markMissedCallsSeen,
  sendCallInvite,
} from '../lib/callRecords';
import { logCallEvent } from '../lib/callEvents';

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

// A call bubble is only joinable while its record is still ringing. Unknown records
// (rows predating message_type, or a record past the fetch window) fall back to the
// ringing sweep's 60-second window rather than offering a call that already ended.
const isLegacyCallMarker = (text) => /^(\u{1F4F9}|\u{1F4DE})/u.test(text || '');
const stripLeadingCallMarker = (text) => String(text || '').replace(/^(\u{1F4F9}|\u{1F4DE})\s*/u, '');

const isCallMessage = (msg) =>
  msg.message_type === 'call' || isLegacyCallMarker(msg.content);

const callTypeOf = (msg, record) => {
  const type = record?.call_type || (/^\u{1F4DE}/u.test(msg.content || '') ? 'audio' : 'video');
  return type === 'audio' ? 'audio' : 'video';
};

const isJoinable = (msg, record) =>
  record ? record.status === 'ringing' : Date.now() - new Date(msg.created_at).getTime() < 90000;

// The caller stops waiting before the database sweeps a ringing row to missed
// (cron job "calls stale ringing sweep"), so no one joins a call that is already closed.
const RING_TIMEOUT_MS = 45000;

const formatDuration = (seconds) => {
  const total = Number(seconds) || 0;
  if (total < 60) return `${total}s`;
  const mins = Math.floor(total / 60);
  if (mins < 60) return total % 60 ? `${mins}m ${total % 60}s` : `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
};

const CALL_OUTCOME = {
  answered: 'in progress',
  ended: 'ended',
  declined: 'declined',
  missed: 'missed',
  failed: 'could not connect',
};

const CallBubbleAction = ({ msg, record, isMe, onJoin }) => {
  const isVideo = callTypeOf(msg, record) === 'video';
  const kind = isVideo ? 'Video' : 'Voice';

  if (isJoinable(msg, record)) {
    const Icon = isVideo ? Video : Phone;
    return (
      <button
        type="button"
        onClick={onJoin}
        className={`mt-2.5 w-full px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
          isMe ? 'bg-white/20 hover:bg-white/30 text-white' : 'neu-btn text-link'
        }`}
      >
        <Icon className="w-3.5 h-3.5" />
        <span>Join {kind} Call</span>
      </button>
    );
  }

  const outcome = record ? CALL_OUTCOME[record.status] || 'ended' : 'no longer available';
  const length = record?.duration_seconds != null && record.status === 'ended'
    ? ` · ${formatDuration(record.duration_seconds)}`
    : '';
  return (
    <p className={`mt-2 flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wider ${
      isMe ? 'text-white/80' : 'text-tertiary dark:text-tertiary'
    }`}>
      <PhoneOff className="w-3 h-3 shrink-0" />
      <span>{kind} consultation {outcome}{length}</span>
    </p>
  );
};

const renderHighlightedText = (text, term) => {
  if (!term || !term.trim() || !text) return text;
  const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = String(text).split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-amber-300/80 dark:bg-amber-400/70 text-slate-900 font-extrabold rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  );
};

const ChatWindow = ({ currentUser, otherUser, onBack, autoStartVideo, autoStartCall }) => {
  const { user: authUser } = useAuth();
  const { startCallBroadcast, sendCallEnded, callDeclinedByPeer, callCancelledByPeer, markActiveCall, incomingCall } = useCalls();
  const { isUserOnline } = usePresence();
  const [messages, setMessages] = useState([]);
  // chat_attachments is a private bucket, so media paths are exchanged for
  // short-lived signed URLs before they reach an <img>/<video> src.
  const [mediaUrls, setMediaUrls] = useState({});
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const [callTimer, setCallTimer] = useState(0);
  const [showDeclinedCall, setShowDeclinedCall] = useState(false);
  const [remoteRotation, setRemoteRotation] = useState(0);
  const [callRecordsById, setCallRecordsById] = useState({});

  const {
    callStatus,
    callType,
    hasRemoteVideo,
    pcState,
    role: rtcRole,
    isMuted,
    isCameraOff,
    facingMode,
    cameraRotation,
    error: webRtcError,
    localVideoRef,
    remoteVideoRef,
    remoteAudioRef,
    startCall: rtcStartCall,
    joinCall: rtcJoinCall,
    endCall: rtcEndCall,
    resetCall: rtcResetCall,
    toggleMute,
    toggleCamera,
    switchCamera,
    rotateCamera,
    attachMedia,
  } = useWebRTCCall({
    selfId: currentUser?.id,
    peerId: otherUser?.id,
  });

  const messagesEndRef = useRef(null);
  const scrollRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const channelRef = useRef(null);
  const lastChimeRef = useRef(0);
  const activeCallIdRef = useRef(null);
  const callConnectedRef = useRef(false);
  const fileInputRef = useRef(null);
  const [selectedAttachment, setSelectedAttachment] = useState(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [lightboxMedia, setLightboxMedia] = useState(null);
  const [showProfilePanel, setShowProfilePanel] = useState(false);
  const {
    drawerMotionProps: infoDrawerMotionProps,
    dragHandleProps: infoDragHandleProps,
  } = useBottomDrawerDrag({
    onClose: () => setShowProfilePanel(false),
    mobileQuery: '(max-width: 1023px)',
  });
  const [isMobileScreen, setIsMobileScreen] = useState(() => {
    return typeof window !== 'undefined' ? window.innerWidth < 1024 : false;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobileScreen(window.innerWidth < 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [partnerProfile, setPartnerProfile] = useState(null);
  const [activeRequest, setActiveRequest] = useState(null);
  const [searchMessageTerm, setSearchMessageTerm] = useState('');
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);

  const searchResults = useMemo(() => {
    if (!searchMessageTerm.trim()) return [];
    const term = searchMessageTerm.toLowerCase().trim();
    return messages.filter(m => (m.content || '').toLowerCase().includes(term));
  }, [messages, searchMessageTerm]);

  const handleJumpToMessage = (messageId) => {
    if (isMobileScreen) {
      setShowProfilePanel(false);
    }
    setHighlightedMessageId(messageId);

    setTimeout(() => {
      const el = document.getElementById(`msg-${messageId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, isMobileScreen ? 260 : 60);

    setTimeout(() => {
      setHighlightedMessageId((curr) => (curr === messageId ? null : curr));
    }, 3200);
  };
  const [consentId, setConsentId] = useState(null);
  const [consentEnabled, setConsentEnabled] = useState(true);
  const isPatientView = (currentUser?.role || authUser?.role) === 'patient';

  const handleToggleConsent = async () => {
    const nextVal = !consentEnabled;
    setConsentEnabled(nextVal);
    try {
      const isPatient = (currentUser?.role || authUser?.role) === 'patient';
      const patId = isPatient ? currentUser.id : otherUser.id;
      const provId = isPatient ? otherUser.id : currentUser.id;

      let error = null;
      if (consentId) {
        ({ error } = await supabase
          .from('consent_access')
          .update({ is_enabled: nextVal })
          .eq('id', consentId));
      } else {
        const { data, error: insertError } = await supabase
          .from('consent_access')
          .insert([{ patient_id: patId, provider_id: provId, is_enabled: nextVal }])
          .select()
          .maybeSingle();
        error = insertError;
        if (data) setConsentId(data.id);
      }

      if (error) throw error;
      toast.success(nextVal ? 'Consent access granted' : 'Consent access revoked');
    } catch (err) {
      console.error('Failed to toggle consent:', err);
      setConsentEnabled(!nextVal);
      toast.error('Failed to update consent access');
    }
  };

  useEffect(() => {
    if (!currentUser?.id || !otherUser?.id) return;
    supabase
      .from('users')
      .select('id, full_name, role, email, phone, avatar_url')
      .eq('id', otherUser.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setPartnerProfile(data);
      });

    const isPatient = (currentUser?.role || authUser?.role) === 'patient';
    const patId = isPatient ? currentUser.id : otherUser.id;
    const provId = isPatient ? otherUser.id : currentUser.id;
    const myCol = isPatient ? 'patient_id' : 'provider_id';
    const otherCol = isPatient ? 'provider_id' : 'patient_id';

    supabase
      .from('requests')
      .select('id, status, service, date, time')
      .eq(myCol, currentUser.id)
      .eq(otherCol, otherUser.id)
      .in('status', ['Accepted', 'On The Way', 'Arrived', 'Completed'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setActiveRequest(data);
      });

    supabase
      .from('consent_access')
      .select('id, is_enabled')
      .eq('patient_id', patId)
      .eq('provider_id', provId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setConsentId(data.id);
          setConsentEnabled(Boolean(data.is_enabled));
        }
      });
  }, [currentUser?.id, otherUser?.id, authUser?.role]);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      toast.error('File size exceeds 50MB limit.');
      return;
    }

    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');

    if (!isImage && !isVideo) {
      toast.error('Please select an image or video file.');
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setSelectedAttachment({
      file,
      previewUrl,
      type: isVideo ? 'video' : 'image',
      name: file.name,
      size: (file.size / (1024 * 1024)).toFixed(2),
    });
    e.target.value = '';
  };

  const handleRemoveAttachment = () => {
    if (selectedAttachment?.previewUrl) {
      URL.revokeObjectURL(selectedAttachment.previewUrl);
    }
    setSelectedAttachment(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const playNotificationSound = () => {
    const now = Date.now();
    if (now - lastChimeRef.current < 600) return;
    lastChimeRef.current = now;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const t = ctx.currentTime;
      osc.frequency.setValueAtTime(587.33, t); // D5
      osc.frequency.exponentialRampToValueAtTime(880, t + 0.1); // A5
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    } catch {
      // Ignore user gesture / audio limitations gracefully
    }
  };

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (!isScrolledUp) scrollToBottom();
  }, [messages.length, isTyping]);

  const refreshCallRecords = useCallback(async () => {
    if (!currentUser?.id || !otherUser?.id) return;
    const rows = await fetchConversationCalls({ userId: currentUser.id, peerId: otherUser.id });
    setCallRecordsById(Object.fromEntries(rows.map((row) => [row.id, row])));
    await markMissedCallsSeen({ userId: currentUser.id, peerId: otherUser.id });
  }, [currentUser?.id, otherUser?.id]);

  useEffect(() => {
    if (!currentUser?.id || !otherUser?.id) return;

    const fetchMessages = async () => {
      setLoading(true);

      // Expiry of rows older than the promised 24 hours is enforced by the
      // `messages 24h expiry` cron job, not by the app opening a chat.
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('messages')
        .select('*')
        .gte('created_at', yesterday)
        .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${otherUser.id}),and(sender_id.eq.${otherUser.id},receiver_id.eq.${currentUser.id})`)
        .order('created_at', { ascending: true })
        .limit(500);

      if (data) {
        setMessages(data);
        const receivedIds = data.filter(m => m.receiver_id === currentUser.id).map(m => m.id);
        if (receivedIds.length > 0) {
          addReadMsgIds(currentUser.id, receivedIds);
        }
        const unreadIds = data.filter(m => m.receiver_id === currentUser.id && !m.is_read).map(m => m.id);
        if (unreadIds.length > 0) {
          supabase.from('messages').update({ is_read: true }).in('id', unreadIds)
            .then(() => {}, (err) => console.warn('[chat] read receipts failed:', err?.message));
        }
      }
      setLoading(false);
      setTimeout(scrollToBottom, 100);
    };

    fetchMessages();
    refreshCallRecords();

    const roomName = `chat_${[currentUser.id, otherUser.id].sort().join('_')}`;
    const existing = supabase.getChannels().find(ch => ch.topic === `realtime:${roomName}` || ch.topic === roomName);
    if (existing) {
      supabase.removeChannel(existing);
    }
    const channel = supabase.channel(roomName, {
      config: { presence: { key: currentUser.id }, broadcast: { self: true } }
    });
    channelRef.current = channel;

    // messages has no RLS yet, so every INSERT/UPDATE on the table reaches every
    // subscribed client. Filter the subscription to my own rows and re-check here.
    const involvesMe = (msg) => msg?.sender_id === currentUser.id || msg?.receiver_id === currentUser.id;

    const onMessageInsert = async (payload) => {
      const msg = payload.new;
      if (!involvesMe(msg)) return;
      if (
        (msg.sender_id === currentUser.id && msg.receiver_id === otherUser.id) ||
        (msg.sender_id === otherUser.id && msg.receiver_id === currentUser.id)
      ) {
        if (msg.receiver_id === currentUser.id) {
          msg.is_read = true;
          addReadMsgIds(currentUser.id, [msg.id]);
          supabase.from('messages').update({ is_read: true }).eq('id', msg.id)
            .then(() => {}, (err) => console.warn('[chat] read receipt failed:', err?.message));
          playNotificationSound();
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
    };

    const onMessageUpdate = (payload) => {
      if (!involvesMe(payload.new)) return;
      setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...payload.new, status: payload.new.is_read ? 'read' : 'sent' } : m));
    };

    channel
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `sender_id=eq.${currentUser.id}` }, onMessageInsert)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${currentUser.id}` }, onMessageInsert)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `sender_id=eq.${currentUser.id}` }, onMessageUpdate)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `receiver_id=eq.${currentUser.id}` }, onMessageUpdate)
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (payload.payload.sender_id === otherUser.id && payload.payload.receiver_id === currentUser.id) {
          setIsTyping(payload.payload.isTyping);
        }
      })
      .on('broadcast', { event: 'new_message' }, (payload) => {
        const msg = payload.payload;
        if (msg.sender_id === otherUser.id && msg.receiver_id === currentUser.id) {
          msg.is_read = true;
          addReadMsgIds(currentUser.id, [msg.id]);
          supabase.from('messages').update({ is_read: true }).eq('id', msg.id)
            .then(() => {}, (err) => console.warn('[chat] read receipt failed:', err?.message));
          playNotificationSound();
          setMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev;
            // Repeating the same words within five seconds is a real message, not a
            // duplicate — only collapse this broadcast into our own optimistic row.
            const temp = prev.find(m =>
              typeof m.id === 'string' &&
              m.id.startsWith('temp-') &&
              m.content === msg.content &&
              m.sender_id === msg.sender_id
            );
            if (temp) return prev.map(m => m.id === temp.id ? { ...msg, status: 'sent' } : m);
            return [...prev, msg];
          });
          setTimeout(scrollToBottom, 50);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: currentUser.id, online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser, otherUser, refreshCallRecords]);

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

  const sendMessage = async (text, { messageType = 'text', callId = null } = {}) => {
    if (!text.trim()) return;

    const tempMsg = {
      id: `temp-${Date.now()}`,
      sender_id: currentUser.id,
      receiver_id: otherUser.id,
      content: text,
      message_type: messageType,
      call_id: callId,
      created_at: new Date().toISOString(),
      is_read: false,
      status: 'sending',
    };

    if (channelRef.current) {
      channelRef.current.send({ type: 'broadcast', event: 'typing', payload: { sender_id: currentUser.id, receiver_id: otherUser.id, isTyping: false } });
    }

    setMessages(prev => [...prev, { ...tempMsg, status: 'sending' }]);
    setTimeout(scrollToBottom, 100);

    try {
      const { data, error } = await supabase.from('messages').insert([{
        sender_id: currentUser.id,
        receiver_id: otherUser.id,
        content: text,
        message_type: messageType,
        call_id: callId,
        is_read: false,
      }]).select();

      if (error) throw error;

      if (data?.[0]) {
        setMessages(prev => prev.map(m => m.id === tempMsg.id ? { ...data[0], status: 'sent' } : m));
        channelRef.current?.send({
          type: 'broadcast',
          event: 'new_message',
          payload: data[0],
        });
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      setMessages(prev => prev.map(m => m.id === tempMsg.id ? { ...m, status: 'error' } : m));
      toast.error('Failed to send message.');
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() && !selectedAttachment) return;
    const msgText = newMessage.trim();
    const currentAttachment = selectedAttachment;
    setNewMessage('');
    setSelectedAttachment(null);
    clearTimeout(typingTimeoutRef.current);

    if (currentAttachment) {
      setUploadingAttachment(true);
      try {
        const file = currentAttachment.file;
        const fileExt = file.name.split('.').pop() || (currentAttachment.type === 'video' ? 'mp4' : 'jpg');
        const filePath = `${currentUser.id}/${Date.now()}_${Math.random().toString(36).slice(2, 9)}.${fileExt}`;
        const mimeByExt = {
          jpg: 'image/jpeg',
          jpeg: 'image/jpeg',
          png: 'image/png',
          webp: 'image/webp',
          gif: 'image/gif',
          heic: 'image/heic',
          mp4: 'video/mp4',
          webm: 'video/webm',
          mov: 'video/quicktime',
          ogg: 'video/ogg',
          '3gp': 'video/3gpp',
        };
        const contentType = file.type || mimeByExt[fileExt.toLowerCase()] || (currentAttachment.type === 'video' ? 'video/mp4' : 'image/jpeg');

        const { error: uploadError } = await supabase.storage
          .from('chat_attachments')
          .upload(filePath, file, { contentType, upsert: true });

        if (uploadError) throw uploadError;

        setMediaUrls(prev => ({ ...prev, [filePath]: currentAttachment.previewUrl }));
        const finalContent = msgText ? `${filePath}\n${msgText}` : filePath;

        await sendMessage(finalContent, { messageType: currentAttachment.type });
      } catch (err) {
        console.error('Failed to upload attachment:', err);
        setSelectedAttachment(currentAttachment);
        setNewMessage(msgText);
        toast.error('Failed to upload file. Please try again.');
      } finally {
        setUploadingAttachment(false);
      }
    } else {
      await sendMessage(msgText);
    }
  };

  useEffect(() => {
    const pending = [];
    messages.forEach(m => {
      const isMedia = m.message_type === 'image' || m.message_type === 'video' ||
        (m.content && /\.(jpg|jpeg|png|webp|gif|heic|mp4|webm|mov|ogg|3gp)(\?.*)?$/i.test(m.content.split('\n')[0]));
      if (!isMedia) return;
      const ref = (m.content || '').split('\n')[0]?.trim();
      if (!ref || /^https?:/i.test(ref)) return;
      if (!mediaUrls[ref]) pending.push(ref);
    });
    if (pending.length === 0) return undefined;

    let cancelled = false;
    const unique = Array.from(new Set(pending));
    supabase.storage
      .from('chat_attachments')
      .createSignedUrls(unique, 3600)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          console.warn('[chat] createSignedUrls failed:', error?.message);
          setMediaUrls(prev => {
            const next = { ...prev };
            unique.forEach(p => { if (!next[p]) next[p] = 'ERROR'; });
            return next;
          });
          return;
        }
        setMediaUrls(prev => {
          const next = { ...prev };
          data.forEach((entry, i) => {
            const key = entry?.path || unique[i];
            if (entry?.signedUrl && key) {
              next[key] = entry.signedUrl;
            } else if (key && !next[key]) {
              next[key] = 'ERROR';
            }
          });
          return next;
        });
      });

    return () => { cancelled = true; };
  }, [messages, mediaUrls]);

  useEffect(() => {
    if (callStatus !== 'connected') return;
    setCallTimer(0);
    const interval = setInterval(() => setCallTimer(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [callStatus]);

  const handleStartCall = useCallback(async (type = 'video') => {
    if (!currentUser?.id || !otherUser?.id) return;

    const callId = newCallId();
    activeCallIdRef.current = callId;
    markActiveCall(callId);
    callConnectedRef.current = false;

    // The record is written before the invite leaves, so the callee always has a row
    // to answer into — including when a decline arrives before the offer round-trips.
    try {
      await createCallRecord({ id: callId, callerId: currentUser.id, calleeId: otherUser.id, callType: type });
    } catch (err) {
      console.error('Failed to open call record:', err);
      toast.error('Could not start the consultation. Please try again.');
      activeCallIdRef.current = null;
      markActiveCall(null);
      return;
    }

    const isVideo = type === 'video';
    sendMessage(
      `Started a ${isVideo ? 'video' : 'voice'} consultation. Select Join ${isVideo ? 'Video' : 'Voice'} Call below to connect.`,
      { messageType: 'call', callId },
    );
    startCallBroadcast(otherUser.id, currentUser.name, type, callId);
    logCallEvent(callId, currentUser.id, 'invite_broadcast', { type, calleeId: otherUser.id });
    sendCallInvite(callId, currentUser.id);

    try {
      const started = await rtcStartCall(type, callId);
      if (started?.declined === 'incoming_offer') {
        // The peer dialled us at the same moment. Stand our dial down and answer
        // theirs, otherwise both sides hold the caller role and each ignores the
        // other's offer as glare until the ring times out. Their call record stays
        // the live one, so this device can still report answered/ended on it.
        markCallMissed(callId);
        const peerCallId = started.callId || null;
        activeCallIdRef.current = peerCallId;
        markActiveCall(peerCallId);
        callConnectedRef.current = false;
        rtcJoinCall(type, peerCallId);
        refreshCallRecords();
        return;
      }
      refreshCallRecords();
    } catch (err) {
      console.error('Failed to start call:', err);
      markCallFailed(callId, 'Call could not start — microphone or camera unavailable');
      toast.error('Could not access microphone/camera. Please check permissions.');
      rtcEndCall();
    }
  }, [currentUser, otherUser?.id, refreshCallRecords, rtcEndCall, rtcJoinCall, rtcStartCall, sendMessage, startCallBroadcast, markActiveCall]);

  const handleEndCall = useCallback((notify = true) => {
    const callId = activeCallIdRef.current;
    if (callId) {
      if (callConnectedRef.current) markCallEnded(callId);
      else markCallMissed(callId);
      refreshCallRecords();
    }
    if (notify && otherUser?.id) {
      sendCallEnded(otherUser.id, callId);
    }
    rtcEndCall();
  }, [otherUser?.id, refreshCallRecords, rtcEndCall, sendCallEnded]);

  const closeCallOverlay = useCallback(() => {
    rtcResetCall();
  }, [rtcResetCall]);

  // Dialling while the peer's invite is ringing makes both sides the caller, and each
  // side then ignores the other's offer as glare until the ring times out. The answer
  // belongs on the incoming-call overlay, not on these buttons.
  const ringingFromPeer = Boolean(incomingCall && incomingCall.sender_id === otherUser?.id);

  const lastJoinedCallRef = useRef(null);
  useEffect(() => {
    if (autoStartCall?.active && otherUser?.id && currentUser?.id) {
      const callKey = `${autoStartCall.type}_${autoStartCall.ts || 'default'}`;
      if (lastJoinedCallRef.current === callKey) return undefined;
      const type = autoStartCall.type || 'video';
      let cancelled = false;
      logCallEvent(autoStartCall.callId, currentUser.id, 'callee_deep_link', { type });

      // A push deep link can land here after the caller already gave up, so confirm
      // the call is still ringing before putting the callee into a dead connect loop.
      (async () => {
        if (autoStartCall.callId) {
          const record = await fetchCallRecord(autoStartCall.callId);
          if (cancelled) return;
          if (record && record.status !== 'ringing') {
            toast('That consultation call has already ended.');
            refreshCallRecords();
            return;
          }
          activeCallIdRef.current = autoStartCall.callId;
          markActiveCall(autoStartCall.callId);
        }
        if (cancelled) return;
        callConnectedRef.current = false;
        // Claimed only when the join really fires. Marking it before the fetch meant an
        // effect re-run during that await cancelled this closure and left the ref set,
        // so the callee never entered a call that was ringing right in front of them.
        lastJoinedCallRef.current = callKey;
        rtcJoinCall(type, autoStartCall.callId || null);
      })();

      return () => { cancelled = true; };
    } else if (autoStartVideo && otherUser?.id && currentUser?.id) {
      if (lastJoinedCallRef.current === 'video_legacy') return undefined;
      lastJoinedCallRef.current = 'video_legacy';
      rtcJoinCall('video');
    }
    return undefined;
  }, [autoStartCall, autoStartVideo, currentUser?.id, otherUser?.id, refreshCallRecords, rtcJoinCall, markActiveCall]);

  useEffect(() => {
    if (callStatus === 'idle') {
      lastJoinedCallRef.current = null;
    }
  }, [callStatus]);

  // Persist the transitions this device observes. Both sides may report the same
  // event; the database keeps the first write because each update is guarded on the
  // timestamp column it fills.
  useEffect(() => {
    const callId = activeCallIdRef.current;
    if (!callId) return;

    if (callStatus === 'connected') {
      if (!callConnectedRef.current) {
        callConnectedRef.current = true;
        markCallAnswered(callId);
      }
      return;
    }

    if (callStatus === 'ended') {
      if (callConnectedRef.current) markCallEnded(callId);
      else if (webRtcError) markCallFailed(callId, 'The call could not connect.');
      else markCallMissed(callId);
      // Cleared so a later call in this conversation cannot write onto this record.
      activeCallIdRef.current = null;
      callConnectedRef.current = false;
      markActiveCall(null);
      refreshCallRecords();
      return;
    }

    if (callStatus === 'idle') refreshCallRecords();
  }, [callStatus, webRtcError, refreshCallRecords, markActiveCall]);

  // A caller whose peer never answers should not sit in "connecting" forever: the
  // database sweeps the row to missed after a few minutes.
  useEffect(() => {
    if (callStatus !== 'connecting' || rtcRole !== 'caller') return undefined;
    const timeout = setTimeout(() => {
      rtcEndCall(true);
      toast('No answer. The invitation has expired.');
    }, RING_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [callStatus, rtcRole, rtcEndCall]);

  useEffect(() => {
    attachMedia();
  }, [attachMedia, callStatus, callType, hasRemoteVideo]);

  useEffect(() => {
    if (callDeclinedByPeer) {
      setShowDeclinedCall(true);
      rtcResetCall();
      setTimeout(() => setShowDeclinedCall(false), 3000);
    }
  }, [callDeclinedByPeer, rtcResetCall]);

  useEffect(() => {
    if (callCancelledByPeer && (callStatus === 'connecting' || callStatus === 'connected')) {
      rtcEndCall(false);
    }
  }, [callCancelledByPeer, callStatus, rtcEndCall]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const statusIcon = (msg) => {
    if (msg.status === 'error') {
      return <AlertCircle className="w-3 h-3 text-danger" title="Failed to send" />;
    }
    if (typeof msg.id === 'string' && msg.id.startsWith('temp-')) {
      return <Clock className="w-3 h-3 text-tertiary" />;
    }
    if (msg.is_read) return <CheckCheck className="w-3 h-3 text-link" />;
    return <Check className="w-3 h-3 text-tertiary" />;
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-800 relative overflow-hidden">
      {/* Video Call Overlay */}
      <AnimatePresence>
        {callStatus !== 'idle' && (
          <motion.div
            data-testid="call-overlay"
            data-call-status={callStatus}
            data-pc-state={pcState}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="absolute inset-0 z-[100] bg-surface-shell flex flex-col select-text"
          >
            {/* Connecting Screen */}
            {callStatus === 'connecting' && (
              <div className="flex-1 flex flex-col items-center justify-center px-6">
                {webRtcError ? (
                  <div className="neu-flat p-8 rounded-[2.5rem] max-w-sm w-full text-center border border-white/80 dark:border-white/10 shadow-2xl">
                    <div className="w-16 h-16 rounded-2xl neu-flat flex items-center justify-center mb-4 mx-auto text-danger">
                      <PhoneOff className="w-7 h-7" />
                    </div>
                    <h3 className="text-slate-900 dark:text-white text-lg font-display font-black">Connection Notice</h3>
                    <p className="text-tertiary dark:text-tertiary text-xs mt-2 max-w-xs mx-auto">{webRtcError}</p>
                    <button
                      type="button"
                      onClick={closeCallOverlay}
                      className="mt-6 px-6 py-2.5 neu-btn text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs transition-all active:scale-95 cursor-pointer"
                    >
                      Close Window
                    </button>
                  </div>
                ) : (
                  <div className="neu-flat p-8 sm:p-10 rounded-2xl max-w-sm w-full text-center border border-white/80 dark:border-white/10 shadow-2xl relative overflow-hidden">
                    {/* Squircle Radar Pulse Avatar */}
                    <div className="relative w-28 h-28 mx-auto mb-5">
                      <motion.div
                        className="absolute inset-0 rounded-2xl border-2 border-primary/40"
                        animate={{ scale: [1, 1.2, 1], opacity: [0.6, 0, 0.6] }}
                        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                      />
                      <motion.div
                        className="absolute inset-0 rounded-2xl border-2 border-emerald-400/40"
                        animate={{ scale: [1, 1.2, 1], opacity: [0.6, 0, 0.6] }}
                        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
                      />
                      <div className="absolute inset-1.5 rounded-2xl neu-flat flex items-center justify-center p-1 overflow-hidden shadow-inner">
                        {otherUser?.photoUrl ? (
                          <img src={otherUser.photoUrl} alt="" className="w-full h-full object-cover rounded-xl" />
                        ) : (
                          <span className="text-2xl font-black text-link">
                            {otherUser?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg neu-flat-sm text-2xs font-extrabold text-link uppercase tracking-widest mb-2">
                      {callType === 'audio' ? 'Connecting Voice Call' : 'Connecting Teleconsultation'}
                    </div>

                    <h3 className="text-slate-900 dark:text-white text-lg font-display font-black truncate">
                      {otherUser?.name || 'Healthcare Provider'}
                    </h3>
                    
                    <div className="flex items-center justify-center gap-2 mt-3 text-xs text-tertiary dark:text-tertiary">
                      <Loader2 className="w-3.5 h-3.5 text-link animate-spin" />
                      <span>{callType === 'audio' ? 'Securing encrypted audio line...' : 'Securing direct P2P video stream...'}</span>
                    </div>

                    <div className="mt-8 flex justify-center">
                      <button
                        type="button"
                        onClick={() => { handleEndCall(true); closeCallOverlay(); }}
                        className="neu-btn w-14 h-14 rounded-2xl flex items-center justify-center text-danger hover:text-danger transition-all active:scale-90 shadow-md cursor-pointer"
                        title="Cancel Call"
                      >
                        <PhoneOff className="w-6 h-6 stroke-[2.5]" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Connected Call Screen */}
            <div className={`absolute inset-0 flex flex-col ${callStatus === 'connected' ? 'z-0' : 'z-[-1] opacity-0 pointer-events-none'}`}>
              {/* Header Bar */}
              <div className="flex items-center justify-between px-5 py-3.5 bg-surface-shell neu-flat border-b border-white/60 dark:border-white/10 shrink-0 z-10 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl neu-flat-sm flex items-center justify-center text-link">
                    {callType === 'audio' ? <Phone className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                  </div>
                  <div>
                    <h3 className="font-display font-black text-xs sm:text-sm text-slate-900 dark:text-white leading-tight">
                      {callType === 'audio' ? 'Voice Consultation' : 'Teleconsultation Session'}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase">Live</span>
                      <p className="text-xs text-success dark:text-success-dark font-mono font-bold tracking-wider">
                        {formatTime(callTimer)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {callType === 'video' && hasRemoteVideo && (
                    <button
                      type="button"
                      onClick={() => setRemoteRotation((r) => (r + 90) % 360)}
                      className="neu-btn p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-link transition-all active:scale-95 cursor-pointer shadow-sm"
                      title={`Rotate Participant Video (${remoteRotation}°)`}
                    >
                      <RotateCw className="w-4 h-4" />
                    </button>
                  )}
                  <span className="hidden sm:inline-block text-xs text-tertiary font-semibold truncate max-w-[150px]">
                    {otherUser?.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleEndCall(true)}
                    className="neu-btn px-3 py-1.5 rounded-xl text-danger hover:text-danger text-xs font-black flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-sm"
                    title="End Call"
                  >
                    <PhoneOff className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Leave</span>
                  </button>
                </div>
              </div>

              {/* Call Content Area */}
              <div className="flex-1 w-full bg-slate-950 relative overflow-hidden flex flex-col items-center justify-center">
                {/* Full Remote Video (visible when remote video track is active) */}
                <video
                  ref={remoteVideoRef}
                  data-testid="remote-video"
                  autoPlay
                  playsInline
                  style={remoteRotation ? { transform: `rotate(${remoteRotation}deg)` } : undefined}
                  className={`w-full h-full object-cover bg-slate-950 transition-all duration-300 ${
                    callType === 'video' && hasRemoteVideo
                      ? 'opacity-100 z-10'
                      : 'opacity-0 z-0 absolute inset-0 pointer-events-none'
                  }`}
                />

                {/* Audio Screen / Remote Camera Off Placeholder */}
                {(!hasRemoteVideo || callType === 'audio') && (
                  <div className="flex-1 flex flex-col items-center justify-center px-6 relative w-full bg-surface-shell z-[5]">
                    <div className="relative w-36 h-36 sm:w-44 sm:h-44 flex items-center justify-center mb-6">
                      <motion.div
                        className="absolute inset-0 rounded-2xl border-2 border-emerald-500/30"
                        animate={{ scale: [1, 1.25, 1], opacity: [0.7, 0, 0.7] }}
                        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                      />
                      <motion.div
                        className="absolute inset-2 rounded-2xl border-2 border-primary/40"
                        animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0, 0.6] }}
                        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
                      />
                      <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl neu-flat flex items-center justify-center overflow-hidden shadow-2xl p-1.5 border border-white/80 dark:border-white/10">
                        {otherUser?.photoUrl ? (
                          <img src={otherUser.photoUrl} alt="" className="w-full h-full object-cover rounded-xl" />
                        ) : (
                          <span className="text-3xl font-black text-link">
                            {otherUser?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'}
                          </span>
                        )}
                      </div>
                    </div>
                    <h3 className="text-xl sm:text-2xl font-display font-black text-slate-900 dark:text-white truncate max-w-xs text-center">
                      {otherUser?.name || 'Healthcare Provider'}
                    </h3>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg neu-flat-sm text-2xs font-bold text-success dark:text-success-dark mt-2 uppercase tracking-widest">
                      {callType === 'audio' ? 'Voice Consultation In Progress' : 'Remote camera is off'}
                    </div>
                  </div>
                )}

                {/* Remote Audio Track: Always mounted */}
                <audio ref={remoteAudioRef} data-testid="remote-audio" autoPlay />

                {/* PiP Local Video Preview */}
                <div className={`absolute bottom-6 right-5 w-28 sm:w-36 aspect-video rounded-2xl overflow-hidden neu-flat shadow-2xl border-2 border-white/60 dark:border-white/10 z-20 bg-slate-900 ${
                  isCameraOff && callType === 'audio' ? 'hidden' : 'block'
                }`}>
                  {isCameraOff ? (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-tertiary bg-slate-800">
                      <CameraOff className="w-5 h-5 mb-1" />
                      <span className="text-xs font-bold">Cam Off</span>
                    </div>
                  ) : (
                    <>
                      <video
                        ref={localVideoRef}
                        data-testid="local-video"
                        autoPlay
                        playsInline
                        muted
                        style={{
                          transform: `rotate(${cameraRotation}deg) ${facingMode === 'user' ? 'scaleX(-1)' : 'scaleX(1)'}`,
                        }}
                        className="w-full h-full object-cover transition-transform duration-200"
                      />
                      {callType === 'video' && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); switchCamera(); }}
                          className="absolute top-1.5 right-1.5 z-30 w-7 h-7 rounded-lg bg-black/60 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-sm transition-all active:scale-90 cursor-pointer shadow-md"
                          title={facingMode === 'user' ? 'Switch to Rear Camera' : 'Switch to Front Camera'}
                        >
                          <SwitchCamera className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Bottom Controls Bar */}
              <div className="px-6 py-4 bg-surface-shell neu-flat border-t border-white/60 dark:border-white/10 flex items-center justify-center gap-3 sm:gap-4 shrink-0 z-10 shadow-lg">
                <button
                  type="button"
                  onClick={toggleMute}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-md ${
                    isMuted 
                      ? 'neu-pressed text-danger border border-rose-500/30' 
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
                      ? 'neu-pressed text-danger border border-rose-500/30' 
                      : 'neu-btn text-slate-700 dark:text-slate-200'
                  }`}
                  title={isCameraOff ? 'Turn Camera On' : 'Turn Camera Off'}
                >
                  {isCameraOff ? <CameraOff className="w-5 h-5 stroke-[2.5]" /> : <Camera className="w-5 h-5" />}
                </button>

                {!isCameraOff && callType === 'video' && (
                  <>
                    <button
                      type="button"
                      onClick={switchCamera}
                      className="w-12 h-12 rounded-2xl neu-btn text-slate-700 dark:text-slate-200 hover:text-link flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-md"
                      title={facingMode === 'user' ? 'Switch to Rear Camera' : 'Switch to Front Camera'}
                    >
                      <SwitchCamera className="w-5 h-5 stroke-[2.2]" />
                    </button>

                    <button
                      type="button"
                      onClick={rotateCamera}
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-md ${
                        cameraRotation > 0
                          ? 'neu-pressed text-link border border-primary/30'
                          : 'neu-btn text-slate-700 dark:text-slate-200'
                      }`}
                      title={`Rotate Camera (${cameraRotation}°)`}
                    >
                      <RotateCw className="w-5 h-5 stroke-[2.2]" />
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => handleEndCall(true)}
                  className="w-14 h-14 rounded-2xl neu-btn text-danger hover:text-danger flex items-center justify-center transition-all active:scale-90 shadow-lg cursor-pointer"
                  title="End Call"
                >
                  <PhoneOff className="w-6 h-6 stroke-[2.5]" />
                </button>
              </div>
            </div>

            {/* Ended Screen */}
            {callStatus === 'ended' && (
              <div className="flex-1 flex flex-col items-center justify-center px-6">
                <div className="neu-flat p-8 sm:p-10 rounded-2xl max-w-sm w-full text-center border border-white/80 dark:border-white/10 shadow-2xl">
                  <div className="w-16 h-16 rounded-2xl neu-flat flex items-center justify-center mb-4 mx-auto text-tertiary">
                    <PhoneOff className="w-7 h-7" />
                  </div>
                  <h3 className="text-slate-900 dark:text-white text-xl font-display font-black">Session Concluded</h3>
                  {callTimer > 0 && (
                    <div className="mt-2 inline-block px-3 py-1 rounded-lg neu-flat-sm text-xs font-mono font-bold text-link">
                      Duration: {formatTime(callTimer)}
                    </div>
                  )}
                  <p className="text-tertiary dark:text-tertiary text-xs mt-3 text-center max-w-xs mx-auto">
                    {otherUser?.name || 'The participant'} has ended the consultation session.
                  </p>
                  <button
                    type="button"
                    onClick={closeCallOverlay}
                    className="mt-6 px-6 py-2.5 neu-btn text-link rounded-xl font-extrabold text-xs transition-all active:scale-95 cursor-pointer shadow-sm"
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
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 max-w-xs w-full mx-4 shadow-2xl border border-slate-100 dark:border-slate-700 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <PhoneOff className="w-8 h-8 text-danger" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Call Declined</h2>
            <p className="text-sm text-tertiary dark:text-tertiary mt-1 font-medium">
              {otherUser?.name || 'The other party'} declined the call
            </p>
          </div>
        </motion.div>
      )}

      {/* Chat Header (Option 1: Squircle Avatar + Online/Offline Tag + Labeled Action Squircles) */}
      <div
        className="px-4 py-3 neu-flat border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between gap-2.5 shrink-0 z-10"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))' }}
      >
        <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="neu-btn w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer -ml-1 text-slate-600 dark:text-slate-300 hover:text-link shrink-0"
              title="Back to conversations"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <Link
            to={
              (currentUser?.role || authUser?.role) === 'provider'
                ? `/provider/patients/${otherUser.id}/profile`
                : `/patient/providers/${otherUser.id}/profile`
            }
            className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0 group cursor-pointer"
          >
            <div className="neu-flat-sm w-10 h-10 rounded-xl overflow-hidden p-0.5 flex items-center justify-center shrink-0 border border-slate-200/80 dark:border-white/10">
              {otherUser.photoUrl ? (
                <img src={otherUser.photoUrl} alt="" className="w-full h-full object-cover rounded-lg" />
              ) : (
                <UserCircle className="w-6 h-6 text-link" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <h3 className="font-extrabold text-sm sm:text-base text-slate-800 dark:text-slate-100 group-hover:text-link transition-colors leading-tight truncate">
                  {otherUser.name}
                </h3>
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider shrink-0 border ${
                    isUserOnline(otherUser.id)
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                      : 'bg-slate-200/70 dark:bg-slate-800 border-slate-300/80 dark:border-white/10 text-tertiary'
                  }`}
                >
                  {isUserOnline(otherUser.id) ? 'Online' : 'Offline'}
                </span>
              </div>
              <p className="text-2xs text-tertiary dark:text-tertiary font-semibold truncate mt-0.5">
                {isPatientView ? 'Healthcare Provider' : 'Patient'} &bull; Direct Consultation Channel
              </p>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={() => handleStartCall('audio')}
            disabled={ringingFromPeer}
            className={`neu-btn w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-slate-700 dark:text-slate-200 hover:text-success transition-all ${
              ringingFromPeer ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
            }`}
            title={ringingFromPeer ? 'Answer the incoming call first' : 'Start Voice Consultation'}
          >
            <Phone className="w-4 h-4 text-emerald-500 stroke-[2.2]" />
          </button>

          <button
            type="button"
            onClick={() => handleStartCall('video')}
            disabled={ringingFromPeer}
            className={`neu-btn w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-slate-700 dark:text-slate-200 hover:text-link transition-all ${
              ringingFromPeer ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
            }`}
            title={ringingFromPeer ? 'Answer the incoming call first' : 'Start Teleconsultation (Video)'}
          >
            <Video className="w-4 h-4 text-link stroke-[2.2]" />
          </button>

          <button
            type="button"
            onClick={() => setShowProfilePanel(prev => !prev)}
            className={`neu-btn w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
              showProfilePanel
                ? 'neu-pressed text-link border border-primary/40'
                : 'text-slate-700 dark:text-slate-200 hover:text-link'
            }`}
            title={showProfilePanel ? 'Hide Information' : 'Conversation Information'}
          >
            <Info className="w-4 h-4 stroke-[2.2]" />
          </button>
        </div>
      </div>

      {/* Chat Body: Left Feed + Right Slide-Over Dossier (Desktop) / Bottom Sheet (Mobile) */}
      <div className="flex-1 flex flex-row min-h-0 overflow-hidden relative">
        {/* Left Column: Messages Feed + Composer */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          {/* Messages Area */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto bg-slate-50/40 dark:bg-slate-900/40 min-h-0"
          >
            <div className="px-4 md:px-6 py-4">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-24 text-tertiary">
                  <Loader2 className="w-8 h-8 text-link animate-spin mb-2" />
                  <p className="text-xs font-semibold">Loading messages...</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-16 px-4">
                  <div className="neu-flat w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 text-link">
                    <MessageSquare className="w-7 h-7" />
                  </div>
                  <h4 className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-100">
                    Start Direct Consultation
                  </h4>
                  <p className="text-xs text-tertiary dark:text-tertiary max-w-xs mt-1 leading-relaxed">
                    Send a message, share care instructions, or launch a voice or video session with {otherUser.name}.
                  </p>
                  <div className="mt-4 px-3 py-1.5 rounded-lg neu-flat-sm border border-slate-200/80 dark:border-white/10 text-3xs font-extrabold uppercase tracking-wider text-tertiary">
                    Messages automatically expire after 24 hours
                  </div>
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
                    const isHighlighted = highlightedMessageId === msg.id;

                    return (
                      <React.Fragment key={msg.id}>
                        {showDate && (
                          <div className="flex justify-center my-4">
                            <span className="neu-flat-sm text-2xs font-extrabold uppercase tracking-wider text-tertiary dark:text-tertiary px-3 py-1 rounded-lg">
                              {formatDateLabel(msg.created_at)}
                            </span>
                          </div>
                        )}
                        <motion.div
                          id={`msg-${msg.id}`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${showAvatar ? 'mt-4 sm:mt-5' : 'mt-2 sm:mt-2.5'} transition-all duration-300 rounded-2xl ${
                            isHighlighted ? 'ring-4 ring-primary/60 bg-primary/10 p-1.5 -m-1.5 shadow-lg' : ''
                          }`}
                        >
                          {!isMe && (
                            <div className={`neu-flat-sm w-8 h-8 rounded-xl overflow-hidden shrink-0 mr-2.5 self-end p-0.5 ${showAvatar ? '' : 'invisible'}`}>
                              {otherUser.photoUrl ? (
                                <img src={otherUser.photoUrl} alt="" className="w-full h-full object-cover rounded-lg" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-link font-black text-xs">
                                  {otherUser.name?.[0] || '?'}
                                </div>
                              )}
                            </div>
                          )}
                          <div className={`max-w-[82%] md:max-w-[68%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                            <div className={`px-4 py-2.5 relative ${
                              isMe
                                ? 'neu-btn-primary rounded-2xl rounded-br-sm shadow-md'
                                : 'neu-flat rounded-2xl rounded-bl-sm text-slate-800 dark:text-slate-100 font-medium'
                            }`}>
                              {(() => {
                                const isImage = msg.message_type === 'image' || (msg.content && /\.(jpg|jpeg|png|webp|gif|heic)(\?.*)?$/i.test(msg.content.split('\n')[0]));
                                const isVideo = msg.message_type === 'video' || (msg.content && /\.(mp4|webm|mov|ogg|3gp)(\?.*)?$/i.test(msg.content.split('\n')[0]));
                                if (isImage || isVideo) {
                                  const lines = (msg.content || '').split('\n');
                                  const ref = lines[0];
                                  const mediaUrl = /^https?:/i.test(ref) ? ref : mediaUrls[ref];
                                  const caption = lines.slice(1).join('\n').trim();
                                  if (!mediaUrl) {
                                    return (
                                      <div className="space-y-2 max-w-sm">
                                        <div className="w-56 h-32 rounded-xl neu-inset flex items-center justify-center">
                                          <Loader2 className="w-5 h-5 animate-spin text-link" />
                                        </div>
                                        {caption && (
                                          <p className="text-sm whitespace-pre-wrap leading-relaxed select-text font-medium px-1">
                                            {renderHighlightedText(caption, searchMessageTerm)}
                                          </p>
                                        )}
                                      </div>
                                    );
                                  }
                                  if (mediaUrl === 'ERROR') {
                                    return (
                                      <div className="space-y-2 max-w-sm">
                                        <div className="w-56 h-32 rounded-xl neu-inset flex flex-col items-center justify-center p-3 text-center text-xs text-tertiary">
                                          <AlertCircle className="w-5 h-5 text-danger mb-1" />
                                          <span>Failed to load media</span>
                                        </div>
                                        {caption && (
                                          <p className="text-sm whitespace-pre-wrap leading-relaxed select-text font-medium px-1">
                                            {renderHighlightedText(caption, searchMessageTerm)}
                                          </p>
                                        )}
                                      </div>
                                    );
                                  }
                                  return (
                                    <div className="space-y-2 max-w-sm">
                                      {isImage ? (
                                        <div
                                          onClick={() => setLightboxMedia({ url: mediaUrl, type: 'image' })}
                                          className="rounded-xl overflow-hidden cursor-pointer relative group bg-black/10 border border-white/20 shadow-sm"
                                        >
                                          <img
                                            src={mediaUrl}
                                            alt="Attachment"
                                            className="w-full max-h-64 object-cover group-hover:scale-102 transition-transform duration-200"
                                            loading="lazy"
                                          />
                                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1">
                                            <Maximize2 className="w-4 h-4" />
                                            <span>Click to view</span>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="rounded-xl overflow-hidden bg-black border border-white/20 shadow-sm">
                                          <video
                                            src={mediaUrl}
                                            controls
                                            playsInline
                                            preload="metadata"
                                            className="w-full max-h-64 object-contain"
                                          />
                                        </div>
                                      )}
                                      {caption && (
                                        <p className="text-sm whitespace-pre-wrap leading-relaxed select-text font-medium px-1">
                                          {renderHighlightedText(caption, searchMessageTerm)}
                                        </p>
                                      )}
                                    </div>
                                  );
                                }
                                const cleanedText = stripLeadingCallMarker(msg.content);
                                return <p className="text-sm whitespace-pre-wrap leading-relaxed select-text">{renderHighlightedText(cleanedText, searchMessageTerm)}</p>;
                              })()}
                              {isCallMessage(msg) && (
                                <CallBubbleAction
                                  msg={msg}
                                  record={msg.call_id ? callRecordsById[msg.call_id] : null}
                                  isMe={isMe}
                                  onJoin={() => {
                                    if (msg.call_id) {
                                      activeCallIdRef.current = msg.call_id;
                                      markActiveCall(msg.call_id);
                                      callConnectedRef.current = false;
                                    } else {
                                      activeCallIdRef.current = null;
                                      markActiveCall(null);
                                    }
                                    rtcJoinCall(
                                      callTypeOf(msg, callRecordsById[msg.call_id]),
                                      msg.call_id || null,
                                    );
                                  }}
                                />
                              )}
                            </div>
                            {showTime && (
                              <div className="flex items-center gap-1.5 mt-1.5 px-1">
                                <span className="text-xs text-tertiary dark:text-tertiary font-semibold tabular-nums">
                                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                {isMe && (
                                  <span className="text-tertiary dark:text-tertiary">{statusIcon(msg)}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      </React.Fragment>
                    );
                  })}

                  {/* 24-Hour Notice */}
                  <div className="flex items-center gap-3 my-6 px-4">
                    <div className="flex-1 h-px bg-slate-200/80 dark:bg-white/10" />
                    <span className="text-2xs text-tertiary dark:text-tertiary font-bold uppercase tracking-wider select-none shrink-0">
                      Messages disappear after 24 hours
                    </span>
                    <div className="flex-1 h-px bg-slate-200/80 dark:bg-white/10" />
                  </div>
                </>
              )}

              {/* Typing Indicator (Squircle bars) */}
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
                        <div className="w-full h-full flex items-center justify-center text-link font-black text-xs">
                          {otherUser.name?.[0] || '?'}
                        </div>
                      )}
                    </div>
                    <div className="neu-flat rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5">
                      <motion.div className="w-1.5 h-1.5 bg-primary rounded-xs" animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0 }} />
                      <motion.div className="w-1.5 h-1.5 bg-primary rounded-xs" animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }} />
                      <motion.div className="w-1.5 h-1.5 bg-primary rounded-xs" animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }} />
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
                className="fixed bottom-20 right-6 neu-btn w-10 h-10 rounded-xl flex items-center justify-center z-30 cursor-pointer"
              >
                <svg className="w-5 h-5 text-tertiary dark:text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </motion.button>
            )}
          </div>

          {/* Attachment Preview Bar */}
          {selectedAttachment && (
            <div className="px-4 py-2 neu-inset border-t border-slate-200/60 dark:border-white/5 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                {selectedAttachment.type === 'image' ? (
                  <img src={selectedAttachment.previewUrl} alt="" className="w-10 h-10 rounded-xl object-cover border border-primary/30 shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0">
                    <Video className="w-4 h-4 text-link" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{selectedAttachment.name}</p>
                  <p className="text-2xs text-link font-semibold">{selectedAttachment.size} MB &bull; Ready to send</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRemoveAttachment}
                className="neu-btn w-7 h-7 rounded-xl flex items-center justify-center text-tertiary hover:text-danger transition-colors cursor-pointer shrink-0"
                title="Remove attachment"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Bottom Composer Bar (Option 1) */}
          <div
            className="p-3 sm:p-3.5 neu-flat border-t border-slate-200/80 dark:border-white/10 shrink-0"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
          >
            <form onSubmit={handleSend} className="flex gap-2 max-w-4xl mx-auto items-center">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="image/*,video/*"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAttachment}
                className="neu-btn w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center transition-all shrink-0 cursor-pointer text-slate-700 dark:text-slate-200 hover:text-link"
                title="Attach photo or video"
              >
                <Paperclip className="w-4 h-4 stroke-[2.2]" />
              </button>
              <div className="neu-inset flex-1 flex items-center rounded-xl px-3.5 h-10 sm:h-11 transition-all">
                <input
                  type="text"
                  value={newMessage}
                  onChange={handleTyping}
                  placeholder={selectedAttachment ? 'Add an optional caption...' : `Write a message to ${otherUser.name}...`}
                  className="w-full bg-transparent border-0 px-1 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 outline-none focus:outline-none focus:ring-0 placeholder:text-tertiary placeholder:font-normal min-w-0"
                />
              </div>
              <button
                type="submit"
                disabled={(!newMessage.trim() && !selectedAttachment) || uploadingAttachment}
                className="neu-btn-primary px-3.5 sm:px-4 h-10 sm:h-11 rounded-xl flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 disabled:pointer-events-none shrink-0 cursor-pointer shadow-md text-xs font-black"
                title="Send Message"
              >
                {uploadingAttachment ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <>
                    <span className="hidden sm:inline">Send</span>
                    <Send className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Option 1 Dossier: Desktop Slide-Over Sidebar & Mobile Slide-Up Bottom Sheet */}
        <AnimatePresence>
          {showProfilePanel && (() => {
            const sharedMedia = messages.filter(m =>
              m.message_type === 'image' ||
              m.message_type === 'video' ||
              (m.content && /\.(jpg|jpeg|png|webp|gif|heic|mp4|webm|mov|ogg|3gp)(\?.*)?$/i.test(m.content.split('\n')[0]))
            );
            const partnerOnline = isUserOnline(otherUser.id);
            const profilePath =
              (currentUser?.role || authUser?.role) === 'provider'
                ? `/provider/patients/${otherUser.id}/profile`
                : `/patient/providers/${otherUser.id}/profile`;

            const dossierBody = (
              <div className="space-y-4">
                {/* Compact Identity Card */}
                <div className="neu-flat-sm p-3 rounded-xl flex items-center justify-between gap-3 border border-slate-200/80 dark:border-white/10">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl overflow-hidden p-0.5 flex items-center justify-center bg-slate-100 dark:bg-slate-800 shrink-0">
                      {otherUser.photoUrl ? (
                        <img src={otherUser.photoUrl} alt="" className="w-full h-full object-cover rounded-lg" />
                      ) : (
                        <UserCircle className="w-8 h-8 text-link" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-display font-black text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                        {otherUser.name}
                      </h4>
                      <p className="text-2xs text-tertiary font-semibold truncate">
                        {partnerProfile?.role ? (partnerProfile.role === 'provider' ? 'Healthcare Provider' : 'Patient') : 'Healthcare Contact'}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider shrink-0 border ${
                      partnerOnline
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                        : 'bg-slate-200/70 dark:bg-slate-800 border-slate-300/80 dark:border-white/10 text-tertiary'
                    }`}
                  >
                    {partnerOnline ? 'Online' : 'Offline'}
                  </span>
                </div>

                {/* 1. SEARCH IN THREAD */}
                <div className="space-y-1.5">
                  <span className="text-3xs font-extrabold uppercase tracking-wider text-tertiary block">
                    Search in Thread
                  </span>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      placeholder="Find message in conversation..."
                      value={searchMessageTerm}
                      onChange={(e) => setSearchMessageTerm(e.target.value)}
                      className="w-full neu-inset rounded-xl pl-9 pr-8 h-9 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:outline-none placeholder:text-tertiary"
                    />
                    <Search className="w-3.5 h-3.5 text-primary absolute left-3 z-10 pointer-events-none shrink-0" />
                    {searchMessageTerm && (
                      <button
                        type="button"
                        onClick={() => setSearchMessageTerm('')}
                        className="absolute right-2 z-10 text-tertiary hover:text-danger p-1 rounded-lg cursor-pointer"
                        title="Clear search"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* MATCHING MESSAGES RESULTS LIST */}
                  {searchMessageTerm.trim() && (
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center justify-between px-0.5">
                        <span className="text-3xs font-black uppercase tracking-wider text-tertiary">
                          Matching Results
                        </span>
                        <span className="text-3xs font-black px-1.5 py-0.5 rounded-md bg-link/15 text-link">
                          {searchResults.length} {searchResults.length === 1 ? 'match' : 'matches'}
                        </span>
                      </div>
                      {searchResults.length === 0 ? (
                        <div className="neu-flat p-2.5 rounded-xl text-center text-2xs text-tertiary font-medium">
                          No messages match &ldquo;{searchMessageTerm}&rdquo;
                        </div>
                      ) : (
                        <div className="max-h-44 overflow-y-auto space-y-1.5 pr-0.5">
                          {searchResults.map((msg) => {
                            const isMe = msg.sender_id === currentUser?.id;
                            const timeStr = new Date(msg.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            });
                            return (
                              <button
                                key={msg.id}
                                type="button"
                                onClick={() => handleJumpToMessage(msg.id)}
                                className="w-full text-left p-2 rounded-xl neu-btn hover:border-link/40 transition-all cursor-pointer flex flex-col gap-0.5 group"
                                title="Click to jump to this message in chat"
                              >
                                <div className="flex items-center justify-between text-3xs w-full">
                                  <span className="font-extrabold text-link">
                                    {isMe ? 'You' : otherUser.name}
                                  </span>
                                  <span className="text-tertiary font-semibold">{timeStr}</span>
                                </div>
                                <p className="text-2xs text-slate-700 dark:text-slate-200 line-clamp-2 leading-tight">
                                  {renderHighlightedText(stripLeadingCallMarker(msg.content || ''), searchMessageTerm)}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 2. ON/OFF CONSENT ACCESS TOGGLE BUTTON (patient only, Squircle Switch) */}
                {isPatientView && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-3xs font-extrabold uppercase tracking-wider text-tertiary">Legal &amp; Consent</span>
                      <span className={`text-3xs font-black uppercase tracking-wider ${consentEnabled ? 'text-emerald-600' : 'text-slate-400 dark:text-slate-500'}`}>
                        {consentEnabled ? 'Active' : 'Revoked'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleToggleConsent}
                      className={`w-full py-2 px-3 rounded-xl flex items-center justify-between transition-all cursor-pointer border ${
                        consentEnabled
                          ? 'neu-flat border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                          : 'neu-pressed border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400'
                      }`}
                      title={consentEnabled ? 'Click to revoke consent access' : 'Click to grant consent access'}
                    >
                      <span className="text-xs font-black">Consent Access</span>
                      <div className={`w-10 h-5 flex items-center rounded-lg p-0.5 transition-colors duration-200 ${
                        consentEnabled ? 'bg-emerald-500 justify-end' : 'bg-slate-300 dark:bg-slate-600 justify-start'
                      }`}>
                        <div className="w-4 h-4 bg-white rounded-md" />
                      </div>
                    </button>
                  </div>
                )}

                {/* 3. ACTIVE APPOINTMENT IF ANY */}
                {activeRequest && (
                  <div className="space-y-1.5">
                    <span className="text-3xs font-extrabold uppercase tracking-wider text-tertiary block">Current Visit</span>
                    <div className="neu-flat p-3 rounded-xl space-y-1 text-xs border border-slate-200/80 dark:border-white/10">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-extrabold text-slate-800 dark:text-slate-100 truncate">
                          {activeRequest.service || 'Care Visit'}
                        </p>
                        <span className="px-1.5 py-0.5 rounded-md bg-link/15 text-link text-[9px] font-black uppercase shrink-0">
                          {activeRequest.status}
                        </span>
                      </div>
                      {activeRequest.date && (
                        <p className="text-2xs text-tertiary font-semibold">
                          {activeRequest.date} {activeRequest.time ? `\u2022 ${activeRequest.time}` : ''}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* 4. SHARED MEDIA & FILES */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-3xs font-extrabold uppercase tracking-wider text-tertiary">Shared Media</span>
                    <span className="px-1.5 py-0.5 rounded-md bg-link/15 text-link text-3xs font-black">
                      {sharedMedia.length} {sharedMedia.length === 1 ? 'Item' : 'Items'}
                    </span>
                  </div>
                  {sharedMedia.length === 0 ? (
                    <div className="neu-inset p-3 rounded-xl text-center text-2xs text-tertiary font-semibold">
                      No photos or videos shared yet
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-1.5">
                      {sharedMedia.slice(0, 9).map((m, idx) => {
                        const ref = (m.content || '').split('\n')[0]?.trim();
                        const mediaUrl = /^https?:/i.test(ref) ? ref : mediaUrls[ref];
                        const isVid = m.message_type === 'video' || /\.(mp4|webm|mov|ogg|3gp)(\?.*)?$/i.test(ref);
                        const isError = mediaUrl === 'ERROR';
                        return (
                          <div
                            key={m.id || idx}
                            onClick={() => mediaUrl && !isError && setLightboxMedia({ url: mediaUrl, type: isVid ? 'video' : 'image' })}
                            className="aspect-square rounded-xl overflow-hidden bg-black/10 border border-slate-200/80 dark:border-white/10 cursor-pointer relative group flex items-center justify-center"
                          >
                            {isVid ? (
                              <div className="w-full h-full bg-slate-900 text-white flex items-center justify-center">
                                <Video className="w-4 h-4 text-link" />
                              </div>
                            ) : mediaUrl && !isError ? (
                              <img
                                src={mediaUrl}
                                alt="Shared media"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                loading="lazy"
                              />
                            ) : isError ? (
                              <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-danger">
                                <AlertCircle className="w-4 h-4" />
                              </div>
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-800">
                                <Loader2 className="w-4 h-4 animate-spin text-link" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );

            if (isMobileScreen) {
              return (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => setShowProfilePanel(false)}
                  className="fixed inset-0 z-[70] bg-black/60 flex flex-col justify-end select-text"
                >
                  <motion.div
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                    onClick={(e) => e.stopPropagation()}
                    {...infoDrawerMotionProps}
                    className="w-full max-h-[82dvh] bg-surface-shell rounded-t-2xl border-t-2 border-primary/40 shadow-2xl flex flex-col overflow-hidden"
                    style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}
                  >
                    <div className="shrink-0 cursor-grab active:cursor-grabbing" {...infoDragHandleProps}>
                      <div className="pt-2.5 pb-1 flex justify-center shrink-0">
                        <div className="w-10 h-1 rounded-xs bg-slate-400/50 dark:bg-slate-600" />
                      </div>
                      <div className="px-4 py-2.5 border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between shrink-0">
                        <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">
                          Conversation Info
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowProfilePanel(false)}
                          className="neu-btn px-2.5 py-1 rounded-lg text-2xs font-black text-slate-700 dark:text-slate-200 hover:text-danger cursor-pointer"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                    <div className="p-4 overflow-y-auto space-y-4 flex-1">
                      {dossierBody}
                      <Link
                        to={profilePath}
                        className="neu-btn-primary w-full py-2.5 px-3 rounded-xl text-xs font-black text-white flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
                      >
                        <span>View Full Profile</span>
                        <span>&rarr;</span>
                      </Link>
                    </div>
                  </motion.div>
                </motion.div>
              );
            }

            return (
              <motion.aside
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 300, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="w-72 sm:w-80 border-l border-slate-200/80 dark:border-white/10 bg-surface-shell/60 flex flex-col justify-between h-full overflow-hidden shrink-0 z-10 select-text"
              >
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-white/10 pb-2.5">
                    <span className="text-2xs font-black uppercase tracking-wider text-tertiary">
                      Conversation Info
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowProfilePanel(false)}
                      className="neu-btn px-2 py-0.5 rounded-lg text-3xs font-black text-tertiary hover:text-danger cursor-pointer"
                    >
                      Hide
                    </button>
                  </div>
                  {dossierBody}
                </div>
                <div className="p-4 border-t border-slate-200/80 dark:border-white/10 shrink-0">
                  <Link
                    to={profilePath}
                    className="neu-btn w-full py-2.5 px-3 rounded-xl text-xs font-black text-link hover:text-primary-700 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <span>View Full Profile</span>
                    <span>&rarr;</span>
                  </Link>
                </div>
              </motion.aside>
            );
          })()}
        </AnimatePresence>
      </div>

      {/* Lightbox Modal */}
      {lightboxMedia && (
        <div
          className="fixed inset-0 z-[300] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightboxMedia(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setLightboxMedia(null)}
              className="absolute -top-10 right-0 text-white hover:text-danger p-2 text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
              <span>Close</span>
            </button>
            {lightboxMedia.type === 'video' ? (
              <video
                src={lightboxMedia.url}
                controls
                autoPlay
                className="max-h-[85vh] max-w-full rounded-2xl shadow-2xl"
              />
            ) : (
              <img
                src={lightboxMedia.url}
                alt="Enlarged"
                className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatWindow;
