import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { enableWebPush, clearPushToken, isWebPushSupported, webPushOwner, PUSH_STATE_EVENT } from '@/lib/pushNotifications';

export default function WebPushControl() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const fil = language === 'fil' || language === 'tl';
  const [enabled, setEnabled] = useState(() => webPushOwner() === user?.id && globalThis.Notification?.permission === 'granted');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const refresh = () => setEnabled(webPushOwner() === user?.id && globalThis.Notification?.permission === 'granted');
    window.addEventListener(PUSH_STATE_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => { window.removeEventListener(PUSH_STATE_EVENT, refresh); window.removeEventListener('storage', refresh); };
  }, [user?.id]);
  const supported = isWebPushSupported();
  const toggle = async () => {
    setBusy(true); setError('');
    try {
      if (enabled) await clearPushToken();
      else await enableWebPush(user.id);
      setEnabled(webPushOwner() === user.id);
    } catch (err) { setError(err.message || 'Unable to update notifications. Please retry.'); }
    finally { setBusy(false); }
  };
  return (
    <div className="px-4 sm:px-5 py-3 border-b border-surface-border/70 dark:border-white/10 text-sm">
      <p className="text-txt-secondary dark:text-txt-darkSecondary mb-2">
        {supported
          ? (fil ? 'Mga tawag, mensahe at booking update kahit sarado ang tab.' : 'Calls, messages and booking updates even with this tab closed.')
          : (fil ? 'Sa iPhone/iPad, idagdag muna sa Home Screen. Kung hindi, gumamit ng browser na may push support.' : 'On iPhone/iPad, add to Home Screen first. Otherwise, use a browser that supports push.')}
      </p>
      {supported && <button type="button" className="mc-link min-h-11" onClick={toggle} disabled={busy}>
        {busy ? (fil ? 'Sandali…' : 'Updating…') : enabled ? (fil ? 'I-off sa browser na ito' : 'Turn off on this browser') : (fil ? 'I-enable ang notifications' : 'Enable notifications')}
      </button>}
      {error && <p role="alert" className="text-danger mt-2">{error}</p>}
    </div>
  );
}
