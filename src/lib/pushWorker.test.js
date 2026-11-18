import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

function worker(owner = 'a') {
  const handlers = {};
  const showNotification = vi.fn(async () => {});
  const openWindow = vi.fn(async () => {});
  const self = {
    location: { origin: 'https://munticares.test' },
    addEventListener: (name, handler) => { handlers[name] = handler; },
    registration: { showNotification },
    clients: { matchAll: async () => [], openWindow, claim: async () => {} },
    skipWaiting: async () => {},
  };
  const cache = { match: async () => owner ? new Response(owner) : undefined, put: async () => {}, delete: async () => {} };
  vm.runInNewContext(readFileSync('public/push-sw.js', 'utf8'), { self, caches: { open: async () => cache }, URL, Response, Date, Promise });
  const push = async (payload) => {
    let done; handlers.push({ data: { json: () => payload }, waitUntil: (p) => { done = p; } }); await done;
  };
  const click = async (data) => {
    let done; handlers.notificationclick({ notification: { data, close() {} }, waitUntil: (p) => { done = p; } }); await done;
  };
  return { push, click, showNotification, openWindow };
}

describe('push service worker', () => {
  it('does not display pushes for another account or a signed-out browser', async () => {
    const f = worker();
    await f.push({ userId: 'b', kind: 'message', expiresAt: Date.now() + 1000 });
    expect(f.showNotification).not.toHaveBeenCalled();
    const signedOut = worker(null);
    await signedOut.push({ userId: 'a', kind: 'message', expiresAt: Date.now() + 1000 });
    expect(signedOut.showNotification).not.toHaveBeenCalled();
  });
  it('drops expired calls', async () => {
    const f = worker();
    await f.push({ userId: 'a', kind: 'call', expiresAt: Date.now() - 1 });
    expect(f.showNotification).not.toHaveBeenCalled();
  });
  it('shows only generic text even if the payload includes private content', async () => {
    const f = worker();
    await f.push({ userId: 'a', kind: 'message', body: 'private diagnosis', expiresAt: Date.now() + 5000, path: '/patient/messages' });
    expect(f.showNotification).toHaveBeenCalledWith('MuntiCares', expect.objectContaining({ body: 'You have a new message. Open MuntiCares to read it.' }));
    expect(JSON.stringify(f.showNotification.mock.calls)).not.toContain('private diagnosis');
  });
  it('never opens an external notification URL or a previous account link', async () => {
    const f = worker();
    await f.click({ userId: 'a', path: 'https://evil.test' });
    expect(f.openWindow).toHaveBeenCalledWith('https://munticares.test/');
    await f.click({ userId: 'b', path: '/patient/messages' });
    expect(f.openWindow).toHaveBeenCalledTimes(1);
  });
});
