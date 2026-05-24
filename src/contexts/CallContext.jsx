import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

const CallContext = createContext(null);

export const useCalls = () => useContext(CallContext);

export const CallProvider = ({ children }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [incomingCall, setIncomingCall] = useState(null);
  const [callDeclinedByPeer, setCallDeclinedByPeer] = useState(false);
const [callCancelledByPeer, setCallCancelledByPeer] = useState(false);

  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel(`calls_${user.id}`);
    channel
      .on('broadcast', { event: 'incoming_call' }, (payload) => {
        const { sender_id, sender_name } = payload.payload;
        setIncomingCall({ sender_id, sender_name });
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
  }, [user]);

  const broadcastCallAccepted = useCallback((targetUserId) => {
    if (!targetUserId) return;
    const channel = supabase.channel(`calls_${targetUserId}`);
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.send({
          type: 'broadcast',
          event: 'call_accepted',
          payload: { sender_id: user.id }
        });
        supabase.removeChannel(channel);
      }
    });
  }, [user]);

  const acceptCall = useCallback(() => {
    if (!incomingCall || !user) return;
    const role = user.role;
    broadcastCallAccepted(incomingCall.sender_id);
    navigate(`/${role}/messages?partner=${incomingCall.sender_id}&name=${encodeURIComponent(incomingCall.sender_name || '')}&startVideo=1`);
    setIncomingCall(null);
  }, [incomingCall, user, navigate, broadcastCallAccepted]);

  const rejectCall = useCallback(() => {
    if (!incomingCall || !user) return;
    const channel = supabase.channel(`calls_${incomingCall.sender_id}`);
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.send({
          type: 'broadcast',
          event: 'call_declined',
          payload: { sender_id: user.id }
        });
        supabase.removeChannel(channel);
      }
    });
    setIncomingCall(null);
  }, [incomingCall, user]);

  const startCallBroadcast = useCallback((targetUserId, callerName) => {
    const channel = supabase.channel(`calls_${targetUserId}`);
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.send({
          type: 'broadcast',
          event: 'incoming_call',
          payload: { sender_id: user.id, sender_name: callerName }
        });
        supabase.removeChannel(channel);
      }
    });
  }, [user]);

  const sendCallEnded = useCallback((targetUserId) => {
    const channel = supabase.channel(`calls_${targetUserId}`);
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.send({
          type: 'broadcast',
          event: 'call_ended',
          payload: { sender_id: user.id }
        });
        supabase.removeChannel(channel);
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
