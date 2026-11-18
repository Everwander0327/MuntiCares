# Browser push

Web-only: no Android APK or Capacitor runtime. Enable notifications in the signed-in notification bell. HTTPS and browser notification permission are required. iPhone/iPad users need a supported Home Screen web app. Background GPS is not supported.

Supabase `web-push` handles authenticated subscription registration and private dispatch. It validates JWTs itself; dispatch uses a separate server secret. VAPID secrets live in Edge Function secrets, and the dispatch secret is mirrored in Vault. Never commit private keys. Database triggers on messages, calls and requests enqueue generic recipient notifications. pg_net dispatches immediately after commit; cron retries every minute, up to five attempts. Expired calls are discarded. Logout clears the worker owner and unsubscribes the browser.

The worker caches only an account identifier, never health records. No offline page cache is installed. Push previews contain no names, message contents or clinical details. The browser vendor still supplies its built-in push transport; no Firebase SDK or Firebase project integration is used.

Deploy migration and Edge Function before deploying frontend. Validate on a real device with an opted-in account: close the tab, send a message, update a booking and place a call; tap notifications and verify login/role routing. Deny permission and sign out to verify in-app fallback and subscription removal.
