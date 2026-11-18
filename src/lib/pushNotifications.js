import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { createWebPushClient } from './webPushClient';
import { inviteFromPayload, shouldDeliverInvite } from './pushInvite';

export const CALL_INVITE_EVENT = 'munticares:call-invite';
export const PUSH_STATE_EVENT = 'munticares:push-state';
const OWNER_KEY = 'munticares_web_push_owner';
export const isWebPushSupported = () => typeof window !== 'undefined' && window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const webPushOwner = () => { try { return localStorage.getItem(OWNER_KEY); } catch { return null; } };

async function registration() {
  await navigator.serviceWorker.register('/push-sw.js', { scope: '/', updateViaCache: 'none' });
  return navigator.serviceWorker.ready;
}

async function setOwner(userId) {
  const reg = await registration();
  await new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => { channel.port1.close(); reject(new Error('Notification setup timed out. Please retry.')); }, 5000);
    channel.port1.onmessage = ({ data }) => {
      clearTimeout(timer); channel.port1.close();
      if (data?.ok) resolve(); else reject(new Error('Could not save notification preference.'));
    };
    reg.active.postMessage({ type: 'PUSH_OWNER', userId }, [channel.port2]);
  });
  if (userId) localStorage.setItem(OWNER_KEY, userId);
  else localStorage.removeItem(OWNER_KEY);
  window.dispatchEvent(new Event(PUSH_STATE_EVENT));
}

let serial = Promise.resolve();
const client = createWebPushClient({
  supported: isWebPushSupported,
  permission: () => Notification.permission,
  requestPermission: () => Notification.requestPermission(),
  registration, setOwner, getOwner: webPushOwner,
  lock: (fn) => {
    if (navigator.locks) return navigator.locks.request('munticares-web-push', fn);
    const next = serial.then(fn, fn); serial = next.catch(() => {}); return next;
  },
  api: async (body, expectedUserId) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || (expectedUserId && session.user.id !== expectedUserId)) throw new Error('Your session changed. Sign in and try again.');
    const { data, error } = await supabase.functions.invoke('web-push', { body });
    if (error || data?.error) throw new Error(data?.error || 'Unable to reach notification service. Please retry.');
    // Do not attach a completed registration to an account that signed out meanwhile.
    const { data: latest } = await supabase.auth.getSession();
    if (expectedUserId && latest.session?.user.id !== expectedUserId) throw new Error('Your session changed. Sign in and try again.');
    return data;
  },
});

export const enableWebPush = (userId) => client.enable(userId);
export const clearPushToken = () => client.disable();

export function useCallPushNotifications(user) {
  const userId = user?.id;
  useEffect(() => {
    if (!isWebPushSupported()) return undefined;
    client.sync(userId).catch((error) => console.warn('[web-push] sync failed:', error.message));
    const onMessage = ({ data }) => {
      if (data?.type !== 'PUSH_CALL' || !userId) return;
      const invite = inviteFromPayload(data.payload);
      if (invite?.receiverId === userId && shouldDeliverInvite(invite, userId)) {
        window.dispatchEvent(new CustomEvent(CALL_INVITE_EVENT, { detail: invite }));
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [userId]);
}
