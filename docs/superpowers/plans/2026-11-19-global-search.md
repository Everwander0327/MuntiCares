# Global Search Command Palette Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the stubbed `GlobalSearch` in `DashboardLayout.jsx` with a modular, accessible, role-aware desktop/tablet command palette supporting live Supabase search, hidden/settings routes, quick actions, keyboard navigation, recent items, and deep-linking into list and schedule pages.

**Architecture:** Extract Global Search into `src/shared/navigation/globalSearch/` split by responsibility (`recentSearches.js`, `searchCatalog.js`, `searchDataSource.js`, `GlobalSearch.jsx`), use a 60s per-user TTL memory cache with bilingual JS filtering for Patient and Provider roles and debounced sanitized server-side `.ilike` queries for Admin, and wire a shared `useSearchQueryParam` hook into the 7 list/schedule pages so clicked matches land directly on the filtered/expanded item.

**Tech Stack:** React 18, React Router 7, Tailwind CSS, Framer Motion, Phosphor Icons, Supabase JS, Vitest, React Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-19-global-search-design.md`

## Global Constraints

- Desktop and tablet only (`hidden md:flex`) — do NOT add any search bar, icon button, or modal on mobile viewports.
- Zero Supabase SQL migrations, RPCs, or schema/RLS changes.
- Preserve strict role isolation: Patient sees only `is_approved = true` providers and own `patient_id` requests; Provider sees only own `provider_id` requests; Conversations and Provider *My Patients* / *Schedule* are restricted to `['Accepted', 'On The Way', 'Arrived', 'Completed']`.
- Never persist emails, medical notes, or PII beyond display names in URLs or `localStorage` (`mc_global_search_recent:<role>:<userId>`, cap 5).
- Escape/strip PostgREST filter metacharacters (`,`, `(`, `)`, `%`, `*`, `\`) before `.or()` / `.ilike()` interpolation.
- IME-safe `Enter` handling (`event.isComposing || event.keyCode === 229`) and full WAI-ARIA combobox semantics with an explicit `<label htmlFor>`.
- Full English (`en`) and Tagalog (`tl`) key parity in `src/i18n/navigation.js`.

## Review Focus

1. **IME composition Enter on search input:** Pressing `Enter` while `isComposing: true` or `keyCode: 229` must not activate a search result or close the palette. (Pinned in Task 4.)
2. **Stale async response race:** When an older admin/live Supabase query resolves after a newer query, the older result must be discarded and never overwrite newer results. (Pinned in Task 4.)
3. **PostgREST injection characters in Admin queries:** Typing `%,().*\` into Admin search must not produce malformed `.or()` filter strings or crash the query. (Pinned in Task 3.)
4. **Announcements `[MC_EVENT:{...}]` metadata false positives:** Searching `"carousel"` or `"https"` must not match encoded JSON metadata inside `announcements.message`, and subtitles must display clean text only. (Pinned in Task 3.)
5. **Deep-link `?q=` while already on the target page & URL cleanup:** Navigating to `/patient/requests?q=Nursing&tab=all` applies `searchTerm`, switches `activeTab` to `'all'`, and removes `q`/`tab` from the URL so clearing the search input works without fighting the URL. (Pinned in Task 5.)

---

### Task 1: i18n Keys & `recentSearches.js`

**Files:**
- Modify: `src/i18n/navigation.js`
- Create: `src/shared/navigation/globalSearch/recentSearches.js`
- Test: `src/shared/navigation/globalSearch/recentSearches.test.js`

**Interfaces:**
- Produces:
  - `getRecentSearches(role, userId) -> Array<{ id: string, label: string, subtitle?: string, to: string, kind: string }>`
  - `addRecentSearch(role, userId, item) -> Array<...>`
  - `clearRecentSearches(role, userId) -> void`
  - i18n keys under `nav.search.*` in both `en` and `tl`.

- [ ] **Step 1: Write failing tests in `src/shared/navigation/globalSearch/recentSearches.test.js`**
  - Verify scoping by `(role, userId)` under `mc_global_search_recent:<role>:<userId>`.
  - Verify deduplication by `to` (re-adding moves item to front), max cap of 5 items, stripping unexpected fields (e.g., `email`), and safe fallback to `[]` on corrupted JSON.
- [ ] **Step 2: Run test to verify it fails**
  - Run: `npx vitest run src/shared/navigation/globalSearch/recentSearches.test.js`
  - Expected: FAIL (module not found).
- [ ] **Step 3: Implement `recentSearches.js` and add EN/TL `nav.search.*` keys in `src/i18n/navigation.js`**
  - Add keys for: `ariaLabel`, `clearInput`, `recent`, `clearRecent`, `settings`, `quickActions`, `providers`, `myRequests`, `conversations`, `myPatients`, `requests`, `schedule`, `patients`, `announcements`, `noResultsFor`, `actionToggleDark`, `actionToggleLight`, `actionSwitchToTagalog`, `actionSwitchToEnglish`, `actionWeeklyUpdates`, `actionSignOut`, `rolePatient`, `roleProvider`, `statusBanned`, `statusActive`, `pageConsent`, `pageProfile`, `pageSettings`.
- [ ] **Step 4: Run tests**
  - Run: `npx vitest run src/shared/navigation/globalSearch/recentSearches.test.js src/i18n/i18n.test.js`
  - Expected: PASS.

---

### Task 2: `searchCatalog.js` (Static Pages, Settings Tabs, Quick Actions & Highlighting)

**Files:**
- Create: `src/shared/navigation/globalSearch/searchCatalog.js`
- Test: `src/shared/navigation/globalSearch/searchCatalog.test.js`

**Interfaces:**
- Produces:
  - `buildStaticCatalog({ role, links, t, dark, language }) -> { pages: CatalogItem[], settings: CatalogItem[], actions: CatalogItem[] }`
  - `filterCatalogItems(items, query) -> CatalogItem[]`
  - `splitHighlightSegments(text, query) -> Array<{ text: string, match: boolean }>`

- [ ] **Step 1: Write failing tests in `src/shared/navigation/globalSearch/searchCatalog.test.js`**
  - Verify Patient includes `/patient/consent`, `/patient/profile`, `/patient/settings` and Weekly Updates action.
  - Verify Provider includes `/provider/profile`, `/provider/settings` and Weekly Updates action.
  - Verify Admin includes `/admin/profile`, `/admin/settings` and excludes Weekly Updates action.
  - Verify all 4 Settings tabs (`appearance`, `personalization`, `notifications`, `privacy`) resolve to `/${role}/settings?tab=<id>` and match keywords.
  - Verify `splitHighlightSegments("Home Nursing Care", "nurs")` splits case-insensitively with exact text preservation and returns single non-match segment for empty/unmatched queries.
- [ ] **Step 2: Run test to verify it fails**
  - Run: `npx vitest run src/shared/navigation/globalSearch/searchCatalog.test.js`
  - Expected: FAIL.
- [ ] **Step 3: Implement `searchCatalog.js`**
- [ ] **Step 4: Run test to verify it passes**
  - Run: `npx vitest run src/shared/navigation/globalSearch/searchCatalog.test.js`
  - Expected: PASS.

---

### Task 3: `searchDataSource.js` (Hybrid Cached Patient/Provider + Server `.ilike` Admin)

**Files:**
- Create: `src/shared/navigation/globalSearch/searchDataSource.js`
- Test: `src/shared/navigation/globalSearch/searchDataSource.test.js`

**Interfaces:**
- Consumes: `@/lib/supabase`, `parseAnnouncementRecord` from `@/features/admin/utils/recentEvents`
- Produces:
  - `sanitizePostgrestQuery(raw) -> string`
  - `clearSearchCache(role?, userId?) -> void`
  - `warmRoleSearchCache(role, userId) -> Promise<void>`
  - `searchLiveRecords({ role, userId, query, translateService, translateStatus, t }) -> Promise<Array<{ key: string, label: string, items: SearchResultItem[] }>>`

- [ ] **Step 1: Write failing tests in `src/shared/navigation/globalSearch/searchDataSource.test.js`**
  - `sanitizePostgrestQuery` strips `,()\%*` and trims whitespace.
  - Patient search: caches providers + own requests for 60s (second query does not re-hit Supabase), matches Tagalog translated service names, excludes `Pending`/`Cancelled` requests from *Conversations*, deep-links providers to `/patient/providers/:id/profile` and requests to `/patient/requests?q=...&tab=all`.
  - Provider search: fetches own requests once (cached 60s), restricts *My Patients*, *Schedule*, and *Conversations* to `['Accepted', 'On The Way', 'Arrived', 'Completed']` while keeping `'Pending'` in *Requests*, deep-links Schedule to `/provider/schedule?date=YYYY-MM-DD&appt=<id>`.
  - Admin search: runs server `.ilike` with sanitized query, keeps email out of `to` and `recentSubtitle` (uses name in `?q=`), parses Announcements via `parseAnnouncementRecord` so `"https"` / `"MC_EVENT"` in metadata never false-matches and subtitles use clean body/tag, gracefully ignores `42P01`/`PGRST205` on announcements.
  - Soft-fails gracefully (returns `[]`) on Supabase errors without throwing.
- [ ] **Step 2: Run test to verify it fails**
  - Run: `npx vitest run src/shared/navigation/globalSearch/searchDataSource.test.js`
  - Expected: FAIL.
- [ ] **Step 3: Implement `searchDataSource.js`**
- [ ] **Step 4: Run test to verify it passes**
  - Run: `npx vitest run src/shared/navigation/globalSearch/searchDataSource.test.js`
  - Expected: PASS.

---

### Task 4: `GlobalSearch.jsx` Component & `DashboardLayout.jsx` Integration

**Files:**
- Create: `src/shared/navigation/globalSearch/GlobalSearch.jsx`
- Create: `src/shared/navigation/globalSearch/index.js`
- Modify: `src/shared/navigation/index.js`
- Modify: `src/layouts/DashboardLayout.jsx`
- Test: `src/shared/navigation/globalSearch/GlobalSearch.test.jsx`

**Interfaces:**
- Consumes: `recentSearches.js`, `searchCatalog.js`, `searchDataSource.js`, `useTheme`, `useLanguage`
- Produces: `<GlobalSearch currentRole links authUser onNavigate onLogout />`

- [ ] **Step 1: Write failing tests in `src/shared/navigation/globalSearch/GlobalSearch.test.jsx`**
  - Renders desktop-only wrapper (`hidden md:flex`) with an accessible `<label>` linked to the `role="combobox"` input and `Ctrl K` / `⌘K` hint.
  - Opens on focus or `Ctrl+K`, shows Quick Navigation + Quick Actions (and Recent when present), closes on `Escape` or outside click.
  - ArrowDown / ArrowUp wraps active option (`aria-activedescendant` + `aria-selected`), Enter triggers active item.
  - IME safety: Enter with `isComposing: true` or `keyCode: 229` does NOT trigger navigation or close dropdown.
  - Selecting a Quick Action executes theme toggle, language toggle, `munticares-open-weekly-updates` event, or `onLogout`, and does NOT save the action into Recent searches.
  - Selecting a navigation/record item navigates, saves to Recent (using `recentSubtitle` when provided), clears query, and closes dropdown.
  - Race guard: slower earlier live search resolving after a newer query does not overwrite newer results.
- [ ] **Step 2: Run test to verify it fails**
  - Run: `npx vitest run src/shared/navigation/globalSearch/GlobalSearch.test.jsx`
  - Expected: FAIL.
- [ ] **Step 3: Implement `GlobalSearch.jsx`, export it from `src/shared/navigation/index.js`, and wire it into `src/layouts/DashboardLayout.jsx`**
  - Remove inline `GlobalSearch` from `DashboardLayout.jsx` and pass `onLogout` + `clearSearchCache()` on sign-out.
- [ ] **Step 4: Run tests**
  - Run: `npx vitest run src/shared/navigation/globalSearch/GlobalSearch.test.jsx src/layouts/dashboardLiveUser.test.jsx`
  - Expected: PASS.

---

### Task 5: Destination Page Deep-Link Wiring (`useSearchQueryParam`)

**Files:**
- Create: `src/hooks/useSearchQueryParam.js`
- Test: `src/hooks/useSearchQueryParam.test.jsx`
- Modify:
  - `src/features/patient/pages/Requests.jsx`
  - `src/features/provider/pages/Requests.jsx`
  - `src/features/provider/pages/Schedule.jsx`
  - `src/features/admin/pages/Patients.jsx`
  - `src/features/admin/pages/Providers.jsx`
  - `src/features/admin/pages/Requests.jsx`
  - `src/features/admin/pages/Announcements.jsx`

**Interfaces:**
- Produces: `useSearchQueryParam(keys, onMatch)` — reads listed query params via `useSearchParams()`, calls `onMatch(values)` whenever any listed key is present, and removes those consumed keys via `setSearchParams(next, { replace: true })`.

- [ ] **Step 1: Write failing tests in `src/hooks/useSearchQueryParam.test.jsx`**
  - Consumes `?q=Nursing&tab=all`, invokes callback with `{ q: 'Nursing', tab: 'all' }`, and strips `q` and `tab` while preserving unrelated params.
  - Re-triggers when navigating to a new `?q=` while staying mounted on the same route.
- [ ] **Step 2: Run test to verify it fails**
  - Run: `npx vitest run src/hooks/useSearchQueryParam.test.jsx`
  - Expected: FAIL.
- [ ] **Step 3: Implement `src/hooks/useSearchQueryParam.js` and wire it into the 7 destination pages**
- [ ] **Step 4: Run tests**
  - Run: `npx vitest run src/hooks/useSearchQueryParam.test.jsx src/features/admin/pages/Patients.test.jsx src/features/admin/pages/Providers.test.jsx`
  - Expected: PASS.

---

### Task 6: Full Suite Verification, Build Check & Fresh Code Review

- [ ] **Step 1: Run full Vitest suite** (`npm test`) and verify every test passes.
- [ ] **Step 2: Run ESLint on all touched/created files and run `npm run build`** to confirm zero build or lint issues.
- [ ] **Step 3: Dispatch a fresh code-reviewer subagent** against the diff, spec, and Review Focus; address any Critical/Important findings with RED→GREEN tests and re-verify the full suite.
