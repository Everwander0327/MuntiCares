# Web-only MuntiCares and browser push

Approved in chat on 2026-11-18: MuntiCares is web-only. Remove the Android project, APKs and Capacitor. Provide browser push for incoming calls, messages, booking changes and provider visit status.

## Approach
Firebase web messaging would reuse the former Android sender but adds a Firebase integration. The user selected Supabase plus standard Web Push/VAPID instead. Supabase remains the identity, storage and server runtime; browsers use their built-in push services. No Firebase SDK or Firebase project integration is needed.

## Behavior and constraints
Users explicitly enable notifications from the notification panel. Store subscriptions per authenticated account with RLS; remove the browser subscription on logout. A service worker shows generic previews and opens the relevant authenticated portal on click. Never auto-answer calls or expose message/medical contents in push previews. Server-side database events initiate delivery even without an open tab. Expired subscriptions are removed; transient failures retry with bounded retention. No notification permission prompt on page load.

Web push depends on browser/OS support and permission. iPhone/iPad users need a supported Home Screen web app. Web location tracking remains foreground-only; do not promise background GPS. Preserve existing in-app notifications, calling and browser location behavior.

## Implementation decisions
Use an authenticated subscription endpoint, a private delivery queue populated by database triggers, and a Supabase Edge Function using VAPID. Database scheduling retries transient delivery failures. Add a minimal web manifest; do not introduce offline caching of health data. Preserve historical migrations; stop shipping Android code and artifacts. Validate frontend and backend logic and report deployment/device verification separately.
