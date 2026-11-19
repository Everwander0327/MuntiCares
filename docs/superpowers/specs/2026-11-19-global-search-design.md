# Global Search Command Palette Design

Date: 2026-11-19
Status: Approved

## Intent & Why

The top navbar search bar (`GlobalSearch` in `src/layouts/DashboardLayout.jsx`) currently advertises live search across providers, patients, requests, schedules, and users in its placeholder text and displays a `Jump ↵` keyboard hint, but in practice:

- **Patients and admins** only filter their 5 sidebar navigation links — no records are queried.
- **Providers** fetch 5 arbitrary rows from `requests` without a search filter and filter those 5 rows client-side; clicking any match always routes to `/provider/patients`.
- **Keyboard navigation** (`↑` / `↓` / `Enter`) is not implemented.
- **Non-sidebar routes** (Consent Management, Profile, Settings, and Settings tabs) are not searchable.

Upgrading this bar into a real, role-aware desktop command palette delivers on what the UI already promises and gives every role fast, keyboard-first jumping to pages, specific records, chats, and common actions.

## Goals, Non-Goals & Anti-Goals

### Goals
- **Real role-aware record search** for `patient`, `provider`, and `admin` using the existing Supabase JS client and RLS policies.
- **Complete route coverage**: index each role's sidebar pages plus account/non-sidebar pages (Profile, Consent Management, Settings) and individual Settings tabs (`?tab=appearance|personalization|notifications|privacy`).
- **Quick Actions**: trigger frequent actions directly from the bar (Light/Dark theme toggle, English/Tagalog language toggle, Weekly Updates modal for patient/provider, Sign Out).
- **Full keyboard UX & polish**: `Ctrl+K` / `⌘K` open shortcut (with subtle visual keycap hint when empty), `↑`/`↓` navigation across all grouped results, `Enter` to activate, `Esc` to close, clear button (`X`), matched-text highlighting, and per-user **Recent** items persisted in `localStorage`.
- **End-to-end deep-linking**: reuse existing profile, chat, and settings tab URLs, and add URL query-param handoff (`?q=` and `?date=&appt=`) to list/schedule pages so clicking a record lands directly on that item.
- **Bilingual support**: full English (`en`) and Tagalog (`tl`) strings in `src/i18n/navigation.js`, and matching against both raw and translated service/status names.

### Non-Goals
- **No mobile search UI.** The user explicitly rejected adding a search bar, icon trigger, or search modal on mobile viewports. Keep the component desktop/tablet-only (`hidden md:flex`).
- **No Supabase SQL migrations, RPCs, or schema/RLS changes.**
- **No full-text search across chat message bodies** (search conversation partners only, avoiding heavy scans on `messages`).

### Anti-Goals
- **No cross-role or unapproved data leakage.** Patients only see `is_approved = true` providers and their own requests/conversations; providers only see their own patients/requests/schedule/conversations.
- **No typing lag or stale-response flicker.** Do not re-fetch entire tables on every keystroke, and guard async searches with a request sequence check so older responses cannot overwrite newer ones.
- **No sticky URL filters.** Once a destination page consumes `?q=` (or `?date=&appt=`), clean the query string so editing/clearing the page's local search box behaves normally and re-searching from Global Search while already on that page still works.

## Constraints

- **Viewport scope:** Desktop and tablet only (`hidden md:flex`), matching the current placement in `DashboardLayout.jsx`.
- **Design system:** Match existing MuntiCares neumorphic styling (`neu-inset`, `neu-flat`, `neu-flat-sm`, `text-txt-primary`, `text-link`, dark mode tokens) and respect `useTheme().reducedMotion`.
- **Accessibility:** Implement WAI-ARIA combobox semantics (`role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`, `role="listbox"`, `role="option"`, `aria-selected`) with active option scrolled into view on arrow movement.
- **Privacy in `localStorage`:** Store recent items under `mc_global_search_recent:<role>:<userId>` (max 5 items). Store only display/navigation metadata (`id`, `label`, `subtitle`, `to`, `kind`) — never medical notes, emails, or PII beyond display names. Clear on explicit "Clear" click; ignore corrupted JSON gracefully.
- **Sanitization:** Escape/strip PostgREST filter metacharacters (`,`, `(`, `)`, `%`, `*`, `\`) before interpolating user queries into Supabase `.or()` / `.ilike()` filters.

## Approaches Considered

### Option A — Modular client search (hybrid cache + server `.ilike`) + `?q=` deep-links *(Selected)*
- Extract `GlobalSearch` into `src/shared/navigation/globalSearch/`.
- **Patient & Provider** live data: load each user's bounded scoped dataset on first open/query with a 60-second in-memory TTL cache per `(role, userId)`, then filter instantaneously in JS (matching both English and Tagalog translated service/status names).
- **Admin** live data: run debounced (200ms) server-side `.ilike` queries capped per group so larger platform tables stay scalable.
- **Deep-linking**: use existing profile/chat/settings URLs plus a tiny URL-param consumer on the 7 list/schedule pages that already have local search/filter state.
- **Trade-off:** Touches 7 existing pages with ~10–15 lines each to consume query params, in exchange for zero SQL migrations, instant keystroke responsiveness, bilingual matching, and true record-level landing.

### Option B — Single Supabase Postgres RPC (`global_search`)
- Add a `SECURITY INVOKER` SQL function querying all tables in one round trip.
- **Trade-off:** Scales well for very large datasets, but introduces a Supabase migration/deployment dependency and cannot easily match frontend-only Tagalog translations.

### Option C — Client command palette without `?q=` deep-linking on list pages
- Same search UX, but skips touching Requests/Schedule/Admin list pages (only profiles, chats, and settings tabs deep-link).
- **Trade-off:** Smaller diff, but clicking a request or admin user drops the user onto an unfiltered list.

**Why Option A was chosen:** The user selected Option A for end-to-end record landing, bilingual search accuracy, and zero backend migration overhead.

## Architecture & Behavior

### 1. Module Structure

Replace the inline `GlobalSearch` component in `src/layouts/DashboardLayout.jsx` with a dedicated module re-exported from `src/shared/navigation/index.js`:

- `src/shared/navigation/globalSearch/GlobalSearch.jsx` — Combobox UI, keyboard handler, highlighted text rendering, grouped dropdown, recent section, and quick-action execution.
- `src/shared/navigation/globalSearch/searchCatalog.js` — Role-scoped static entries:
  - Sidebar pages + non-sidebar pages:
    - **Patient:** Dashboard, Find Providers, My Requests, Messages, Profile, Consent Management (`/patient/consent`), Settings (`/patient/settings`)
    - **Provider:** Dashboard, Incoming Requests, My Patients, My Schedule, Messages, Profile (`/provider/profile`), Settings (`/provider/settings`)
    - **Admin:** Overview, Patients, Providers, Requests, Announcements, Profile (`/admin/profile`), Settings (`/admin/settings`)
  - **Settings Tabs** (all roles, using `/${role}/settings?tab=<id>` and reusing `settings.sections.<id>.label` + `.keywords` from i18n): Appearance, Personalization, Notifications, Privacy.
  - **Quick Actions**:
    - Toggle Theme (Dark ↔ Light via `useTheme().setThemeMode`)
    - Switch Language (English ↔ Tagalog via `useLanguage().setLanguage`)
    - Weekly Updates (patient & provider only; dispatches `window.dispatchEvent(new CustomEvent('munticares-open-weekly-updates'))`)
    - Sign Out (invokes `onLogout` prop from `DashboardLayout`)
- `src/shared/navigation/globalSearch/searchDataSource.js` — Role-aware Supabase fetching, 60s in-memory TTL cache for patient/provider, debounced server `.ilike` for admin, and bilingual matching.
- `src/shared/navigation/globalSearch/recentSearches.js` — `localStorage` persistence (`mc_global_search_recent:<role>:<userId>`, cap 5, deduplicate by `to`).

### 2. Dropdown States & Result Groups

**When input is empty (focused or opened via `Ctrl+K` / `⌘K`):**
1. **Recent** (only shown if non-empty; up to 5 items; includes a small "Clear" button in the section header)
2. **Quick Navigation** (role's primary pages)
3. **Quick Actions** (theme, language, weekly updates [non-admin], sign out)

**When user types (`query.trim().length >= 1`):**
- Static sections (*Pages*, *Settings*, *Quick Actions*) filter immediately on character 1 by label, short label, and keywords.
- Live record sections run at `query.trim().length >= 2` (up to 5 results per group, 4 for conversations/schedule):
  - **Patient (60s cached fetch on first open/query):**
    - *Providers*: `providers` where `is_approved = true` (`id, user_id, services, location, rating, user:user_id(id, full_name, avatar_url)`, limit 100). Matches `full_name`, raw/translated `services`, `location`. Navigates to `/patient/providers/${p.user_id}/profile`.
    - *My Requests*: `requests` where `patient_id = authUser.id` (`id, service, status, date, time, provider_id, provider:provider_id(id, full_name, avatar_url)`, ordered by `created_at desc`, limit 60). Matches provider name, raw/translated `service`, raw/translated `status`, `date`. Navigates to `/patient/requests?q=${encodeURIComponent(term)}&tab=all` (preferring provider full name if present, else service).
    - *Conversations*: unique providers derived from the patient's cached requests whose `status` is in `['Accepted', 'On The Way', 'Arrived', 'Completed']` (matching `can_chat_with()` RLS and `ConversationList.jsx` so every result opens an authorized chat thread). Navigates to `/patient/messages?partner=${id}&name=${encodeURIComponent(name)}`.
  - **Provider (60s cached fetch on first open/query):**
    - *My Patients*: deduplicated patients from the provider's cached requests (`provider_id = authUser.id`, limit 100, `patient:patient_id(id, full_name, avatar_url)`) restricted to `status` in `['Accepted', 'On The Way', 'Arrived', 'Completed']` (matching `src/features/provider/pages/Patients.jsx`). Matches `full_name`. Navigates to `/provider/patients/${patientId}/profile`.
    - *Requests*: all statuses from the same cached `requests` fetch (`id, service, status, date, time, patient_id, patient:patient_id(id, full_name, avatar_url)`). Matches patient name, raw/translated `service`, raw/translated `status`, `date`. Navigates to `/provider/requests?q=${encodeURIComponent(term)}`.
    - *Schedule*: subset of cached requests with a `date` and `status` in `['Accepted', 'On The Way', 'Arrived', 'Completed']` (matching `Schedule.jsx` exactly — `'Pending'` stays under *Requests* only so every Schedule deep-link opens a real visible appointment). Matches patient name, service, date, time. Navigates to `/provider/schedule?date=${dateOnly}&appt=${id}`.
    - *Conversations*: deduplicated patients from cached requests with `status` in `['Accepted', 'On The Way', 'Arrived', 'Completed']` (matching `can_chat_with()` RLS). Navigates to `/provider/messages?partner=${id}&name=${encodeURIComponent(name)}`.
  - **Admin (debounced 200ms server-side `.ilike`, race-guarded, cap 5 per group):**
    - *Patients*: `users` (`id, full_name, email, avatar_url, is_banned`) where `role = 'patient'` matching `full_name` or `email`. Displays email in the live dropdown subtitle, but navigates to `/admin/patients?q=${encodeURIComponent(full_name)}` and stores a non-PII subtitle (e.g. role/account status) if saved to Recent items so emails are never written to URLs or `localStorage`.
    - *Providers*: `users` (`id, full_name, email, avatar_url, is_banned`) where `role = 'provider'` matching `full_name` or `email`. Displays email in the live dropdown subtitle, but navigates to `/admin/providers?q=${encodeURIComponent(full_name)}` with a non-PII Recent subtitle.
    - *Requests*: `requests` (`id, service, status, date, time, patient:patient_id(full_name), provider:provider_id(full_name)`) matching `service` or `status` (plus any `patient_id` / `provider_id` matched from the parallel user queries above via `.or()`), ordered by `created_at desc`, limit 5. Navigates to `/admin/requests?q=${encodeURIComponent(patientName || service)}`.
    - *Announcements*: `announcements` (`id, title, message, target_audience, created_at`) matching `title` or `message` (over-fetching up to 15 rows, gracefully skipping if table-missing error `42P01`/`PGRST205`). Each row is parsed through `parseAnnouncementRecord` from `@/features/admin/utils/recentEvents` so `[MC_EVENT:{...}]` metadata prefixes are never exposed or falsely matched; client-side filtering keeps up to 5 rows matching parsed `title`, `body`, or `tag`. Navigates to `/admin/announcements?q=${encodeURIComponent(parsed.title)}`.
- If a live fetch errors, fail softly (do not break static navigation results; show no toast spam).
- If neither static nor live results match (and not loading), show a single clean empty state (`No matches for "{{query}}"`).

### 3. Keyboard & Interaction Behavior

- `Ctrl+K` / `⌘K` anywhere on the page opens the dropdown and focuses the input (selecting existing text if any).
- `↓` / `↑` moves the active highlight continuously across all visible groups (wrapping at top/bottom). Hovering a row with the mouse updates the active index only when the mouse moves, keeping keyboard and mouse states aligned.
- `Enter` executes the currently highlighted item (defaults to index `0` whenever results change).
- `Esc` closes the dropdown and blurs the input.
- Clicking a navigation/record item records it in Recent items (Quick Actions are not added to Recent), navigates, clears the query, and closes the dropdown.
- Inside the right edge of the search input: show a `Clear` (`X`) icon button when `searchQuery` is non-empty, or a subtle `Ctrl K` / `⌘K` badge (OS-detected via `navigator.platform` / `userAgentData`) when empty.

### 4. Destination Page Deep-Link Wiring

Add a small URL-param consumer on each of these 7 pages (clearing the param with `setSearchParams(..., { replace: true })` right after applying so local edits work normally):

1. `src/features/patient/pages/Requests.jsx` — `?q=` (sets `searchTerm`, resets `filter` to `'All'`, sets `activeTab` to `tab` param or `'all'` so past/completed matches are visible).
2. `src/features/provider/pages/Requests.jsx` — `?q=` (sets `searchTerm`, resets `filter` to `'All'`).
3. `src/features/provider/pages/Schedule.jsx` — `?date=&appt=` (sets `selectedDate` via `parseLocalDate` and expands `appt` in `expandedAppts`) and fallback `?q=` (sets `searchQuery`).
4. `src/features/admin/pages/Patients.jsx` — `?q=` (sets `searchTerm`, resets `filter` to `'all'`).
5. `src/features/admin/pages/Providers.jsx` — `?q=` (sets `searchTerm`, resets `filter` to `'all'`).
6. `src/features/admin/pages/Requests.jsx` — `?q=` (sets `searchTerm`, resets `filter` to `'All'`).
7. `src/features/admin/pages/Announcements.jsx` — `?q=` (sets `historySearch`, resets `historyFilter` to `'all'`).

Already supported without changes:
- `/patient/providers/:id/profile`
- `/provider/patients/:id/profile`
- `/patient/messages?partner=<id>&name=<name>`
- `/provider/messages?partner=<id>&name=<name>`
- `/:role/settings?tab=<appearance|personalization|notifications|privacy>`

### 5. What's Left to the Builder

- Exact Phosphor icon selections per result category and quick action.
- Exact highlight `<mark>` styling, dropdown max-height, and subtle micro-animations.
- Cache invalidation helper exports for unit tests and sign-out cleanup.
- Unit/component test file organization and Supabase mock setup (using the repo's existing Vitest + React Testing Library setup).
