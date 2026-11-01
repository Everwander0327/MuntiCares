import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from '@/lib/supabase';

/*
 * FCM registration for call invites.
 *
 * Supabase Realtime is a websocket: it can only ring a device that is already running.
 * This registers the device token under the signed-in user so the `call-invite` Edge
 * Function can wake a closed app, and forwards whatever FCM delivers back into the app
 * as a plain window event, so routing decisions stay in CallContext.
 *
 * A notification tap does NOT join the call. It raises the same Accept/Decline overlay
 * an in-app ring uses, because auto-joining a medical consultation from a lock screen
 * would put a stranger on camera with the handset still in a pocket.
 */

export const CALL_INVITE_EVENT = 'munticares:call-invite';
export const CALL_PUSH_CHANNEL_ID = 'munticares-calls';
const TOKEN_STORAGE_KEY = 'munticares_push_token';

const emitInvite = (detail) => {
  if (!detail?.senderId) return;
  window.dispatchEvent(new CustomEvent(CALL_INVITE_EVENT, { detail }));
};

const inviteFromPayload = (data) => {
  if (!data || data.kind !== 'call_invite') return null;
  return {
    senderId: data.sender_id,
    senderName: data.sender_name || '',
    callType: data.call_type === 'audio' ? 'audio' : 'video',
    callId: data.call_id || null,
  };
};

async function saveToken(userId, deviceToken) {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, deviceToken);
  } catch {
    // Private mode / quota: the row is still written, only logout pruning is lost.
  }
  const { error } = await supabase.from('push_tokens').upsert({
    user_id: userId,
    device_token: deviceToken,
    platform: Capacitor.getPlatform(),
    last_seen_at: new Date().toISOString(),
  }, { onConflict: 'user_id,device_token' });
  if (error) console.warn('[push] token upsert failed:', error.message);
}

const saveTokenSafe = (userId, deviceToken) => {
  saveToken(userId, deviceToken).catch((err) => console.warn('[push] token save failed:', err));
};

// Called from AuthContext.logout, while the session is still valid, so RLS lets this
// device remove its own rows.
export async function clearPushToken() {
  let deviceToken = null;
  try {
    deviceToken = localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return;
  }
  if (!deviceToken) return;
  const { error } = await supabase.from('push_tokens').delete().eq('device_token', deviceToken);
  if (error) console.warn('[push] token delete failed:', error.message);
}

export function useCallPushNotifications(user) {
  const userId = user?.id;

  useEffect(() => {
    if (!userId || !Capacitor.isNativePlatform()) return undefined;

    let disposed = false;
    const handles = [];
    const attach = async (name, handler) => {
      const handle = await PushNotifications.addListener(name, handler);
      if (disposed) handle.remove();
      else handles.push(handle);
    };

    (async () => {
      try {
        if (Capacitor.getPlatform() === 'android') {
          // Android 8+ drops notifications that name no channel, and the Edge Function
          // has to address this exact id for a killed app's tray notification.
          await PushNotifications.createChannel({
            id: CALL_PUSH_CHANNEL_ID,
            name: 'Consultation calls',
            description: 'Rings when a patient or provider starts a voice or video consultation.',
            importance: 5,
            visibility: 1,
            vibration: true,
          });
        }

        const permission = await PushNotifications.requestPermissions();
        if (permission.receive !== 'granted') {
          console.warn('[push] notification permission declined');
          return;
        }
        await PushNotifications.register();
      } catch (err) {
        console.warn('[push] registration failed:', err?.message || err);
      }
    })();

    attach('registration', ({ value }) => saveTokenSafe(userId, value));
    attach('registrationError', (err) => console.warn('[push] registration error:', err?.error || err));
    attach('pushNotificationReceived', (notification) => {
      emitInvite(inviteFromPayload(notification?.data));
    });
    attach('pushNotificationActionPerformed', (action) => {
      emitInvite(inviteFromPayload(action?.notification?.data));
    });

    return () => {
      disposed = true;
      handles.forEach((handle) => handle.remove().catch(() => {}));
    };
  }, [userId]);
}
