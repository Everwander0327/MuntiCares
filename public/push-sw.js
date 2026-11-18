const OWNER_CACHE = 'munticares-push-owner';
const OWNER_URL = '/__push_owner';
async function owner() {
  const response = await (await caches.open(OWNER_CACHE)).match(OWNER_URL);
  return response ? response.text() : null;
}
self.addEventListener('install', (event) => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'PUSH_OWNER') return;
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(OWNER_CACHE);
      if (event.data.userId) await cache.put(OWNER_URL, new Response(event.data.userId));
      else await cache.delete(OWNER_URL);
      event.ports[0]?.postMessage({ ok: true });
    } catch { event.ports[0]?.postMessage({ ok: false }); }
  })());
});
function safeUrl(path) {
  const url = new URL(path || '/', self.location.origin);
  return url.origin === self.location.origin && /^\/(patient|provider|admin)(\/|$)/.test(url.pathname)
    ? url.href : self.location.origin + '/';
}
self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    let payload;
    try { payload = event.data.json(); } catch { return; }
    if (!payload.userId || await owner() !== payload.userId || !Number.isFinite(payload.expiresAt) || payload.expiresAt <= Date.now()) return;
    const bodies = {
      call: 'Incoming consultation call. Open MuntiCares to respond.',
      message: 'You have a new message. Open MuntiCares to read it.',
      booking: 'Your booking has an update. Open MuntiCares to view it.',
      status: 'Your visit status has changed. Open MuntiCares to view it.',
    };
    if (!bodies[payload.kind]) return;
    await self.registration.showNotification('MuntiCares', {
      body: bodies[payload.kind], icon: '/images/brand/logo-512.png',
      tag: payload.id || payload.kind,
      data: { userId: payload.userId, path: payload.path },
    });
  })());
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const data = event.notification.data;
    if (!data?.userId || await owner() !== data.userId) return;
    const url = safeUrl(data.path);
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      if (new URL(client.url).origin === self.location.origin) {
        await client.navigate(url); await client.focus(); return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
