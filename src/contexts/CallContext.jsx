import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { markCallDeclined, markCallMissed, fetchRingingCallForCallee } from '@/features/chat/lib/callRecords';
import { logCallEvent } from '@/features/chat/lib/callEvents';
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
   *
   * refusedCallIdsRef: the ringing row stays open until the 5-minute sweep closes it, so
   * a declined or expired call must not be re-presented by the recovery poll below.
   */
  const presentedCallIdRef = useRef(null);
  const refusedCallIdsRef = useRef(new Set());
  // Mirror of incomingCall for the event handlers below: they must compare and clear the
  // ring without re-subscribing the calls channel every time the ring changes.
  const incomingCallRef = useRef(null);

  const setRing = useCallback((next) => {
    incomingCallRef.current = next;
    presentedCallIdRef.current = next?.callId || null;
    setIncomingCall(next);
  }, []);

  const refuseCall = useCallback((callId) => {
    if (callId) {
      if (refusedCallIdsRef.current.size > 50) refusedCallIdsRef.current.clear();
      refusedCallIdsRef.current.add(callId);
    }
    setRing(null);
  }, [setRing]);

  const presentIncomingCall = useCallback(({ senderId, senderName, callType, callId, source }) => {
    if (!senderId) return;
    if (callId && refusedCallIdsRef.current.has(callId)) return;
    const next = {
      sender_id: senderId,
      sender_name: senderName || '',
      callType: callType || 'video',
      callId: callId || null,
    };
    if (next.callId && presentedCallIdRef.current === next.callId) return;
    setRing(next);
    if (next.callId) logCallEvent(next.callId, user?.id, 'ring_presented', { source: source || 'broadcast' });
  }, [setRing, user?.id]);

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
        presentIncomingCall({ senderId: sender_id, senderName: sender_name, callType: call_type, callId: call_id, source: 'broadcast' });
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
        const current = incomingCallRef.current;
        if (!current || !callId || current.callId === callId) setRing(null);
        if (activeCallIdRef.current && (!callId || callId === activeCallIdRef.current)) {
          activeCallIdRef.current = null;
        }
        flashNotice('cancelled', setCallCancelledByPeer);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, presentIncomingCall, flashNotice, setRing]);

  /*
   * Recovery for the case the websocket can never cover. Supabase broadcast is
   * fire-and-forget: an invite that left while this user's tab was closed, backgrounded
   * or still subscribing is gone for good, and nothing else ever tells them they were
   * called. That is what most of the recorded 'missed' calls are. The ringing row is the
   * only part of an invite that outlives the moment, so re-read it on mount, whenever the
   * app comes back to the foreground, and on a slow interval while it is open.
   */
  useEffect(() => {
    if (!user?.id) return undefined;

    let disposed = false;
    let running = false;
    const recover = async () => {
      // Do not ring over a call this device is already inside or already showing, and do
      // not let the interval, focus and visibility fires stack duplicate queries.
      if (disposed || running || incomingCallRef.current || activeCallIdRef.current) return;
      running = true;
      try {
        const row = await fetchRingingCallForCallee(user.id);
        if (disposed || !row) return;
        presentIncomingCall({
          senderId: row.caller_id,
          senderName: row.callerName,
          callType: row.call_type,
          callId: row.id,
          source: 'recovery',
        });
      } finally {
        running = false;
      }
    };

    recover();
    const interval = setInterval(recover, 10000);
    const onAwake = () => {
      if (document.visibilityState === 'visible') recover();
    };
    window.addEventListener('focus', onAwake);
    document.addEventListener('visibilitychange', onAwake);

    return () => {
      disposed = true;
      clearInterval(interval);
      window.removeEventListener('focus', onAwake);
      document.removeEventListener('visibilitychange', onAwake);
    };
  }, [presentIncomingCall, user?.id]);

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

  const acceptCall = useCallback(async () => {
    if (!incomingCall || !user) return;
    // The overlay sits above ProtectedRoute, so it can be tapped before the
    // database-backed role has arrived, and /null/messages is not a route. Resolving
    // the role here is what makes that tap still join: returning quietly was a callee
    // who looks at a ringing screen and does nothing while the caller's ring runs out.
    let role = user.role;
    if (!role) {
      const { data } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
      role = data?.role || null;
    }
    if (!role) {
      toast.error('Still signing you in — please tap Accept once more.');
      return;
    }
    if (incomingCall.callId) logCallEvent(incomingCall.callId, user.id, 'call_accepted', { role });
    const callType = incomingCall.callType || 'video';
    const callParam = incomingCall.callId ? `&call=${incomingCall.callId}` : '';
    activeCallIdRef.current = incomingCall.callId || null;
    navigate(`/${role}/messages?partner=${incomingCall.sender_id}&name=${encodeURIComponent(incomingCall.sender_name || '')}&startCall=${callType}&ts=${Date.now()}${callParam}${callType === 'video' ? '&startVideo=1' : ''}`);
    // Refused, not just cleared: the row keeps its 'ringing' status until the connection
    // is recorded, and the recovery poll would otherwise re-present it over a live call.
    refuseCall(incomingCall.callId);
  }, [incomingCall, navigate, refuseCall, user]);

  const rejectCall = useCallback(() => {
    if (!incomingCall || !user) return;
    if (incomingCall.callId) {
      markCallDeclined(incomingCall.callId);
      logCallEvent(incomingCall.callId, user.id, 'call_declined', {});
    }
    sendToPeer(incomingCall.sender_id, 'call_declined', { call_id: incomingCall.callId || null });
    refuseCall(incomingCall.callId);
  }, [incomingCall, refuseCall, sendToPeer, user]);

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
    if (incomingCall?.callId) {
      markCallMissed(incomingCall.callId);
      logCallEvent(incomingCall.callId, user?.id, 'ring_expired', {});
    }
    // The row stays 'ringing' until the sweep closes it, so refuse it here or the
    // recovery poll would hand the same dead dial back every 10 seconds.
    refuseCall(incomingCall?.callId);
  }, [incomingCall, refuseCall, user?.id]);

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
