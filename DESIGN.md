# Design System: MuntiCares — Trusted Home Care Network

**Project:** MuntiCares (Muntinlupa home-care: patient / provider / admin dashboards)
**Status:** describes the shipped UI. The implementation is canonical; this file records it.

Open drift, tracked in `.design-qa/automation-state.json`: shared page-header adoption,
avatar consolidation, spinner-to-skeleton migration, data-fetch error states, the z-index
ramp, and the single-primary-CTA cleanup. Rules below are the target until those close.

Sources of truth:

- Tokens: `tailwind.config.js` and the `:root` / `html.dark` blocks in `src/index.css`
- Primitives: `src/shared/ui/` (`button`, `form-input`, `dialog`, `sheet`, `skeleton`, `empty-state`)
- Gates: `npm run qa:design:gate` (section 8 of `.design-qa/AUTOMATION_PROMPT.md`)

Every rule below is a token, a class pattern, or a measured gate.

---

## 1. Visual Theme & Atmosphere

A clinical yet warm interface built on neumorphic surfaces: soft raised cards on a cool blue
canvas, one Trust Blue accent, and a single coral "discovery" accent. Motion is restrained and
spring-physics (`ease-fluid`), never theatrical in clinical flows.

Density is balanced: provider grids breathe, tables stay scannable. Variance is offset-asymmetric
on marketing surfaces and stable on clinical lists.

Priority screens: `Find a Provider` grid, Provider Details sheet, Provider Profile, Booking flow.

---

## 2. Color

### 2.1 Core palette (shipped values)

| Role | Token | Light | Dark | Use |
|---|---|---|---|---|
| Primary | `primary` | `#2F6FB5` | `#8CBDF0` (`primary-400`) | Primary actions, active states, links |
| Primary hover | `primary-700` | `#255A94` | — | Hover for filled primary |
| Primary wash | `primary-soft` | `#DDEBF8` | `primary-800 #183049` | Selected rows, soft badges |
| Discovery accent | `accent` | `#C4623F` | `#F2A98E` | At most one element per view |
| Ink | `ink` | `#17283B` | — | Covers, dark text alternative |
| Page canvas | `surface-page` | `#F4F8FC` | `#0E1620` | App body |
| Shell | `surface-shell` | `#EBF1F8` | `#172236` | Sheets, dropdowns, chat overlays |
| Subtle fill | `surface-subtle` | `#E9F1F9` | `#1F2D3E` | Insets, secondary chips |
| Border | `surface-border` | `#D2E0EE` | `#2D3F54` | 1px structural lines |
| Card | `surface` | `#FFFFFF` | `#16212E` (`neu-flat`) | Raised cards |
| Text primary | `txt-primary` / `ink` | `#17283B` | `#E6EEF6` | Headings, body |
| Text secondary | `txt-secondary` | `#52657A` | `#A5B6C8` | Descriptions |
| Text tertiary | `tertiary` | `#5A6B7F` | `#A5B6C8` | Timestamps, field labels, table heads |
| Success | `success` | `#2C7A55` | `#7DD3A3` | Approved, completed, active |
| Warning | `warning` | `#9C5A06` | `#F1BD6B` | Pending, developing |
| Danger | `danger` | `#BC3030` | `#F4918B` | Errors, rejected, destructive |
| Chart series | `chart-1..5` | see `index.css` | same | Data viz only |

Dark-mode surfaces are theme-aware CSS variables: use `bg-surface-page`, `bg-surface-shell`,
`bg-surface-subtle`, `border-surface-border`, `text-tertiary`. Do not pair a light hex with a
`dark:` hex for these roles.

### 2.2 Accent rules

- Trust Blue is the only primary action color.
- Coral (`accent`) may appear on **at most one element per view** and never as a second
  equal-weight CTA beside a blue primary. It is a discovery affordance, not a status color.
- Semantic status uses `success` / `warning` / `danger` only.
- Purple/violet/indigo and any third accent are banned. Chart series are the only sanctioned
  multi-hue set.
- Never pure black `#000000`. Use `ink` (`#17283B`). `floodColor` in SVG filters uses `ink` or
  a `chart-*` token.

### 2.3 Contrast

- Body and label text ≥ 4.5:1 at ≥12px. Tertiary text is `#5A6B7F` on white (4.76:1), never
  `#94A3B8` (2.56:1 — banned for text).
- Status text uses the 600–700 shade of its role: the `success` / `warning` / `danger` tokens.
- White-on-photo text requires a scrim that clears 4.5:1. Contrast checks exclude painted
  image/gradient ancestors.
- Gate 5 must report 0 failures at ≥12px.

---

## 3. Typography

| Tier | Size | Applies to |
|---|---|---|
| Display / headings | `text-lg` → `text-3xl` | `h1`–`h3`, Lexend, tight tracking |
| Explanatory body | **≥ 14px** (`text-sm`) | Sentences, helper copy, consent explanations, clinical text |
| Control labels & dense cells | **≥ 12px** (`text-xs`) | Field labels, status names, table cells, buttons |
| Eyebrows / timestamps | 10–11px (`text-2xs`, `text-nano`) | UPPERCASE, letter-spaced section labels only |

- Display font: `Lexend` (`font-display`, headings). Body/UI font: `Atkinson Hyperlegible Next`
  (`font-sans`).
- 9px (`text-3xs`) is retired for text; allowed only for non-text decoration.
- `Inter` is banned and must not appear in any font stack (including tracking-local tokens).
- Numbers that are compared (trust scores, ETA, timestamps) use `tabular-nums`.
- Gates 3 and 4 enforce the two floors; any sub-12px text must be an uppercase eyebrow.

---

## 4. Surface, Radius, Elevation

The neumorphic system ships as CSS components in `src/index.css`:

| Class | Meaning |
|---|---|
| `neu-flat` | Raised card (white / `#16212E`), hairline border, inset highlight |
| `neu-flat-sm` | Small raised chip or stat tile |
| `neu-inset` | Sunken well for inputs, chart panels, list bodies |
| `neu-btn` | Interactive raised control |
| `neu-btn-primary` | Filled Trust Blue control |
| `bezel` / `bezel-inner` | Double-bezel nesting for premium containers |
| `card` | Marketing/content card, `rounded-[2rem]` + diffused shadow |

Radii:

- Shared `Button`: `rounded-2xl`. Primary/secondary/destructive controls follow it.
- Cards and sheets: `rounded-2xl` to `rounded-[2.5rem]` for large shells.
- `rounded-full` is reserved for tags, status badges, eyebrows, avatars, dots, and the landing
  island CTAs (`btn-primary`). It is not the shared Button radius.
- Do not place a pill button beside a `rounded-2xl` button at the same hierarchy level.

Elevation is shadow-based: `shadow-card`, `shadow-soft`, `shadow-softer`, or the `neu-*` shadows.
No neon glows, no arbitrary `shadow-[…]` stacks.

---

## 5. Components

- **Button** (`shared/ui/button.jsx`): variants `default` (blue fill), `outline`, `secondary`,
  `ghost`, `destructive`, `link`; sizes default/sm/lg/icon. Touch controls are ≥44px (`h-11`);
  `sm` is for dense desktop toolbars only. One primary CTA per screen, sheet, or modal.
- **Form fields** (`shared/ui/form-input.jsx`): every control has a programmatic label
  (`htmlFor`/`id`), `aria-invalid`, `aria-describedby` for error text, and `autocomplete` on
  auth/identity fields. Placeholder-only fields are banned.
- **Dialog / Sheet** (`shared/ui/dialog.jsx`, `shared/ui/sheet.jsx`): the only allowed overlay
  roots. Each overlay: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, focus trap,
  initial focus, Escape to close, focus restored to the trigger. Close buttons have an
  accessible name and are ≥44px. One scroll container per sheet.
- **Avatar**: image when `avatar_url` exists, token initials otherwise (same treatment
  everywhere). Identity avatars get `alt="{name}"`; decorative avatars `alt=""`. No external
  avatar services (`ui-avatars.com` is banned).
- **Page header**: eyebrow (optional) + `h1` + description (optional) + actions (optional).
  Exactly one `h1` per route, matching the navigation label.
- **Loaders**: skeletons matched to layout (`shared/ui/skeleton.jsx`) for page/panel loading;
  in-place actions use a disabled control with an inline progress label. No circular spinners.
- **Empty vs error**: empty data renders `EmptyState`; a failed fetch renders a distinct error
  state with a retry action. Never render a failure as "no data".
- **Status**: icon or dot + text, never color alone. Status badges use the `success` /
  `warning` / `danger` tokens.
- **Trust score**: always `{score}/100` with tabular numerals, one format across surfaces.
- **Pills / tags**: `rounded-full` or `rounded-xl`, `text-nano`/`text-2xs`, token colors only.

---

## 6. Layout

- Grid-first. Provider directory `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`; profile
  `grid-cols-1 lg:grid-cols-3` (sidebar + content), `max-w-5xl mx-auto`.
- Containment: content `max-w-5xl`, landing `max-width: 1400px`, sheet `sm:max-w-lg`,
  modal `max-h-[92dvh]`, sheet padding `pb-[max(1.25rem,env(safe-area-inset-bottom))]`.
- Full height uses `min-h-[100dvh]`; `h-screen` is banned.
- No horizontal overflow at any of 375 / 390 / 768 / 1024 / 1440 (gate 11).
- Marketing feature rows must be asymmetric (bento 5/4/3 or 7/5); three equal cards are banned.
  Equal cards are allowed only for the clinical directory.
- Landing hero is split/asymmetric: headline and copy on one side, image/CTA surface on the
  other. A centered hero is not the default.
- Overlays are the only `fixed inset-0` roots. Z-index is assigned from the documented ramp;
  ad-hoc `z-[9999]`-style escalation is banned (gate 9).
- Dashboard rhythm: `space-y-5`, mobile `dashboard-main padding-bottom: 5rem`, and the mobile
  bottom nav hides while a modal is open.

---

## 7. Motion

- Easing: `ease-fluid` `cubic-bezier(0.32, 0.72, 0, 1)`, 200–700ms. No linear/ease-in-out.
- Entrance: `animate-fade-in` or a spring `{opacity, y}` transition. Sheets slide from the
  bottom; overlays fade.
- Tactile: `active:scale-[0.98]`, hover lift `-translate-y-0.5` with a diffused shadow.
- Auto-moving content (carousels, marquees) needs pause on hover/focus, an explicit
  play/pause control, and a full stop under `prefers-reduced-motion` (WCAG 2.2.2).
- Animate transform/opacity only. All motion must respect `prefers-reduced-motion`.

---

## 8. Responsive

- Verify every screen at 375, 390, 768, 1024, 1440 in light and dark.
- Mobile (<768px): multi-column grids collapse to one column; action footers become
  `grid-cols-2` with a primary spanning both when needed.
- All interactive targets ≥44px, including icon-only buttons (gate 8).
- Sheets: mobile bottom sheet `rounded-t-[2.25rem]`, desktop centered.
- Images: avatars `w-12`–`w-28`; hero images stack below the headline on mobile.

---

## 9. Accessibility contract

- Labels, dialog semantics, contrast, 44px targets, heading order, and visible focus are
  non-negotiable, even where they fight the shipped look.
- Focus: `:focus-visible` renders a 3px `var(--focus-ring)` outline with 2px offset. Never
  remove it; never replace it with a low-contrast shadow.
- Exactly one `h1` per route; no decorative heading above it.
- Images carry `alt` (empty alt only for decorative).
- Motion, carousels, and dialogs follow sections 5 and 7.

---

## 10. Anti-Patterns (Banned)

- Emojis anywhere in UI, code, alt text, or confirm dialogs.
- Purple/violet/indigo, neon gradients, oversaturated accents (>80% saturation).
- Pure black `#000000`; use `ink`.
- `Inter` or generic serif fonts.
- `#94A3B8` as a text color.
- Three-equal-card marketing rows; centered hero by default.
- `h-screen`; use `min-h-[100dvh]`.
- Circular spinners where a skeleton or inline progress belongs.
- Zombie utilities that do not exist (`text-4xs`, `shadow-xs`).
- Ad-hoc z-index escalation (`z-[9999]`, `z-[10000]`, `z-[99999]`).
- Nested scroll inside a scrolling sheet; more than one scroll container per overlay.
- More than one primary CTA per screen, sheet, or modal.
- Coral beside a blue primary on the same view.
- Placeholder-only inputs; icon-only buttons named only by a `title` tooltip.
- `window.confirm` for destructive or irreversible actions.
- Fabricated data (provider hours, verification labels) presented as fact.
- Generic filler copy: Elevate, Seamless, Unleash, Next-Gen, Revolutionize.
- Generic names (John Doe, Acme, Nexus); use Filipino clinical context.
- Broken Unsplash links; use `picsum.photos/seed/{id}/800/600` or token initials.
- MuntiCares-specific: no initials avatar when `avatar_url` exists, no 3-button footer without
  hierarchy, no trust breakdown without a summary, no booking without the consent checkbox.

---

## 11. Gate Mapping

| Rule | Gate |
|---|---|
| Every control labeled | 1 |
| Dialog semantics + focus trap on all overlays | 2 |
| Text floor (12px / 14px, eyebrows excepted) | 3, 4 |
| Contrast at ≥12px | 5 |
| Exactly one `h1` per route | 6 |
| `alt` on images | 7 |
| 44px targets on listed controls | 8 |
| Banned classes (`h-screen`, `text-4xs`, `shadow-xs`, `z-[9…]`, `#000`, purple, `ui-avatars.com`) | 9 |
| No new console/page errors | 10 |
| No horizontal overflow | 11 |
