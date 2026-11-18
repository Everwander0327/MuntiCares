import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { setupAction, verifySignupCode } from '@/lib/accountSetup';
import { FormInput, BrandLogo } from '@/shared/ui';

export default function AccountSetup({ signupEmail, onVerified, onBack }) {
  const { user, refreshUser, logout } = useAuth();
  const isSignup = Boolean(signupEmail);
  const email = signupEmail || user?.email;
  const [step, setStep] = useState(isSignup ? 'code' : 'password');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(isSignup);
  const [cooldown, setCooldown] = useState(isSignup ? 60 : 0);
  useEffect(() => {
    if (!cooldown) return undefined;
    const timer = setTimeout(() => setCooldown(value => Math.max(0,value-1)),1000);
    return () => clearTimeout(timer);
  },[cooldown]);
  async function send() {
    if (cooldown || busy) return;
    setBusy(true); setError('');
    try {
      if (isSignup) {
        const { error: resendError } = await supabase.auth.resend({ type: 'signup', email });
        if (resendError) throw new Error('Unable to send a code right now. Please wait and retry.');
      } else await setupAction(supabase,'send');
      setSent(true); setCooldown(60);
    } catch(err) {setError(err.message);} finally {setBusy(false);}
  }
  async function submit(event) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      if (step === 'password') {
        if (password.length<8 || password.length>128) throw new Error('Use a password between 8 and 128 characters.');
        if (password!==confirm) throw new Error('Passwords do not match.');
        await setupAction(supabase,'password',{password});
        setPassword(''); setConfirm(''); setStep('code');
        try { await setupAction(supabase,'send'); setSent(true); setCooldown(60); }
        catch(err) { setError(err.message); }
      } else {
        if (!/^\d{6}$/.test(code)) throw new Error('Enter the 6-digit code from your email.');
        if (isSignup) await verifySignupCode(supabase.auth,email,code);
        else await setupAction(supabase,'verify',{code});
        await refreshUser();
        onVerified?.();
      }
    } catch(err) {setError(err.message);} finally {setBusy(false);}
  }
  return <div className="min-h-[calc(100dvh-4rem)] bg-surface-page flex items-center justify-center px-4 py-8">
    <section className="neu-flat w-full max-w-md rounded-3xl p-6 sm:p-8 space-y-5">
      <BrandLogo className="h-10 w-10" decorative />
      <div><p className="text-xs font-semibold text-link mb-2">{step==='password' ? 'Step 1 of 2' : 'Email verification'}</p>
        <h1 className="font-display text-2xl font-extrabold text-ink dark:text-txt-darkPrimary">{step==='password' ? 'Secure your account' : 'Check your inbox'}</h1>
        <p className="mt-2 text-sm text-tertiary leading-relaxed">{step==='password' ? 'Create a MuntiCares password so you can also sign in with your email.' : sent ? 'Enter the 6-digit code sent to your email. It expires in 10 minutes.' : 'Your password is saved. Send a code to verify your email.'}</p>
        <p className="mt-2 text-sm font-semibold text-ink dark:text-txt-darkPrimary break-all">{email}</p>
      </div>
      <form onSubmit={submit} className="space-y-4">
        {step==='password' ? <>
          <FormInput label="MuntiCares password" type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} minLength={8} maxLength={128} required disabled={busy} />
          <FormInput label="Confirm password" type="password" autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} required disabled={busy} />
        </> : <FormInput label="Verification code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} maxLength={6} required disabled={busy} />}
        {error && <p role="alert" className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{error}</p>}
        <button type="submit" disabled={busy || (step==='code' && !sent)} className="neu-btn-primary min-h-12 w-full rounded-xl px-4 py-3 text-sm font-bold disabled:opacity-60">{busy ? 'Please wait...' : step==='password' ? 'Save password and send code' : 'Verify email and continue'}</button>
      </form>
      {step==='code' && <button type="button" onClick={send} disabled={busy || cooldown>0} className="min-h-11 text-sm font-semibold text-link disabled:opacity-50">{cooldown ? `Resend code in ${cooldown}s` : sent ? 'Resend code' : 'Send verification code'}</button>}
      <div className="border-t border-surface-border pt-3"><button type="button" disabled={busy} className="min-h-11 text-sm text-tertiary" onClick={async()=>{ if(isSignup) onBack?.(); else await logout(); }}>{isSignup ? 'Use a different email' : 'Sign out'}</button></div>
    </section>
  </div>;
}
