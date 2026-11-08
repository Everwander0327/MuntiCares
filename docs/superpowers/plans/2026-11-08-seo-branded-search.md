# SEO Branded Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Google see one official address (`https://munti-cares.vercel.app`), a valid sitemap/robots, the "MuntiCares" site name, per-page meta, and `noindex` on private routes.

**Architecture:** One data module (`src/lib/seo/seoConfig.js`, plain JS, importable from both the browser and `vite.config.js`) holds the default site URL and public page meta. A small Vite plugin replaces `__SITE_URL__` / verification placeholders in `index.html` and emits `robots.txt` + `sitemap.xml` at build. A `<SeoManager />` component in `App.jsx` applies per-route meta on navigation.

**Tech Stack:** React 18, react-router-dom 7, Vite 5, Vitest + jsdom, Playwright (image generation only).

**Spec:** `docs/superpowers/specs/2026-11-08-seo-branded-search-design.md`

## Global Constraints

- Official URL default: `https://munti-cares.vercel.app`; override with env `VITE_SITE_URL`. No trailing slash stored.
- Site name: `MuntiCares`; alternateName `Munti Cares`.
- Public indexable pages: `/`, `/privacy`, `/terms`.
- `noindex, nofollow`: `/login`, `/register`, `/reset-password`, `/onboarding`, and any path under `/patient`, `/provider`, `/admin`.
- No new runtime dependencies. No visible UI changes. No Supabase schema changes.
- Do not stage unrelated working-tree changes (`package.json`, `package-lock.json`, deleted `.env.example`).

## Review Focus

- Trailing slash / unknown paths (`/privacy/`, `/foo`): canonical has no trailing slash except root; unknown paths get default meta with `noindex`. → Task 2 tests.
- `VITE_SITE_URL` with trailing slash (`https://x.app/`): normalized, no `//` in output. → Task 1 + Task 3 tests.
- Repeated navigation: meta tags are updated in place, never duplicated. → Task 2 test.
- Built `index.html` must contain no literal `__SITE_URL__`. → Task 3 verification.
- Empty `VITE_GOOGLE_SITE_VERIFICATION`: no empty verification tag emitted. → Task 3 test.

---

### Task 1: SEO config + page meta resolver

**Files:**
- Create: `src/lib/seo/seoConfig.js`
- Create: `src/lib/seo/pageMeta.js`
- Test: `src/lib/seo/pageMeta.test.js`

**Interfaces:**
- Produces (`seoConfig.js`): `DEFAULT_SITE_URL: string`, `SITE_NAME: 'MuntiCares'`, `PUBLIC_PAGES: Array<{ path: string, title: string, description: string }>`, `NOINDEX_PREFIXES: string[]`, `normalizeSiteUrl(url?: string): string` (falls back to default, strips trailing `/`).
- Produces (`pageMeta.js`): `getPageMeta(pathname: string, siteUrl: string): { title: string, description: string, canonical: string, robots: 'index, follow' | 'noindex, nofollow' }`.

- [ ] **Step 1: Write failing tests** — `getPageMeta('/', U)` → `canonical === U + '/'`, robots `index, follow`, title contains `MuntiCares`; `'/privacy/'` → canonical `U + '/privacy'`; `'/terms'` → own title (not the home title); `'/login'`, `'/patient/dashboard'`, `'/admin'`, `'/onboarding'` → `noindex, nofollow`; `'/does-not-exist'` → `noindex, nofollow`; `normalizeSiteUrl('https://x.app/')` → `'https://x.app'`; `normalizeSiteUrl(undefined)` → `DEFAULT_SITE_URL`.
- [ ] **Step 2: Run** `npx vitest run src/lib/seo/pageMeta.test.js` — Expected: FAIL (module not found).
- [ ] **Step 3: Implement.** Copy: home title `MuntiCares — Home Care, Right at Your Doorstep`; privacy `Privacy Policy | MuntiCares`; terms `Terms of Service | MuntiCares`; descriptions one sentence each, home uses existing `index.html` description. Non-public pages reuse home title/description.
- [ ] **Step 4: Run** same command — Expected: PASS.
- [ ] **Step 5: Commit** `git add src/lib/seo && git commit -m "feat(seo): add page meta resolver"`

### Task 2: Apply meta on navigation

**Files:**
- Create: `src/lib/seo/applyPageMeta.js`
- Create: `src/components/SeoManager.jsx`
- Modify: `src/App.jsx` (render `<SeoManager />` inside `AppContent`, next to `<IncomingCallOverlay />`)
- Test: `src/lib/seo/applyPageMeta.test.js`

**Interfaces:**
- Consumes: `getPageMeta`, `normalizeSiteUrl`.
- Produces: `applyPageMeta(meta, doc = document): void` — sets `doc.title`; upserts `meta[name=description]`, `meta[name=robots]`, `link[rel=canonical]`, `meta[property=og:url]`, `meta[property=og:title]`, `meta[property=og:description]`. `SeoManager` (no props, renders `null`) calls it in an effect on `location.pathname` with `normalizeSiteUrl(import.meta.env.VITE_SITE_URL)`.

- [ ] **Step 1: Write failing tests** — after one call, head has exactly one of each tag with the meta values; after a second call with different meta, still exactly one of each and values updated.
- [ ] **Step 2: Run** `npx vitest run src/lib/seo/applyPageMeta.test.js` — Expected: FAIL.
- [ ] **Step 3: Implement** `applyPageMeta`, `SeoManager`, wire into `App.jsx`.
- [ ] **Step 4: Run** `npx vitest run src/lib/seo` — Expected: PASS.
- [ ] **Step 5: Commit** `git add src/lib/seo src/components/SeoManager.jsx src/App.jsx && git commit -m "feat(seo): per-route title, canonical and robots"`

### Task 3: Build-time robots, sitemap, index.html URL

**Files:**
- Create: `scripts/seo/seoFiles.js` (pure builders)
- Create: `scripts/seo/seoPlugin.js` (Vite plugin)
- Modify: `vite.config.js` (add `seoPlugin()` to `plugins`)
- Modify: `index.html` (replace hardcoded URLs with `__SITE_URL__`; add canonical, `og:site_name`, `og:image`, `twitter:image`, `__GOOGLE_SITE_VERIFICATION__` placeholder comment; replace LocalBusiness JSON-LD with `@graph` of `WebSite` {name, alternateName, url} + `Organization` {name, url, logo `__SITE_URL__/images/brand/logo-512.png`, areaServed Muntinlupa City})
- Delete: `public/robots.txt`
- Test: `scripts/seo/seoFiles.test.js` (add `'scripts/**/*.test.js'` to vitest `include`)

**Interfaces:**
- Consumes: `normalizeSiteUrl`, `PUBLIC_PAGES`, `NOINDEX_PREFIXES` from `src/lib/seo/seoConfig.js` (relative import).
- Produces: `buildRobotsTxt(siteUrl): string`, `buildSitemapXml(siteUrl, pages, lastmod: 'YYYY-MM-DD'): string`, `renderIndexHtml(html, { siteUrl, googleVerification }): string`; `seoPlugin(): Plugin` using `transformIndexHtml` + `generateBundle` (`emitFile` type `asset`), reading `VITE_SITE_URL` / `VITE_GOOGLE_SITE_VERIFICATION` via `loadEnv(mode, process.cwd(), 'VITE_')` in `configResolved`.

- [ ] **Step 1: Write failing tests** — robots contains `Sitemap: https://x.app/sitemap.xml` and `Disallow: /patient/`, `/provider/`, `/admin/`; sitemap has exactly 3 `<loc>`: `https://x.app/`, `https://x.app/privacy`, `https://x.app/terms`; with `siteUrl 'https://x.app/'` no `//privacy`; `renderIndexHtml` leaves no `__SITE_URL__`; with empty verification emits no `google-site-verification` tag, with `'abc'` emits `<meta name="google-site-verification" content="abc" />`.
- [ ] **Step 2: Run** `npx vitest run scripts/seo` — Expected: FAIL.
- [ ] **Step 3: Implement** builders, plugin, `index.html`, `vite.config.js`; delete `public/robots.txt`.
- [ ] **Step 4: Run** `npx vitest run scripts/seo` — PASS; then `npm run build` and check: `dist/robots.txt`, `dist/sitemap.xml` exist; `Select-String dist/index.html -Pattern '__SITE_URL__'` returns nothing; `dist/index.html` contains `https://munti-cares.vercel.app`.
- [ ] **Step 5: Commit** `git add scripts/seo vite.config.js index.html public/robots.txt && git commit -m "feat(seo): generate robots and sitemap from VITE_SITE_URL"`

### Task 4: Brand images

**Files:**
- Create: `scripts/seo/generate-brand-images.mjs`
- Create: `public/images/brand/logo-512.png` (512×512), `public/images/brand/og-image.png` (1200×630)

**Interfaces:** Consumes the heart mark from `public/favicon.svg` and `public/images/landing/hero-wash.jpg`. Produces the two PNG paths referenced by Task 3's `index.html`.

- [ ] **Step 1:** Script uses Playwright (`chromium.launch({ channel: 'chrome' })`) to screenshot an inline HTML page at each size: logo = favicon mark on brand blue `#2563eb`; OG = hero photo with dark overlay, mark, "MuntiCares", "Home Care, Right at Your Doorstep".
- [ ] **Step 2: Run** `node scripts/seo/generate-brand-images.mjs` — Expected: both files exist with the stated pixel sizes (check with `[System.Drawing.Image]::FromFile`).
- [ ] **Step 3: Commit** `git add scripts/seo/generate-brand-images.mjs public/images/brand && git commit -m "feat(seo): add logo and share image"`

### Task 5: Supabase redirect config + docs

**Files:**
- Modify: `supabase/config.toml` (`site_url` → `https://munti-cares.vercel.app`; add `https://munti-cares.vercel.app/reset-password`, `https://munti-cares.vercel.app/login` to `additional_redirect_urls`, keep all `-alpha` entries)
- Modify: `README.md` (short "SEO & domain" section: `VITE_SITE_URL`, `VITE_GOOGLE_SITE_VERIFICATION`, how to switch domains, Search Console steps)

- [ ] **Step 1:** Edit both files.
- [ ] **Step 2: Run full check** `npm test` and `npm run lint` — Expected: all pass, lint within `--max-warnings 15`.
- [ ] **Step 3: Commit** `git add supabase/config.toml README.md docs/superpowers && git commit -m "docs(seo): official domain config and Search Console steps"`

### Task 6: Live verification (after owner-approved deploy)

- [ ] Fetch `https://munti-cares.vercel.app/robots.txt` and `/sitemap.xml` — Expected: real text/XML, not `index.html`.
- [ ] Fetch `/` head — Expected: canonical `https://munti-cares.vercel.app/`, `og:image` URL returns 200.

**Owner-only (cannot be automated here):** Google Search Console verification + sitemap submission; Supabase dashboard redirect URLs (CLI is not logged in, and `config.toml` is not pushed automatically).
