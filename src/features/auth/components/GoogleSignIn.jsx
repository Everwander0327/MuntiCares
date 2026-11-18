import { GOOGLE_CLIENT_ID } from '@/lib/googleClientId';
import { loadGoogleIdentity, prepareOneTap } from '@/lib/googleOneTap';
import { useEffect, useId, useRef, useState } from 'react';
import { CircleNotch } from '@phosphor-icons/react';
import { supabase } from '@/lib/supabase';
import { startGoogleSignIn } from '@/lib/googleAuth';

export default function GoogleSignIn({ disabled = false, privacyAccepted }) {
  const consentId = useId();
  const errorId = useId();
  const [accepted, setAccepted] = useState(false);
  const sharedConsent = typeof privacyAccepted === 'boolean';
  const hasConsent = sharedConsent ? privacyAccepted : accepted;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const activeRef = useRef(false);
  useEffect(() => {
    activeRef.current = hasConsent && !disabled;
    if (!activeRef.current) return undefined;
    let disposed = false;
    let identity;
    const isActive = () => !disposed && activeRef.current;
    (async () => {
      try {
        identity = await loadGoogleIdentity();
        if (!isActive()) return;
        await prepareOneTap({ google: identity, auth: supabase.auth, clientId: GOOGLE_CLIENT_ID,
          isActive, onBusy: (value) => { if (isActive()) setBusy(value); }, onError: setError });
      } catch { /* Browser prompt unavailable: the OAuth button remains available. */ }
    })();
    return () => { disposed = true; activeRef.current = false; if (identity && window.google?.accounts?.id === identity) identity.cancel(); };
  }, [hasConsent, disabled]);
  async function start() {
    activeRef.current = false;
    window.google?.accounts?.id?.cancel();
    setError(''); setBusy(true);
    try { await startGoogleSignIn(supabase.auth, { accepted: hasConsent, origin: window.location.origin }); }
    catch (err) { setError(err.message || 'Unable to sign in with Google.'); setBusy(false); }
  }
  return (
    <div className="mt-5 space-y-4">
      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-surface-border" />
        <span className="text-xs font-medium text-tertiary">or continue with</span>
        <span className="h-px flex-1 bg-surface-border" />
      </div>

      <button
        type="button"
        onClick={start}
        disabled={busy || disabled}
        aria-describedby={error ? errorId : sharedConsent ? 'register-privacy' : consentId}
        aria-busy={busy}
        className="group flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-surface-border bg-surface-shell px-4 py-3 text-sm font-semibold text-txt-primary dark:text-txt-darkPrimary shadow-sm transition duration-200 hover:border-primary/40 hover:bg-primary/5 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 motion-reduce:transform-none motion-reduce:transition-none"
      >
        {busy ? <CircleNotch className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : (
          <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z" />
            <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22Z" />
            <path fill="#FBBC05" d="M6.41 13.92a6 6 0 0 1 0-3.84V7.49H3.07a10 10 0 0 0 0 9.02l3.34-2.59Z" />
            <path fill="#EA4335" d="M12 5.96c1.47 0 2.79.51 3.82 1.51l2.86-2.86A9.59 9.59 0 0 0 12 2a10 10 0 0 0-8.93 5.49l3.34 2.59C7.2 7.72 9.4 5.96 12 5.96Z" />
          </svg>
        )}
        <span>{busy ? 'Connecting to Google…' : 'Continue with Google'}</span>
      </button>

      {!sharedConsent && <label id={consentId} className="flex cursor-pointer items-start gap-2.5 rounded-lg text-xs leading-relaxed text-txt-secondary dark:text-txt-darkSecondary">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-surface-border accent-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          checked={accepted}
          onChange={(event) => { setAccepted(event.target.checked); setError(''); }}
          disabled={busy || disabled}
        />
        <span>I agree to the <a href="/privacy" target="_blank" rel="noreferrer" className="font-medium text-link underline decoration-current/40 underline-offset-2 hover:decoration-current">Privacy Notice</a> and <a href="/terms" target="_blank" rel="noreferrer" className="font-medium text-link underline decoration-current/40 underline-offset-2 hover:decoration-current">Terms of Service</a> for Google sign-in.</span>
      </label>}
      {error && <p id={errorId} role="alert" className="rounded-lg bg-danger/10 px-3 py-2.5 text-xs leading-relaxed text-danger dark:text-danger-dark">{error}</p>}
    </div>
  );
}
