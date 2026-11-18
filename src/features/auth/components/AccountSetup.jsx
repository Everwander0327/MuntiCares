import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { setupAction, verifySignupCode } from '@/lib/accountSetup';
import { EnvelopeSimple, CheckCircle, ArrowRight, ShieldCheck, Eye, EyeSlash, Heart, FirstAidKit } from '@phosphor-icons/react';
import { FormInput, BrandLogo } from '@/shared/ui';

export default function AccountSetup({ signupEmail, onVerified, onBack, embedded = false }) {
  const { user, refreshUser, logout } = useAuth();
  const isSignup = Boolean(signupEmail);
  const email = signupEmail || user?.email;
  const [step, setStep] = useState(user?.setup_role_selected === false || isSignup ? 'role' : user?.setup_password_set ? 'code' : 'password');
  const [signupVerified, setSignupVerified] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const peek = (visible, toggle, label) => <button type="button" className="flex h-11 w-11 items-center justify-center rounded-lg text-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={toggle} aria-label={`${visible ? 'Hide' : 'Show'} ${label}`} aria-pressed={visible}>{visible ? <EyeSlash className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}</button>;
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sessionExpired, setSessionExpired] = useState(false);
  const handleError = (err) => { setError(err.message); if (err.code === 'setup_session_expired') setSessionExpired(true); };
  const recover = async () => { await supabase.auth.signOut({ scope: 'local' }); window.location.assign('/login'); };
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
    } catch(err) {handleError(err);} finally {setBusy(false);}
  }
  async function submit(event) {
    event.preventDefault();
    if (step === 'code' && !sent) { await send(); return; }
    setError(''); setBusy(true);
    try {
      if (step === 'role') {
        if (!selectedRole) throw new Error('Choose Patient or Provider to continue.');
        if (!isSignup) { await setupAction(supabase,'role',{role:selectedRole}); await refreshUser(); }
        setStep(isSignup || user?.setup_password_set ? 'code' : 'password');
      } else if (step === 'password') {
        if (password.length<8 || password.length>128) throw new Error('Use a password between 8 and 128 characters.');
        if (password!==confirm) throw new Error('Passwords do not match.');
        await setupAction(supabase,'password',{password});
        setPassword(''); setConfirm(''); setStep('code');
        try { await setupAction(supabase,'send'); setSent(true); setCooldown(60); }
        catch(err) { handleError(err); }
      } else {
        if (!/^\d{6}$/.test(code)) throw new Error('Enter the 6-digit code from your email.');
        if (isSignup) {
          if (!signupVerified) { await verifySignupCode(supabase.auth,email,code); setSignupVerified(true); }
          if (selectedRole) await setupAction(supabase,'role',{role:selectedRole});
        }
        else await setupAction(supabase,'verify',{code});
        await refreshUser();
        onVerified?.();
      }
    } catch(err) {handleError(err);} finally {setBusy(false);}
  }
  return <div className={embedded ? 'w-full' : 'min-h-[calc(100dvh-4rem)] bg-surface-page flex items-center justify-center px-4 py-8 sm:py-12'}>
    <section className="w-full max-w-[440px] rounded-3xl border border-surface-border bg-surface-shell p-6 sm:p-8 shadow-sm">
      <div className="flex items-center justify-between mb-7">
        <BrandLogo className="h-10 w-10" decorative />
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-tertiary"><ShieldCheck className="h-4 w-4" aria-hidden="true" />Account setup</span>
      </div>
      {!isSignup && <div className="flex items-center gap-2 mb-6" aria-label={step==='role' ? 'Choose your account type' : step==='password' ? 'Set your password' : 'Verify your email'}>
        <span className="h-1 flex-1 rounded-full bg-primary" />
        <span className={`h-1 flex-1 rounded-full ${step==='code' ? 'bg-primary' : 'bg-surface-border'}`} />
      </div>}
      <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink dark:text-txt-darkPrimary">{sessionExpired ? 'Let’s reconnect' : step==='role' ? 'How will you use MuntiCares?' : step==='password' ? 'Secure your account' : sent ? 'Check your inbox' : 'Verify your email'}</h1>
      <p className="mt-2 text-sm text-tertiary leading-relaxed">{sessionExpired ? 'Sign in again to continue. Your saved password is ready to use.' : step==='role' ? 'Choose the account that matches how you will use our care services.' : step==='password' ? 'Create a MuntiCares password to use alongside Google sign-in.' : sent ? 'We sent a 6-digit code to the email below. Enter it to finish setup.' : 'Your password is saved. Send a verification code to finish setting up your account.'}</p>
      <div className="mt-5 mb-6 flex items-center gap-3 rounded-xl border border-surface-border bg-surface-subtle px-3.5 py-3">
        <EnvelopeSimple className="h-5 w-5 shrink-0 text-link" aria-hidden="true" />
        <span className="min-w-0 break-all text-sm font-semibold text-ink dark:text-txt-darkPrimary">{email}</span>
        {step==='code' && !sessionExpired && <CheckCircle className="ml-auto h-4 w-4 shrink-0 text-success" aria-label="Password saved" />}
      </div>
      <form onSubmit={submit} className="space-y-4">
        {!sessionExpired && (step==='role' ? <div className="space-y-3" role="group" aria-label="Account type">
          {[{value:'patient',label:'Patient',description:'Find care for yourself or a family member.',Icon:Heart},{value:'provider',label:'Provider',description:'Offer care services. Professional verification is required.',Icon:FirstAidKit}].map(({value,label,description,Icon})=><button type="button" key={value} disabled={busy} aria-pressed={selectedRole===value} onClick={()=>{setSelectedRole(value);setError('');}} className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors ${selectedRole===value ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-surface-border bg-surface-page hover:border-primary/40'}`}><Icon className="h-6 w-6 shrink-0 text-link" aria-hidden="true"/><span><span className="block text-sm font-bold text-ink dark:text-txt-darkPrimary">{label}</span><span className="mt-1 block text-xs leading-relaxed text-tertiary">{description}</span></span></button>)}
        </div> : step==='password' ? <>
          <FormInput label="MuntiCares password" type={showPassword ? 'text' : 'password'} rightElement={peek(showPassword,()=>setShowPassword(value=>!value),'password')} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} minLength={8} maxLength={128} required disabled={busy} />
          <FormInput label="Confirm password" type={showConfirm ? 'text' : 'password'} rightElement={peek(showConfirm,()=>setShowConfirm(value=>!value),'confirm password')} autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} required disabled={busy} />
          <p className="text-xs text-tertiary">Use at least 8 characters.</p>
        </> : sent ? <div>
          <label htmlFor="setup-code" className="block text-sm font-semibold text-ink dark:text-txt-darkPrimary mb-2">Verification code</label>
          <input id="setup-code" className="w-full h-14 rounded-xl border border-surface-border bg-surface-page px-4 text-center font-mono text-2xl tracking-[0.4em] text-ink dark:text-txt-darkPrimary focus:outline-none focus:ring-2 focus:ring-primary placeholder:tracking-[0.4em]" placeholder="000000" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} maxLength={6} required disabled={busy} aria-describedby="setup-code-help" />
          <p id="setup-code-help" className="mt-2 text-xs text-tertiary">Valid for 10 minutes. Check spam if it hasn’t arrived.</p>
        </div> : null)}
        {error && <p role="alert" className="rounded-xl bg-danger/10 px-3.5 py-3 text-sm leading-relaxed text-danger">{error}</p>}
        {sessionExpired ? <button type="button" onClick={recover} className="neu-btn-primary min-h-12 w-full rounded-xl px-4 py-3 text-sm font-bold">Sign in again</button> : <button type="submit" disabled={busy || (step==='role' && !selectedRole) || (step==='code' && sent && code.length!==6)} className="neu-btn-primary flex items-center justify-center gap-2 min-h-12 w-full rounded-xl px-4 py-3 text-sm font-bold disabled:opacity-60">{busy ? 'Please wait...' : step==='role' ? 'Continue' : step==='password' ? 'Save password and send code' : sent ? 'Verify email and continue' : 'Send verification code'}{!busy && <ArrowRight className="h-4 w-4" aria-hidden="true" />}</button>}
      </form>
      {step==='code' && sent && !sessionExpired && <div className="mt-4 text-center"><button type="button" onClick={send} disabled={busy || cooldown>0} className="min-h-11 text-sm font-semibold text-link disabled:text-tertiary">{cooldown ? `Resend code in ${cooldown}s` : 'Resend code'}</button></div>}
      {!sessionExpired && <div className="mt-5 border-t border-surface-border pt-3 text-center"><button type="button" disabled={busy} className="min-h-11 text-sm font-medium text-tertiary" onClick={async()=>{ if(isSignup) onBack?.(); else await logout(); }}>{isSignup ? 'Use a different email' : 'Sign out'}</button></div>}
    </section>
  </div>;
}
