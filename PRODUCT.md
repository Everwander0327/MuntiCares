# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary users:** Family caregivers and Muntinlupa City residents booking and coordinating in-home care for elderly or recovering relatives. Built as a capstone project engineered for real-world readiness.
- **Secondary users:**
  - **Home-care providers:** Verified local caregivers, nurses, therapists, and health workers managing schedules, accepting and fulfilling home visits, sharing live visit tracking, and conducting chats or teleconsultations.
  - **Platform administrators:** Moderators overseeing provider verification and trust-score approval, patient and provider directories, service request monitoring, and announcements.

## Product Purpose

MuntiCares coordinates trusted, non-emergency in-home care across Muntinlupa City. It makes it possible for households to discover verified local providers, book scheduled home visits, watch live arrival progress on a map, message or hold voice/video teleconsultations with their care team, and keep strict patient control over health information.

Success means families caring for elderly or recovering loved ones can arrange and follow home visits with confidence, providers can coordinate care reliably, and sensitive medical records remain private and strictly consented.

## Positioning

Hyper-local home-care coordination for all 9 barangays of Muntinlupa City (`Alabang`, `Ayala Alabang`, `Bayanan`, `Buli`, `Cupang`, `Poblacion`, `Putatan`, `Sucat`, `Tunasan`), differentiated from generic telehealth apps and informal local referrals by four combined mechanisms:

- **Hyper-local verified visits with live GPS tracking:** Verified Muntinlupa providers following an enforced request lifecycle (`Pending → Accepted → On The Way → Arrived → Completed`) with live GPS visit tracking, geofenced arrival, and OSRM-estimated arrival times.
- **Patient-owned privacy (RA 10173):** Deny-by-default expiring health-record consent scoped per provider and per health category, database-enforced row-level security, 24-hour automatic chat deletion, private signed-URL media, automatic GPS deletion after visit completion, and FHIR record export.
- **Zero-payment care coordination with integrated teleconsultation:** Coordinates visits alongside built-in WebRTC voice/video teleconsultations without collecting or storing payment data.
- **Bilingual and senior-friendly accessibility:** Full English (`en`) and Tagalog (`tl`) authenticated portals paired with user-scalable UI tiers and hyperlegible readability.

## Operating Context

- **Architecture & hosting:** Web-only React + Vite SPA deployed on Vercel (`https://munti-cares.vercel.app` default canonical URL, overridable via `VITE_SITE_URL`), backed by Supabase (Auth, Postgres + RLS, private Storage, Realtime, Edge Functions `call-invite` and `ice-servers`, and `pg_cron`).
- **Routes & portals:**
  - Public routes: `/` (landing), `/login`, `/register`, `/reset-password`, `/privacy`, `/terms`.
  - Authenticated portals: `/patient/*`, `/provider/*`, `/admin/*`, plus patient/provider onboarding flows (`/patient/onboarding`, `/provider/onboarding`, and preview routes `/onboarding`, `/onboarding/provider`).
- **Scheduling & services:** Working hours `09:00–17:00` in 30-minute exclusive slots (`1` slot = 30 min, `2` slots = 60 min). Core service categories in code: General Consultation, Nursing Care, Physical Therapy, Wound Dressing, Elderly Care, Post-Operative Care, Vital Signs Monitoring, and Medication Administration (plus Companion Care featured on the public landing page).
- **Onboarding & live constraints:** Patients complete a 5-step onboarding wizard with draft persistence and a home-pin map picker. Providers require admin approval before accepting requests. Provider GPS tracking runs via browser geolocation while the page is active (no guaranteed background tracking); browser push uses Web Push/VAPID; WebRTC calls require explicit Accept/Decline and per-call TURN credentials from `ice-servers`.

## Capabilities and Constraints

- **Confirmed capabilities:** Role-based dashboards with RLS; verified provider directory; request booking, rescheduling, cancellation, and status-transition guards; MapLibre/Leaflet live tracking with OSRM ETA; realtime chat with typing/presence, 24-hour auto-deletion, and signed-URL photo/video attachments; WebRTC voice/video teleconsultations with append-only call telemetry; granular expiring consent management; FHIR record export; admin oversight and announcements; bilingual English/Tagalog authenticated portals.
- **Hard constraints (must preserve):**
  - **Independent project — no official LGU endorsement:** MuntiCares is not officially affiliated with or endorsed by the Muntinlupa City LGU, City Health Office, or barangay health centers. Never fabricate government endorsements, institutional seals, or official partnerships.
  - **No payments, pricing, or checkout flows:** Payment handling was intentionally removed; MuntiCares does not collect or store payment data. Never introduce pricing tables, payment methods, or checkout flows.
  - **Not an emergency service:** Never position MuntiCares as emergency medical dispatch; preserve clear 911 / local emergency hotline guidance for life-threatening cases.
  - **Web-only runtime:** No native iOS/Android APK or Capacitor wrapper is shipped; respect browser geolocation and HTTPS secure-context constraints.
  - **Privacy & retention (RA 10173):** Maintain deny-by-default expiring consent, 24-hour chat deletion, visit-scoped GPS deletion, and private signed-URL media.
  - **Bilingual & senior-readability continuity:** Preserve English/Tagalog (`en`/`tl`) coverage across all authenticated portals and keep WCAG AA contrast and multi-tier UI scaling intact.
  - **Manual production migrations:** Production Supabase migrations are run manually via the SQL Editor; never run `supabase db push`.
- **Explicitly undecided product facts:**
  - Whether public marketing and legal pages (`/`, `/privacy`, `/terms`) will later be localized into Tagalog (`tl`) alongside the authenticated portals.
  - Whether post-capstone operations will expand beyond Muntinlupa City's 9 barangays.

## Brand Commitments

- **Name:** MuntiCares (alternate recognized in structured data: `Munti Cares`).
- **Support contact:** `support@munticares.ph` (referenced in Privacy Policy and Terms of Service).
- **Identity mark:** House-heart-cross mark (`public/images/brand/logo-512.png`, `public/images/brand/og-image.png`, and inline SVG favicon in `index.html`).
- **Voice:** Calm, trustworthy, plain-spoken, and patient-first in both English and Tagalog — reassuring for family caregivers without overstating clinical or governmental authority.

## Evidence on Hand

- **On hand in repository:**
  - Brand assets: `public/images/brand/logo-512.png`, `public/images/brand/og-image.png`, `public/images/brand/hero-auth.jpg`.
  - Illustrative assets (confirmed non-documentary): `public/images/landing/*`, `public/images/carousel/*`, and `public/images/avatars/*` are illustrative photography/avatars — **not** real MuntiCares patients or providers, and must never be captioned or attributed as real customer portraits.
  - Working end-to-end application across Patient, Provider, and Admin flows, backed by Vitest unit tests (`npm test`) and Playwright E2E specs (`tests/`).
  - Published legal terms: `src/features/legal/PrivacyPolicy.jsx`, `src/features/legal/TermsOfService.jsx`.
- **Absences (do not fabricate):**
  - No real patient testimonials, user quotes, or review ratings.
  - No verified patient counts, active provider counts, completed visit totals, or response-time benchmarks.
  - No press mentions, third-party awards, clinical certifications, or official Muntinlupa LGU / hospital partnership logos.

## Product Principles

1. **Design for the family caregiver under pressure.** Households coordinating care for elderly or recovering relatives need immediate clarity on provider trustworthiness, booking status, and live arrival — across ages, literacy levels, and English/Tagalog.
2. **Earn trust through real mechanisms, never fabricated proof.** Ground every trust signal in what MuntiCares actually enforces (provider verification, live GPS tracking, RA 10173 expiring consent, explicit call accept/decline) — never invented testimonials, metrics, or LGU endorsements.
3. **Keep health and location data strictly scoped and ephemeral.** Preserve deny-by-default expiring consent, visit-only GPS tracking, and 24-hour chat expiry as clear, user-visible protections.
4. **Protect accessibility and bilingual parity as core product features.** Maintain WCAG AA readability, multi-tier UI scaling, and English/Tagalog parity across portal workflows so senior and family users are never left behind.
5. **Stay honest about local scope and coordination boundaries.** Anchor every workflow in Muntinlupa's 9 barangays, non-emergency home care, and zero-payment simplicity.

## Accessibility & Inclusion

- **Confirmed requirement:** Preserve WCAG AA readability (≥4.5:1 text contrast), senior/low-vision friendliness, and bilingual English (`en`) / Tagalog (`tl`) support across all authenticated portals.
- **Established mechanisms in code:** 4-level user-selectable UI scaling (`extra-compact`, `compact`, `standard`, `large`), reduced-motion support (`MotionConfig reducedMotion="user"`), hyperlegible reading typography, and high-contrast status separation.
