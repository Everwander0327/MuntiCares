import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({passwordSet:false,roleSelected:true,refresh:vi.fn(async()=>({})),invoke:vi.fn(),verify:vi.fn(),logout:vi.fn()}));
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({user:{id:'a',email:'person@gmail.com',setup_password_set:mocks.passwordSet,setup_role_selected:mocks.roleSelected},refreshUser:mocks.refresh,logout:mocks.logout})}));
vi.mock('@/lib/supabase',()=>({supabase:{functions:{invoke:mocks.invoke},auth:{verifyOtp:mocks.verify,getSession:async()=>({data:{session:{access_token:'test'}}}),setSession:async()=>({error:null})}}}));
vi.mock('@/shared/ui',()=>({BrandLogo:()=>null,FormInput:({label,rightElement,...props})=><div><label>{label}<input {...props}/></label>{rightElement}</div>}));
import AccountSetup from '@/features/auth/components/AccountSetup';
afterEach(()=>{cleanup();vi.clearAllMocks();mocks.passwordSet=false;mocks.roleSelected=true;});
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
  fireEvent.click(screen.getByRole('button',{name:/^Patient/}));
  fireEvent.click(screen.getByRole('button',{name:'Continue'}));
  await screen.findByLabelText('Verification code');
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

 it('asks a new Google user to choose a role before password creation',async()=>{
  mocks.roleSelected=false;mocks.invoke.mockResolvedValue({data:{ok:true}});
  render(<AccountSetup/>);
  expect(screen.queryByLabelText('MuntiCares password')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:/^Provider/}));
  fireEvent.click(screen.getByRole('button',{name:'Continue'}));
  expect(await screen.findByLabelText('MuntiCares password')).toBeInTheDocument();
  expect(mocks.invoke).toHaveBeenCalledWith('account-setup',expect.objectContaining({body:{action:'role',role:'provider'}}));
 });
 it('toggles each password independently without clearing the value',()=>{
  render(<AccountSetup/>);
  const password=screen.getByLabelText('MuntiCares password');
  fireEvent.change(password,{target:{value:'my-password'}});
  fireEvent.click(screen.getByRole('button',{name:'Show password'}));
  expect(password).toHaveAttribute('type','text');expect(password).toHaveValue('my-password');
  expect(screen.getByLabelText('Confirm password')).toHaveAttribute('type','password');
  fireEvent.click(screen.getByRole('button',{name:'Hide password'}));
  expect(password).toHaveAttribute('type','password');
 });

});
