# MuntiCares

MuntiCares is a barangay home-care platform for Muntinlupa City. Patients book verified home-care providers, track provider visits live on a map, chat with their care team, and hold WebRTC voice/video teleconsultations. Providers manage service requests, schedules, and live visit tracking, while administrators oversee patients, providers, requests, and announcements. Built as a capstone project.

## Features

- **Role-based portals** — patient, provider, and admin dashboards with server-side (RLS) access control.
- **Registration & onboarding** — email/password sign-up with privacy consent, plus a 5-step patient onboarding wizard (profile, medical details, home-pin map picker) with draft persistence.
- **Service requests** — full lifecycle (Pending → Accepted → On The Way → Arrived → Completed) with rescheduling/cancellation, schedule slot exclusivity, and status-transition guards.
- **Live visit tracking** — provider GPS sessions with heartbeat, server-side expiry, geofenced arrival, and a patient-facing live map (MapLibre) with OSRM routing/ETA.
- **Chat & media** — realtime messaging with typing/presence, photo/video attachments in a private storage bucket served via signed URLs, and 24-hour message retention enforced by a scheduled job.
- **WebRTC teleconsultation** — native peer connections with per-call TURN credentials, FCM push ring on Android, and append-only call telemetry (`call_events`).
- **Consent management** — deny-by-default access with mandatory expiry; providers only see patient data the patient has granted.
- **Admin oversight** — patient/provider directories, provider trust-score approval, request monitoring, announcements.
- **FHIR export** — patient records exportable in FHIR format.
- **Android app** — the same app bundled via Capacitor 8 with push notifications, background geolocation, and local notifications.

## Tech stack

- **Frontend**: React 18, Vite 5, react-router-dom 7, Tailwind CSS 3, framer-motion, react-hook-form + zod, Radix UI, recharts
- **Maps**: MapLibre GL, Leaflet, OSRM routing
- **Backend**: Supabase — Auth, Postgres + RLS, Storage (private buckets), Realtime, Edge Functions (`call-invite`, `ice-servers`), pg_cron
- **Mobile**: Capacitor 8 (Android, FCM push)
- **Hosting**: Vercel (SPA), GitHub Actions CI
- **Testing**: Vitest + Testing Library (unit), Playwright (E2E)

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the system design.

## Prerequisites

- Node.js 22 (matches CI)
- npm
- Google Chrome (Playwright E2E uses `channel: 'chrome'`)
- Optional: Supabase CLI for local backend work

## Setup

```bash
npm ci --legacy-peer-deps
cp .env.example .env.local   # then fill in real values
npm run dev
```

WebRTC and camera features require a secure context. For local HTTPS:

```bash
npm run dev:https   # sets VITE_HTTPS=true
```

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | yes | Supabase anon (public) key |
| `VITE_OSRM_URL` | no | OSRM routing server (default `https://router.project-osrm.org`) |
| `VITE_TRAFFIC_FACTOR` | no | Travel-time compensation factor (default `1.3`) |
| `VITE_TURN_URL` / `VITE_TURN_USERNAME` / `VITE_TURN_CREDENTIAL` | no | Static TURN for local dev only. Never set these in production: production TURN credentials are minted per call by the `ice-servers` edge function. |
| `VITE_HTTPS` | no | Set by `npm run dev:https` |
| `VITE_SITE_URL` | no | Canonical production URL used for `<link rel="canonical">`, Open Graph, `robots.txt`, and `sitemap.xml` (default `https://munti-cares.vercel.app`) |
| `VITE_GOOGLE_SITE_VERIFICATION` | no | Google Search Console HTML-tag verification token injected into `index.html` at build time |

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run dev:https` | Dev server with self-signed HTTPS |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the production build |
| `npm run lint` | ESLint; CI gate is 0 errors and max 15 warnings |
| `npm test` | Vitest unit tests (74 tests) |
| `npm run test:e2e` | Playwright E2E suite (see below) |
| `npm run qa:design` | Design-QA visual capture (see `.design-qa/`) |
| `npm run qa:design:gate` | Design-QA gate check |

## Testing

**Unit tests** run offline and are the CI gate:

```bash
npm test
```

**E2E tests** (Playwright, in `tests/`) require the dev server running at `http://localhost:5173` plus real credentials for a Supabase project. They are intentionally excluded from CI. Each suite skips (or fails fast) without its env vars:

| Spec | Covers | Env vars required |
|---|---|---|
| `auth-rls-integrity.spec.js` | Landing page, unauthenticated redirects, role journeys | `E2E_PATIENT_PASSWORD`, `E2E_PROVIDER_PASSWORD`, `E2E_ADMIN_PASSWORD` |
| `rls-api-integrity.spec.js` | RLS enforcement via direct API access | `E2E_SUPABASE_URL`, `E2E_SUPABASE_ANON_KEY`, the three `E2E_*_PASSWORD`s, and account emails matching the target project |
| `live-tracking.spec.js` | GPS tracking flow, patient tracker, arrival | `E2E_SUPABASE_URL`, `E2E_SUPABASE_ANON_KEY`, `E2E_PROVIDER_*`, `E2E_PATIENT_*` |
| `webrtc-call.spec.js` | Real P2P video/voice calls over Realtime | `E2E_SUPABASE_URL`, `E2E_SUPABASE_ANON_KEY`, `E2E_PROVIDER_*`, `E2E_PATIENT_*` — plus two real accounts (one provider, one patient) in the target project, live Realtime, and a deployed `ice-servers` function for video across networks |

The dev server's `VITE_SUPABASE_*` must point at the same project as the E2E credentials.

**SQL verification tests** (`tests/sql/`) are transactional DO-block scripts run manually in the Supabase SQL Editor: `verification_tests.sql` (RLS privilege checks) and `migration_state_verification.sql` (confirms migration effects on production).

## Database migrations

Migrations live in `supabase/migrations/`. Production is migrated **manually by the owner**, one file at a time through the Supabase SQL Editor — remote migration history has diverged from local, so **never run `supabase db push`**.

Four older migration files have no recorded history in the remote migration log (their effects were applied out-of-band): `20261024000000_tracking_v2.sql`, `20261025140000_tracking_v2_security_fix.sql`, `20261027000000_remove_payment_and_money.sql`, `20261029154000_fix_handle_new_auth_user.sql`. Run `tests/sql/migration_state_verification.sql` in the SQL Editor to confirm their objects exist on production.

## Deployment

- **Web**: Vercel with the SPA rewrite in `vercel.json`. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Vercel project.
- **SEO & domain**: The official domain defaults to `https://munti-cares.vercel.app` (configured in `src/lib/seo/seoConfig.js` and overridden via `VITE_SITE_URL`). `robots.txt` and `sitemap.xml` are generated into `dist/` at build time. To verify in Google Search Console, choose the HTML tag method, set the token as `VITE_GOOGLE_SITE_VERIFICATION` in Vercel, redeploy, and submit `https://munti-cares.vercel.app/sitemap.xml`. To switch to a custom domain later, attach the domain in Vercel, update `VITE_SITE_URL` (plus Supabase Auth `site_url` / redirect URLs), and redeploy.
- **CI**: GitHub Actions runs `lint` → `test` → `build` on push to `main`/`develop` and PRs to `main`, using repository variables for the Supabase env vars.
- **Android**: `npm run build` then `npx cap sync android`, open `android/` in Android Studio. FCM push requires `google-services.json` (gitignored) — without it push notifications are silently disabled.

## Known limitations

- E2E suites need live credentials and are not part of CI.
- No static type checking — this is a JavaScript project (`jsconfig.json` has `checkJs: false`).
- WebRTC falls back to STUN-only when the `ice-servers` edge function is not deployed, which can fail across restrictive NATs.
- Web push is not implemented: call ring notifications reach Android devices via FCM, and web users only while a subscribed tab is open.
- There is no seed file for local database bootstrap; local dev relies on the production schema via migrations.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Design system](DESIGN.md)
- Design-QA process: `.design-qa/`
