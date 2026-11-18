import toast from 'react-hot-toast';
import { playToastSound } from '@/lib/audio';

// Permission is requested only by the explicit web push control.
export async function ensureNotificationPermission() {}

export async function notifyTracking(title, body, { tag, sound = true } = {}) {
  if (sound) playToastSound('success');
  toast.success(body ? `${title}: ${body}` : title, {
    id: `tracking-alert-${tag || `${title}:${body}`}`,
    duration: 8000,
  });
  // System notifications are delivered by the server through the service worker.
}
