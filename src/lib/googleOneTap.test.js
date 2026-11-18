import { describe, it, expect, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { prepareOneTap } from './googleOneTap';
function fixture(active = true) {
 const google = { initialize: vi.fn(), prompt: vi.fn() };
 const auth = { signInWithIdToken: vi.fn(async () => ({ error: null })) };
 return { google, auth, clientId: 'public-id', isActive: () => active, onBusy: vi.fn(), onError: vi.fn(), cryptoApi: webcrypto };
}
describe('One Tap consent and nonce', () => {
 it('initializes and prompts only once across concurrent mounts and remounts', async () => {
  const f = fixture();
  await Promise.all([prepareOneTap(f), prepareOneTap(f)]);
  await prepareOneTap({ ...f, onError: vi.fn() });
  expect(f.google.initialize).toHaveBeenCalledTimes(1);
  expect(f.google.prompt).toHaveBeenCalledTimes(1);
 });

 it('never initializes or prompts after consent was withdrawn', async () => {
  const f = fixture(false); await prepareOneTap(f); expect(f.google.initialize).not.toHaveBeenCalled();
 });
 it('sends hashed nonce to Google and raw nonce to Supabase', async () => {
  const f = fixture(); await prepareOneTap(f);
  const config = f.google.initialize.mock.calls[0][0];
  await config.callback({ credential: 'google-token' });
  const request = f.auth.signInWithIdToken.mock.calls[0][0];
  const hash = await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(request.nonce));
  expect(config.nonce).toBe(Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join(''));
  expect(request.token).toBe('google-token'); expect(config.auto_select).toBe(false);
 });
 it('ignores a delayed credential when the component becomes inactive', async () => {
  let active = true; const f = fixture(); f.isActive = () => active;
  await prepareOneTap(f); active = false;
  await f.google.initialize.mock.calls[0][0].callback({ credential: 'late' });
  expect(f.auth.signInWithIdToken).not.toHaveBeenCalled();
 });
});
