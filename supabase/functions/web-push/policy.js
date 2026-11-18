export function validSubscription(value) {
  try {
    const url = new URL(value.endpoint);
    const host = url.hostname;
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      (host === 'fcm.googleapis.com' || host === 'updates.push.services.mozilla.com' || host === 'web.push.apple.com' || host.endsWith('.notify.windows.com')) &&
      /^[A-Za-z0-9_-]{87}$/.test(value.keys.p256dh) && /^[A-Za-z0-9_-]{22}$/.test(value.keys.auth);
  } catch { return false; }
}
export const classifyDelivery = (status) => status >= 200 && status < 300 ? 'delivered' : [404, 410].includes(status) ? 'expired' : 'retry';
export function notificationPayload(job) {
  return { id: job.id, userId: job.user_id, kind: job.payload.kind, path: job.payload.path, expiresAt: Date.parse(job.expires_at) };
}
