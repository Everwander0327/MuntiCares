import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const PresenceContext = createContext();

export const usePresence = () => useContext(PresenceContext);

export const PresenceProvider = ({ children }) => {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const channelRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  useEffect(() => {
    if (!user) {
      setOnlineUsers(new Set());
      return;
    }

    let cancelled = false;

    const setupPresence = () => {
      if (cancelled) return;

      const channel = supabase.channel('global-presence', {
        config: { presence: { key: user.id }, broadcast: { self: true } }
      });

      channel
        .on('presence', { event: 'sync' }, () => {
          if (cancelled) return;
          const state = channel.presenceState();
          const userIds = new Set(Object.keys(state));
          setOnlineUsers(userIds);
        })
        .on('presence', { event: 'join' }, ({ key }) => {
          if (cancelled) return;
          setOnlineUsers(prev => new Set(prev).add(key));
        })
        .on('presence', { event: 'leave' }, ({ key }) => {
          if (cancelled) return;
          setOnlineUsers(prev => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        })
        .subscribe(async (status) => {
          if (cancelled) return;

          if (status === 'SUBSCRIBED') {
            await channel.track({
              user_id: user.id,
              full_name: user.full_name,
              online_at: new Date().toISOString(),
            });
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            // Auto-reconnect after 3 seconds
            reconnectTimeoutRef.current = setTimeout(() => {
              if (!cancelled) setupPresence();
            }, 3000);
          }
        });

      channelRef.current = channel;
    };

    setupPresence();

    return () => {
      cancelled = true;
      clearTimeout(reconnectTimeoutRef.current);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user]);

  const isUserOnline = useCallback((userId) => onlineUsers.has(userId), [onlineUsers]);

  return (
    <PresenceContext.Provider value={{ onlineUsers, isUserOnline }}>
      {children}
    </PresenceContext.Provider>
  );
};
