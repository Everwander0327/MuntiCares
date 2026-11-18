import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({passwordSet:false,refresh:vi.fn(async()=>({})),invoke:vi.fn(),verify:vi.fn(),logout:vi.fn()}));
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({user:{id:'a',email:'person@gmail.com',setup_password_set:mocks.passwordSet},refreshUser:mocks.refresh,logout:mocks.logout})}));
vi.mock('@/lib/supabase',()=>({supabase:{functions:{invoke:mocks.invoke},auth:{verifyOtp:mocks.verify,getSession:async()=>({data:{session:{access_token:'test'}}}),setSession:async()=>({error:null})}}}));
vi.mock('@/shared/ui',()=>({BrandLogo:()=>null,FormInput:({label,...props})=><label>{label}<input {...props}/></label>}));
import AccountSetup from '@/features/auth/components/AccountSetup';
afterEach(()=>{cleanup();vi.clearAllMocks();mocks.passwordSet=false;});
describe('account setup screen',()=>{
 it('does not send mismatching passwords',async()=>{
  render(<AccountSetup/>);
  fireEvent.change(screen.getByLabelText('MuntiCares password'),{target:{value:'password1'}});
  fireEvent.change(screen.getByLabelText('Confirm password'),{target:{value:'password2'}});
  fireEvent.click(screen.getByRole('button',{name:'Save password and send code'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Passwords do not match');
  expect(mocks.invoke).not.toHaveBeenCalled();
 });
 it('offers resend if password succeeds but sending fails',async()=>{
  mocks.invoke.mockResolvedValueOnce({data:{ok:true}}).mockResolvedValueOnce({data:{error:'Wait and retry'}});
  render(<AccountSetup/>);
  fireEvent.change(screen.getByLabelText('MuntiCares password'),{target:{value:'password1'}});
  fireEvent.change(screen.getByLabelText('Confirm password'),{target:{value:'password1'}});
  fireEvent.click(screen.getByRole('button',{name:'Save password and send code'}));
  expect(await screen.findByRole('heading',{name:'Verify your email'})).toBeInTheDocument();
  expect(screen.queryByLabelText('Verification code')).not.toBeInTheDocument();
  expect(await screen.findByRole('alert')).toHaveTextContent('Wait and retry');
  expect(screen.getByRole('button',{name:'Send verification code'})).toBeEnabled();
 });
 it('keeps signup verification pending when code is invalid',async()=>{
  mocks.verify.mockResolvedValue({error:{message:'bad code'}});
  const done=vi.fn();render(<AccountSetup signupEmail="person@gmail.com" onVerified={done}/>);
  fireEvent.change(screen.getByLabelText('Verification code'),{target:{value:'123456'}});
  fireEvent.click(screen.getByRole('button',{name:'Verify email and continue'}));
  await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('Invalid or expired'));
  expect(done).not.toHaveBeenCalled();expect(mocks.refresh).not.toHaveBeenCalled();
 });
 it('offers sign-in recovery after a 401 instead of repeated send attempts',async()=>{
  mocks.invoke.mockResolvedValueOnce({data:{ok:true}}).mockResolvedValueOnce({error:{context:{status:401}}});
  render(<AccountSetup/>);
  fireEvent.change(screen.getByLabelText('MuntiCares password'),{target:{value:'password1'}});
  fireEvent.change(screen.getByLabelText('Confirm password'),{target:{value:'password1'}});
  fireEvent.click(screen.getByRole('button',{name:'Save password and send code'}));
  expect(await screen.findByRole('button',{name:'Sign in again'})).toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'Send verification code'})).not.toBeInTheDocument();
 });

 it('resumes at email verification when the server says a password already exists',()=>{
  mocks.passwordSet=true;render(<AccountSetup/>);
  expect(screen.getByRole('button',{name:'Send verification code'})).toBeInTheDocument();
  expect(screen.queryByLabelText('MuntiCares password')).not.toBeInTheDocument();
 });

});
