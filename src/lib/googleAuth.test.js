import { describe, it, expect, vi } from 'vitest';
import { startGoogleSignIn, googleCallbackError } from './googleAuth';
describe('Google sign in', () => {
 it('requires explicit privacy acceptance before starting OAuth', async () => {
  const auth = { signInWithOAuth: vi.fn() };
  await expect(startGoogleSignIn(auth, { accepted: false, origin: 'https://example.com' })).rejects.toThrow(/privacy/i);
  expect(auth.signInWithOAuth).not.toHaveBeenCalled();
 });
 it('uses Google and returns only to the current website login', async () => {
  const auth = { signInWithOAuth: vi.fn(async () => ({ error: null })) };
  await startGoogleSignIn(auth, { accepted: true, origin: 'https://example.com', redirect: 'https://evil.test' });
  expect(auth.signInWithOAuth).toHaveBeenCalledWith({ provider: 'google', options: { redirectTo: 'https://example.com/login', scopes: 'openid email profile', queryParams: { prompt: 'select_account' } } });
 });
 it('surfaces provider errors', async () => {
  await expect(startGoogleSignIn({ signInWithOAuth: async () => ({ error: { message: 'Provider disabled' } }) }, { accepted: true, origin: 'https://example.com' })).rejects.toThrow('Provider disabled');
 });
 it('does not render untrusted callback error descriptions', () => {
  expect(googleCallbackError('?error=access_denied&error_description=private', '')).toContain('cancelled');
  expect(googleCallbackError('', '#error=server_error&error_description=secret')).not.toContain('secret');
 });
});
