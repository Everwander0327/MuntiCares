import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import toast from 'react-hot-toast';
import { playToastSound } from '@/lib/audio';

const native = () => Capacitor.isNativePlatform();

function numericId(tag) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = (hash * 31 + tag.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 2147483647 || 1;
}

export async function ensureNotificationPermission() {
  if (native()) {
    try {
      const current = await LocalNotifications.checkPermissions();
      if (current.display !== 'granted') {
        await LocalNotifications.requestPermissions();
      }
    } catch {
      /* fall back to in-app alerts */
    }
    return;
  }

  // Browsers require a user gesture for the permission prompt. The existing
  // notification bell asks for it; here we only use an already-granted permission.
  try {
    if ('Notification' in window && Notification.permission === 'default') {
      // No-op: do not prompt from a background effect.
    }
  } catch { /* ignore */ }
}

export async function notifyTracking(title, body, { tag, sound = true } = {}) {
  const id = tag || `${title}:${body}`;

  if (sound) playToastSound('success');
  toast.success(body ? `${title}: ${body}` : title, {
    id: `tracking-alert-${id}`,
    duration: 8000,
  });

  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, tag: id });
    }
  } catch { /* ignore */ }

  if (native()) {
    try {
      const permission = await LocalNotifications.checkPermissions();
      if (permission.display === 'granted') {
        await LocalNotifications.schedule({
          notifications: [{
            id: numericId(id),
            title,
            body,
          }],
        });
      }
    } catch {
      /* in-app alert already shown */
    }
  }
}
