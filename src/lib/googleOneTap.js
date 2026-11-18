let scriptPromise;
export function loadGoogleIdentity() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  if (!scriptPromise) scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    const timer = setTimeout(() => { script.remove(); scriptPromise = undefined; reject(new Error('Google prompt unavailable')); }, 12000);
    script.onload = () => { clearTimeout(timer); resolve(window.google.accounts.id); };
    script.onerror = () => { clearTimeout(timer); script.remove(); scriptPromise = undefined; reject(new Error('Google prompt unavailable')); };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

// Google Identity Services is global to the document, not to a React component.
// Keep initialization and the browser prompt single-flight across remounts.
const sessions = new WeakMap();
export async function prepareOneTap(options) {
  const { google, clientId, isActive, cryptoApi = globalThis.crypto } = options;
  if (!isActive()) return;
  let state = sessions.get(google);
  if (!state) {
    state = { current: options, prompted: false, exchanging: false };
    sessions.set(google, state);
    state.ready = (async () => {
      const nonce = Array.from(cryptoApi.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
      const digest = await cryptoApi.subtle.digest('SHA-256', new TextEncoder().encode(nonce));
      const hashed = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
      // StrictMode may retire the first effect while the nonce is being hashed.
      if (!state.current.isActive()) return false;
      google.initialize({
        client_id: clientId, nonce: hashed, auto_select: false,
        callback: async ({ credential }) => {
          const current = state.current;
          if (!current.isActive() || state.exchanging || !credential) return;
          state.exchanging = true; current.onBusy(true);
          try {
            const { error } = await current.auth.signInWithIdToken({ provider: 'google', token: credential, nonce });
            if (error) throw error;
          } catch {
            if (current.isActive()) current.onError('Google sign-in could not be completed. Try the Google button below.');
          } finally { state.exchanging = false; current.onBusy(false); }
        },
      });
      return true;
    })();
  } else {
    state.current = options;
  }
  const initialized = await state.ready;
  if (!initialized) { if (sessions.get(google) === state) sessions.delete(google); return; }
  if (isActive() && !state.prompted) {
    state.prompted = true;
    google.prompt();
  }
}
