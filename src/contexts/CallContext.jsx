import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { markCallDeclined } from '@/features/chat/lib/callRecords';
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

  // A call can be announced twice — once by the realtime invite and once by the push
  // that woke the app. Presenting the same callId twice would restart the ringtone.
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

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase.channel(`calls_${user.id}`);
    channel
      .on('broadcast', { event: 'incoming_call' }, (payload) => {
        const { sender_id, sender_name, call_type, call_id } = payload.payload;
        presentIncomingCall({ senderId: sender_id, senderName: sender_name, callType: call_type, callId: call_id });
      })
      .on('broadcast', { event: 'call_declined' }, () => {
        setCallDeclinedByPeer(true);
        setTimeout(() => setCallDeclinedByPeer(false), 3000);
      })
      .on('broadcast', { event: 'call_ended' }, () => {
        setIncomingCall(null);
        setCallCancelledByPeer(true);
        setTimeout(() => setCallCancelledByPeer(false), 3000);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, presentIncomingCall]);

  const broadcastCallAccepted = useCallback((targetUserId) => {
    if (!targetUserId) return;
    const channel = supabase.channel(`calls_${targetUserId}`);
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.send({
          type: 'broadcast',
          event: 'call_accepted',
          payload: { sender_id: user.id }
        });
        setTimeout(() => supabase.removeChannel(channel), 3000);
      }
    });
  }, [user]);

  const acceptCall = useCallback(() => {
    if (!incomingCall || !user) return;
    const role = user.role;
    const callType = incomingCall.callType || 'video';
    const callParam = incomingCall.callId ? `&call=${incomingCall.callId}` : '';
    broadcastCallAccepted(incomingCall.sender_id);
    navigate(`/${role}/messages?partner=${incomingCall.sender_id}&name=${encodeURIComponent(incomingCall.sender_name || '')}&startCall=${callType}&ts=${Date.now()}${callParam}${callType === 'video' ? '&startVideo=1' : ''}`);
    setIncomingCall(null);
  }, [incomingCall, user, navigate, broadcastCallAccepted]);

  const rejectCall = useCallback(() => {
    if (!incomingCall || !user) return;
    if (incomingCall.callId) markCallDeclined(incomingCall.callId);
    const channel = supabase.channel(`calls_${incomingCall.sender_id}`);
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.send({
          type: 'broadcast',
          event: 'call_declined',
          payload: { sender_id: user.id, call_id: incomingCall.callId || null }
        });
        setTimeout(() => supabase.removeChannel(channel), 3000);
      }
    });
    setIncomingCall(null);
  }, [incomingCall, user]);

  const startCallBroadcast = useCallback((targetUserId, callerName, callType = 'video', callId = null) => {
    const channel = supabase.channel(`calls_${targetUserId}`);
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.send({
          type: 'broadcast',
          event: 'incoming_call',
          payload: { sender_id: user.id, sender_name: callerName, call_type: callType, call_id: callId }
        });
        setTimeout(() => supabase.removeChannel(channel), 3000);
      }
    });
  }, [user]);

  const sendCallEnded = useCallback((targetUserId, callId = null) => {
    const channel = supabase.channel(`calls_${targetUserId}`);
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.send({
          type: 'broadcast',
          event: 'call_ended',
          payload: { sender_id: user.id, call_id: callId }
        });
        setTimeout(() => supabase.removeChannel(channel), 3000);
      }
    });
  }, [user]);

  return (
    <CallContext.Provider value={{
      incomingCall,
      acceptCall,
      rejectCall,
      callDeclinedByPeer,
      callCancelledByPeer,
      startCallBroadcast,
      sendCallEnded,
      broadcastCallAccepted,
    }}>
      {children}
    </CallContext.Provider>
  );
};
