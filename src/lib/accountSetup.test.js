import { describe, it, expect, vi } from 'vitest';
import { verifySignupCode, setupAction, needsAccountSetup } from './accountSetup';
describe('first-time account setup', () => {
 it('blocks an unknown or pending completion state', () => {
  expect(needsAccountSetup({ setup_pending: true })).toBe(true);
  expect(needsAccountSetup({ setup_pending: false })).toBe(false);
 });
 it('validates a code before requesting verification', async () => {
  const auth={verifyOtp:vi.fn()};
  await expect(verifySignupCode(auth,'email@example.com','bad')).rejects.toThrow(/6-digit/);
  expect(auth.verifyOtp).not.toHaveBeenCalled();
 });
 it('verifies the code against the supplied signup email', async () => {
  const auth={verifyOtp:vi.fn(async()=>({error:null}))};
  await verifySignupCode(auth,'email@example.com','123456');
  expect(auth.verifyOtp).toHaveBeenCalledWith({email:'email@example.com',token:'123456',type:'email'});
 });
 it('never treats a failed Edge request as completed', async () => {
  const client={functions:{invoke:vi.fn(async()=>({error:{message:'network'},data:null}))}};
  await expect(setupAction(client,'verify',{code:'123456'})).rejects.toThrow();
 });
});
