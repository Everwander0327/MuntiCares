import { describe, it, expect, vi } from 'vitest';
import { verifySignupCode, setupAction, needsAccountSetup } from './accountSetup';
describe('first-time account setup', () => {
 it('adopts the replacement session after password creation before returning', async()=>{
  const session={access_token:'access',refresh_token:'refresh'};
  const auth={getSession:vi.fn(async()=>({data:{session},error:null})),setSession:vi.fn(async()=>({error:null}))};
  const client={auth,functions:{invoke:vi.fn(async()=>({data:{ok:true,session}}))}};
  await setupAction(client,'password',{password:'test-password'});
  expect(auth.setSession).toHaveBeenCalledWith(session);
 });
 it('returns an actionable session error without invoking the endpoint when signed out',async()=>{
  const client={auth:{getSession:async()=>({data:{session:null},error:null})},functions:{invoke:vi.fn()}};
  await expect(setupAction(client,'send')).rejects.toMatchObject({code:'setup_session_expired'});
  expect(client.functions.invoke).not.toHaveBeenCalled();
 });

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
  const client={auth:{getSession:async()=>({data:{session:{access_token:'a'}}})},functions:{invoke:vi.fn(async()=>({error:{message:'network'},data:null}))}};
  await expect(setupAction(client,'verify',{code:'123456'})).rejects.toThrow();
 });
});
