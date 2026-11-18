import { describe, expect, it, vi } from 'vitest';
import { createWebPushClient, decodeApplicationKey } from './webPushClient';

function fixture(permission = 'granted') {
  let subscription = null;
  const unsubscribe = vi.fn(async () => { subscription = null; return true; });
  const created = { endpoint: 'https://push.example/token', toJSON: () => ({ endpoint: 'https://push.example/token', keys: {} }), unsubscribe };
  const registration = { pushManager: {
    getSubscription: vi.fn(async () => subscription),
    subscribe: vi.fn(async () => { subscription = created; return created; }),
  }, getNotifications: vi.fn(async () => []) };
  const api = vi.fn(async (body) => body.action === 'config' ? { publicKey: 'BA' } : {});
  const owners = [];
  const env = {
    supported: () => true, permission: () => permission,
    requestPermission: vi.fn(async () => permission),
    registration: async () => registration,
    setOwner: vi.fn(async (id) => owners.push(id)),
    getOwner: () => owners.at(-1),
    api, lock: (fn) => fn(),
  };
  return { client: createWebPushClient(env), env, registration, unsubscribe, api, owners };
}

describe('web push account lifecycle', () => {
  it('does not subscribe or call the server after permission is denied', async () => {
    const f = fixture('denied');
    await expect(f.client.enable('a')).rejects.toThrow(/blocked/i);
    expect(f.api).not.toHaveBeenCalled();
    expect(f.registration.pushManager.subscribe).not.toHaveBeenCalled();
  });
  it('registers the subscription then binds the worker to the account', async () => {
    const f = fixture();
    await f.client.enable('a');
    expect(f.api).toHaveBeenCalledWith(expect.objectContaining({ action: 'subscribe' }), 'a');
    expect(f.owners.at(-1)).toBe('a');
  });
  it('unsubscribes and clears the worker even when server removal fails', async () => {
    const f = fixture();
    await f.client.enable('a');
    f.api.mockRejectedValue(new Error('offline'));
    await f.client.disable();
    expect(f.unsubscribe).toHaveBeenCalled();
    expect(f.owners.at(-1)).toBe(null);
  });
  it('detaches the previous account before enabling another', async () => {
    const f = fixture();
    await f.client.enable('a');
    await f.client.enable('b');
    expect(f.unsubscribe).toHaveBeenCalledTimes(1);
    expect(f.registration.pushManager.subscribe).toHaveBeenCalledTimes(2);
    expect(f.owners.at(-1)).toBe('b');
  });
  it('rolls back a newly created subscription if registration fails', async () => {
    const f = fixture();
    f.api.mockImplementation(async ({ action }) => { if (action === 'config') return { publicKey: 'BA' }; throw new Error('offline'); });
    await expect(f.client.enable('a')).rejects.toThrow('offline');
    expect(f.unsubscribe).toHaveBeenCalled();
    expect(f.owners.at(-1)).toBe(null);
  });
  it('decodes URL-safe public keys', () => {
    expect([...decodeApplicationKey('AQID_w')]).toEqual([1, 2, 3, 255]);
  });
});
