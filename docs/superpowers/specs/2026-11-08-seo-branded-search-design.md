# SEO: Branded Search ("munticares") — Design

Date: 2026-11-08 · Size: small change

## Intent
When someone searches "munticares" on Google, MuntiCares should show up as a clean,
correct first result: right name, right URL, public pages only.

## Current state (verified)
- Vercel project `munti-cares` (account `everwander0327`) serves production at
  `https://munti-cares-alpha.vercel.app`. No custom domains are attached.
- `index.html` (`og:url`, JSON-LD `url`) and `public/robots.txt` (`Sitemap:`) point to
  `https://munti-cares.vercel.app`, which returns **404**. Google is being told the
  official site is a dead address.
- `/sitemap.xml` does not exist; the SPA rewrite in `vercel.json` serves `index.html` for it.
- Every route shares one `<title>`/description; no canonical; no `og:image`;
  auth and dashboard routes are not `noindex`.
- Client-rendered SPA. Google renders JS, so per-route tags set at runtime are read by Google.

## Goals
- One correct canonical domain used everywhere.
- Valid `sitemap.xml` + `robots.txt`.
- Google understands the site name is "MuntiCares" (WebSite + Organization JSON-LD, logo).
- Per-page title/description/canonical on public pages (`/`, `/privacy`, `/terms`).
- `noindex` on `/login`, `/register`, `/reset-password`, `/onboarding`, and all
  `/patient`, `/provider`, `/admin` routes.
- Share image (`og:image`, `twitter:image`).
- Hook for the Google Search Console verification code.

## Non-goals
- Pre-rendering / SSR (Approach B), custom domain purchase (Approach C).
- Ranking for generic terms like "home care Muntinlupa".
- Any Supabase change.

## Anti-goals
- Changing visible UI, landing animations, or auth behavior.
- Adding a heavy dependency (e.g. react-helmet) for what a small hook can do.

## Approaches
- **A. Fix tags + sitemap + Search Console** — chosen. Small, low risk, directly serves branded search.
- B. A + build-time pre-rendering — better non-Google/social previews; more work, risk with GSAP/framer landing. Deferred.
- C. A + custom domain — strongest brand signal; costs money; owner's decision. Deferred.

## Design
1. **Canonical domain constant** (`SITE_URL`) used by `index.html`, `robots.txt`,
   `sitemap.xml`, and the runtime meta hook. Value depends on the open decision below.
2. **`sitemap.xml` + `robots.txt`** generated into `dist/` at build: sitemap lists `/`,
   `/privacy`, `/terms`; robots disallows `/patient`, `/provider`, `/admin` and points to
   the sitemap. Vercel serves real files before the SPA rewrite, so `/sitemap.xml` stops
   resolving to `index.html`. The hand-written `public/robots.txt` is replaced.
3. **`index.html`**: fix `og:url`; add `<link rel="canonical">`, `og:site_name`,
   `og:image`, `twitter:image`; replace JSON-LD with `WebSite` (`name: "MuntiCares"`,
   `alternateName: ["Munti Cares"]`) + `Organization` (`logo`).
4. **`usePageMeta` hook** (small, no dependency): sets `document.title`, description,
   canonical, and `robots` meta per route. Public pages get their own title/description;
   private and auth routes get `noindex, nofollow`.
5. **Logo/share image**: a PNG logo (≥112×112) and a 1200×630 share image in
   `public/images/brand/`, made from the existing favicon mark and landing hero.
6. **Search Console**: owner verifies the domain (HTML-tag method); I add the meta tag,
   owner submits `sitemap.xml`. Steps documented for the owner.

## Decision: official address (resolved 2026-11-08)
- Owner chose `https://munti-cares.vercel.app` as the official address.
- Done: `vercel domains add munti-cares.vercel.app munti-cares` succeeded; the address
  now returns 200 with the live app. `munti-cares-alpha.vercel.app` keeps working.
- The address lives in one setting, `VITE_SITE_URL` (default
  `https://munti-cares.vercel.app`). `index.html` reads it via Vite's `%VITE_SITE_URL%`
  replacement; `robots.txt` and `sitemap.xml` are generated at build by a tiny Vite plugin
  from the same value, so a future custom domain is a one-setting change + redeploy.
- `-alpha` is **not** redirected for now (canonical tags point Google to the official
  address). Builder's call: a host redirect could break Supabase auth redirect URLs
  that still use `-alpha`; revisit separately.
- Owner follow-up: add `https://munti-cares.vercel.app/**` to Supabase Auth
  redirect URLs so emails can link to the official address.

## Left to the builder
Exact titles/descriptions copy, hook placement, image generation method, tests.

## Verification
- Unit test for `usePageMeta` (title/canonical/robots per route).
- `npm run build` then check `dist/` has `sitemap.xml`, `robots.txt`, correct tags.
- After deploy: fetch live `/sitemap.xml`, `/robots.txt`, and page head; Google Rich
  Results Test on the home page.
