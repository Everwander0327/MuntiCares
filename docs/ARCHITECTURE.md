# Architecture

MuntiCares is a web-only React SPA. Supabase provides Auth, Postgres/RLS, Storage, Realtime and Edge Functions. Vercel serves the frontend. No Android APK or Capacitor runtime is shipped.

Browser push uses `web-push`, a push-only service worker and VAPID. Database triggers queue calls, messages and request/status changes. A private dispatcher sends generic notifications to browser-owned subscriptions; cron retries transient failures. Registration verifies the signed-in Supabase user. Logout removes browser subscriptions and clears worker account ownership.

WebRTC signaling uses private Realtime channels, with TURN credentials from `ice-servers`. Calls remain explicit Accept/Decline actions. GPS uses browser geolocation while the page is active; it cannot guarantee background tracking.

See [push deployment and verification](backend/web-push.md).
