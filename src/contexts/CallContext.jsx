import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { markCallDeclined, markCallMissed } from '@/features/chat/lib/callRecords';
import { CALL_INVITE_EVENT } from '@/lib/pushNotifications';

const CallContext = createContext(null);

export const useCalls = () => useContext(CallContext);

export const CallProvider = ({ children }) => {
  const auth = useAuth();
  const user = auth?.user;
  const navigate = useNavigate();
  const [incomingCall, setIncomingCall] = useState(null);
  const [callDeclinedByPeer, setCallDeclinedByPeer] = useState(false);
  const [callCancelledByPeer, setCallCancelledByPeer] = useState(false);

  // The call this device is currently inside. Broadcasts naming a different call are
  // leftovers from a previous one between the same pair and must not end a live call.
  const activeCallIdRef = useRef(null);
  const noticeTimersRef = useRef({ declined: null, cancelled: null });
  // One persistent outbound channel per peer: channels are returned by topic, so a
  // second dial-then-cancel within 3 s used to race the first channel's removal timer
  // and drop the cancel.
  const peerChannelsRef = useRef(new Map());

  /*
   * A call can be announced twice — once by the realtime invite and once by the push
   * that woke the app. Presenting the same callId twice would restart the ringtone.
   */
  const presentIncomingCall = useCallback(({ senderId, senderName, callType, callId }) => {
    if (!senderId) return;
    const next = {
      sender_id: senderId,
      sender_name: senderName || '',
      callType: callType || 'video',
      callId: callId || null,
    };
    setIncomingCall((current) => (current?.callId && current.callId === next.callId ? current : next));
  }, []);

  useEffect(() => {
    const onPushInvite = (event) => presentIncomingCall(event.detail);
    window.addEventListener(CALL_INVITE_EVENT, onPushInvite);
    return () => window.removeEventListener(CALL_INVITE_EVENT, onPushInvite);
  }, [presentIncomingCall]);

  const flashNotice = useCallback((key, setter) => {
    clearTimeout(noticeTimersRef.current[key]);
    setter(true);
    noticeTimersRef.current[key] = setTimeout(() => setter(false), 3000);
  }, []);

  useEffect(() => {
    const timers = noticeTimersRef.current;
    return () => {
      Object.values(timers).forEach((id) => clearTimeout(id));
    };
  }, []);

  useEffect(() => {
    if (!user?.id) return undefined;

    const channel = supabase.channel(`calls_${user.id}`);
    channel
      .on('broadcast', { event: 'incoming_call' }, (payload) => {
        const { sender_id, sender_name, call_type, call_id } = payload.payload;
        presentIncomingCall({ senderId: sender_id, senderName: sender_name, callType: call_type, callId: call_id });
      })
      .on('broadcast', { event: 'call_declined' }, (payload) => {
        const callId = payload.payload?.call_id || null;
        if (callId && activeCallIdRef.current && callId !== activeCallIdRef.current) return;
        flashNotice('declined', setCallDeclinedByPeer);
      })
      .on('broadcast', { event: 'call_ended' }, (payload) => {
        const callId = payload.payload?.call_id || null;
        if (callId && activeCallIdRef.current && callId !== activeCallIdRef.current) return;
        // Only drop the ring when it belongs to the call that just ended.
        setIncomingCall((current) => (!current || !callId || current.callId === callId ? null : current));
        if (activeCallIdRef.current && (!callId || callId === activeCallIdRef.current)) {
          activeCallIdRef.current = null;
        }
        flashNotice('cancelled', setCallCancelledByPeer);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, presentIncomingCall, flashNotice]);

  const getPeerChannel = useCallback((targetUserId) => {
    const topic = `calls_${targetUserId}`;
    const existing = peerChannelsRef.current.get(topic);
    if (existing) return existing;

    const entry = { channel: null, ready: false, queue: [] };
    const channel = supabase.channel(topic);
    entry.channel = channel;
    peerChannelsRef.current.set(topic, entry);

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        entry.ready = true;
        const pending = entry.queue.splice(0);
        pending.forEach((msg) => channel.send({ type: 'broadcast', event: msg.event, payload: msg.payload }));
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        entry.ready = false;
        if (peerChannelsRef.current.get(topic) === entry) {
          peerChannelsRef.current.delete(topic);
          supabase.removeChannel(channel);
        }
      }
    });

    return entry;
  }, []);

  useEffect(() => {
    const channels = peerChannelsRef.current;
    return () => {
      channels.forEach((entry) => supabase.removeChannel(entry.channel));
      channels.clear();
    };
  }, []);

  const sendToPeer = useCallback((targetUserId, event, payload) => {
    if (!targetUserId || !user?.id) return;
    const entry = getPeerChannel(targetUserId);
    const message = { event, payload: { ...payload, sender_id: user.id } };
    if (entry.ready) {
      entry.channel.send({ type: 'broadcast', event: message.event, payload: message.payload });
    } else {
      entry.queue.push(message);
    }
  }, [getPeerChannel, user]);

  const acceptCall = useCallback(() => {
    if (!incomingCall || !user) return;
    const role = user.role;
    // The overlay sits above ProtectedRoute, so it can be tapped before the
    // database-backed role has arrived. Navigating then would target /null/messages.
    if (!role) return;
    const callType = incomingCall.callType || 'video';
    const callParam = incomingCall.callId ? `&call=${incomingCall.callId}` : '';
    activeCallIdRef.current = incomingCall.callId || null;
    navigate(`/${role}/messages?partner=${incomingCall.sender_id}&name=${encodeURIComponent(incomingCall.sender_name || '')}&startCall=${callType}&ts=${Date.now()}${callParam}${callType === 'video' ? '&startVideo=1' : ''}`);
    setIncomingCall(null);
  }, [incomingCall, user, navigate]);

  const rejectCall = useCallback(() => {
    if (!incomingCall || !user) return;
    if (incomingCall.callId) markCallDeclined(incomingCall.callId);
    sendToPeer(incomingCall.sender_id, 'call_declined', { call_id: incomingCall.callId || null });
    setIncomingCall(null);
  }, [incomingCall, user, sendToPeer]);

  const startCallBroadcast = useCallback((targetUserId, callerName, callType = 'video', callId = null) => {
    activeCallIdRef.current = callId;
    sendToPeer(targetUserId, 'incoming_call', {
      sender_name: callerName,
      call_type: callType,
      call_id: callId,
    });
  }, [sendToPeer]);

  const sendCallEnded = useCallback((targetUserId, callId = null) => {
    sendToPeer(targetUserId, 'call_ended', { call_id: callId });
    if (!callId || activeCallIdRef.current === callId) activeCallIdRef.current = null;
  }, [sendToPeer]);

  // The caller stopped ringing us (or gave up) without a broadcast reaching us.
  const expireIncomingCall = useCallback(() => {
    if (incomingCall?.callId) markCallMissed(incomingCall.callId);
    setIncomingCall(null);
  }, [incomingCall]);

  const markActiveCall = useCallback((callId) => {
    activeCallIdRef.current = callId || null;
  }, []);

  return (
    <CallContext.Provider value={{
      incomingCall,
      acceptCall,
      rejectCall,
      callDeclinedByPeer,
      callCancelledByPeer,
      startCallBroadcast,
      sendCallEnded,
      markActiveCall,
      expireIncomingCall,
    }}>
      {children}
    </CallContext.Provider>
  );
};
