# Design System: MuntiCares — Trusted Home Care Network

**Project:** MuntiCares (Muntinlupa home-care: patient / provider / admin dashboards)
**For:** Google Stitch screen generation — single source of truth

---

## Configuration — Set Your Style

| Dial | Level | Description |
|------|-------|-------------|
| **Creativity** | `6` | `1` = Ultra-minimal Swiss. `5` = Balanced clean with personality. `10` = Expressive editorial. MuntiCares sits at `6`: clinical trust first, premium detailing second |
| **Density** | `5` | `1` = Gallery-airy. `5` = Daily App Balanced. `10` = Cockpit-dense. Patient directory + dashboards need balanced density |
| **Variance** | `6` | `1` = Predictable symmetric. `5` = Subtle offsets. `10` = Artsy chaotic. Use `6`: offset asymmetric for landing/hero, stable grids for clinical lists |
| **Motion Intent** | `6` | `1` = Static. `5` = Subtle hover/entrance. `10` = Cinematic. Fluid spring-physics, never theatrical in clinical flows |

> **How to use:** Stitch must read this entire file before generating any screen. At Density 5 / Variance 6, expect stable card grids and sidebar+content profiles with one asymmetric accent (cover mesh, overlapping avatar), not chaotic editorial layouts.

---

## 1. Visual Theme & Atmosphere

A clinical yet warm interface with confident, calm asymmetry and fluid spring-physics motion. The atmosphere is like a well-lit neighborhood clinic fused with a modern architecture studio — every element earns its place through function.

Density is balanced (Level 5): provider grids breathe but stay scannable. Variance is offset-asymmetric (Level 6): stable 1/2/3-col grids + sidebar profile, broken only by the ink cover with ambient mesh and overlapping avatar. Motion is fluid but restrained (Level 6): fade-in waterfalls, bottom-sheet slide, tactile button push. The overall impression: safe, expensive, alive — never playful, never neon, never generic SaaS.

Priority screens: `Find a Provider` grid, Provider Details bottom-sheet, Full `ProviderProfileView` sidebar + tabs, Booking modal (form -> confirm).

## 2. Color Palette & Roles

Single-accent system. Never mix warm/cool grays. Never use pure black.

- **Clinical Canvas** (#F0F7FF) — Primary light background surface (`secondary`). App body base
- **Pure Surface** (#FFFFFF) — Card and sheet fill. Used at 80% with blur: `bg-white/80 backdrop-blur-xl`
- **Off-Black Ink** (#0B1526) — Cover header base (`ink`), primary dark text alternative. Never #000000
- **Slate Night** (#0F172A / slate-900) — Dark mode canvas. Cards become `dark:bg-slate-900/80`, `dark:bg-slate-800/80`
- **Charcoal Text** (#18181B) — Primary text depth (Zinc-950). Headings `text-slate-900 dark:text-slate-100`
- **Muted Steel** (#64748B / #71717A) — Secondary text, descriptions, `text-slate-500 dark:text-slate-400`
- **Faint Slate** (#94A3B8) — Tertiary text, timestamps, disabled, placeholder
- **Whisper Border** (rgba(0,0,0,0.05) light / rgba(255,255,255,0.10) dark) — `ring-1 ring-black/5 dark:ring-white/10`, `border-slate-100 dark:border-slate-700`. 1px structural lines only
- **Clinical Trust Blue** (#1E6FBF) — THE single accent. CTAs, active states, focus rings, links. Saturation <80%
  - 50 (#EFF6FF) — pill washes, service tags `bg-blue-50 dark:bg-blue-900/30`
  - 100 (#DBEAFE), 200 (#BFDBFE), 300 (#93C5FD), 400 (#60A5FA)
  - 500 (#2E86DE), 600 (#1E6FBF DEFAULT), 700 (#1A5A9E hover), 800 (#1E4A80), 900 (#1E3A5F)
- **Trust Signal Green** (#22C55E / green-500) — Approved, verified, online dot, completion. Backgrounds `bg-green-50 dark:bg-green-900/30`
- **Caution Amber** (#F59E0B / amber-500) — Developing trust 40-69, pending approval, `bg-amber-100 dark:bg-amber-900/30`
- **Critical Rose** (#EF4444) — Banned, rejected, errors only. Never for decoration
- **Star Amber** (#FBBF24 / amber-400) — Rating stars `fill-current` only
- **Diffused Shadow Blue** (rgba(30,111,191,0.18)) — `shadow-soft: 0 24px 80px -24px rgba(30,111,191,0.18)`, `shadow-softer: 0 12px 40px -12px rgba(11,21,38,0.12)`, `shadow-card: 0 8px 32px rgba(30,111,191,0.08)`. Tint shadows to background hue. Wide + soft, never harsh

### Banned Colors
- Purple/violet neon gradients — the AI Purple aesthetic is strictly BANNED
- Pure Black (#000000) — always Off-Black (#0B1526) or Zinc-950 (#18181B)
- Second accent alongside Trust Blue. Max 1 accent per screen
- Oversaturated accents above 80% saturation, neon outer glows

## 3. Typography Rules

- **Display:** `Cabinet Grotesk`, `Clash Display`, `Plus Jakarta Sans` fallback — Track-tight (`-0.02em` to `-0.03em`), weight 700-800, `font-display` class. Controlled scale: page H1 `text-2xl md:text-[1.75rem]`, profile name `text-xl md:text-2xl`, sheet name `text-sm md:text-xl`. Leading compressed (`1.02-1.1`). Hierarchy through weight + color, not massive size. `text-wrap: balance` for heroes
- **Body:** `Outfit`, `Plus Jakarta Sans` — Weight 400-600, relaxed leading (`1.75` app body, `1.65` cards), `text-sm md:text-sm`, secondary color `text-slate-600 dark:text-slate-300`. Max 65ch per line. Eyebrow labels: `text-2xs uppercase tracking-wider font-bold text-slate-400`
- **Mono / Numbers:** System tabular or `JetBrains Mono` for trust scores (`{score}/100`), timestamps. When density exceeds 7, all numbers must use monospace
- **Scale tokens:** `3xs 0.5625rem`, `2xs 0.625rem`, `nano 0.6875rem`, `xs/sm/base` standard. Never shrink body below `14px` / `0.875rem`

### Banned Fonts
- `Inter` — BANNED in premium contexts. Use `Outfit` + `Cabinet Grotesk`
- Generic serifs (`Times New Roman`, `Georgia`, `Garamond`, `Palatino`) — BANNED. Serif is always BANNED in dashboards/clinical UIs. If editorial serif ever needed, only `Fraunces`, `Gambarino`, `Editorial New`, `Instrument Serif`

## 4. Component Stylings

* **Buttons:** Fully rounded pills `rounded-full`. Flat, no outer glow. Primary: `btn-primary` — Trust Blue fill + white text + `shadow-lg shadow-primary/20`, hover `bg-primary-700 + shadow-soft`, active `scale-[0.97-0.98]` tactile push + ripple. Secondary: `btn-outline` — `border-primary/30 text-primary`, hover fill blue + white text. Ghost icon island: `btn-island-icon w-8 h-8 rounded-full bg-black/5`. Destructive: red-50 wash + red-700 text + red-200 border. Disabled pending: `bg-green-50 dark:bg-green-900/30 text-green-700 cursor-not-allowed shadow-none`. Min touch target `44px`, mobile full-width. Max 1 primary CTA per sheet/modal
* **Cards / Provider Grid Cards:** `bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-5 rounded-[1.25rem] border border-black/5 dark:border-white/10 shadow-softer hover:shadow-soft hover:-translate-y-0.5 hover:border-primary/20 transition-all duration-500`. Structure: avatar row (12x12 rounded-xl blue-50 initials or avatar image + online dot) -> name + 5-star row -> trust bar -> service pills -> location -> full-width CTA. Grid: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`. Never span/featured cards in directory
* **Bottom Sheet (Provider Details):** `fixed inset-x-0 bottom-0 rounded-t-[2rem] sm:max-w-lg sm:mx-auto sm:bottom-4 sm:rounded-[2.5rem] max-h-[85vh] overflow-y-auto`. Grab handle `mx-auto h-1 w-10 rounded-full bg-slate-200 sm:hidden`. Cover: `h-20 bg-ink + mesh-ambient` with radial glows + dot pattern, avatar overlap `-mt-10 w-16 h-16 rounded-2xl ring-4 ring-white`. Single scroll only — NO nested inner scroll. Sticky footer: `sticky bottom-0 bg-white/80 backdrop-blur-xl border-t` with 2 buttons only (`View Profile` outline + `Book Appointment` primary). No 3-button `Close` redundancy — rely on overlay/X
* **Trust Score:** Label `text-2xs uppercase font-bold text-slate-400` + value `text-2xs font-bold`. Bar `h-1.5 md:h-2 bg-slate-100 dark:bg-slate-700 rounded-full`, fill `bg-green-500 >=70 / bg-amber-500 >=40 / bg-slate-400 else`. Sheet shows 1-line summary + collapsible breakdown; full profile shows badge (`Highly Trusted >=90 emerald / Trusted >=70 green / Developing >=40 amber / Needs Improvement red`)
* **Pills / Tags:** Services `px-2.5 py-1 bg-slate-50 dark:bg-white/5 text-slate-600 rounded-lg text-nano font-semibold border border-black/5`. Specializations `bg-blue-50 text-primary border-blue-100 rounded-xl text-xs font-bold`. Verified `ShieldCheck + Verified text-2xs font-bold text-blue-600`. Status: Approved green-100 / Pending yellow-100 / Banned red-100 / Incomplete slate-100, `rounded-full text-2xs uppercase tracking-widest` + pulsing `status-dot`
* **Inputs/Forms:** Label above (`text-xs font-semibold ml-1`), input `bg-slate-50 dark:bg-slate-900 border rounded-xl py-3 px-3 focus:ring-2 focus:ring-primary/20 focus:border-primary`. Bare search: `search-bare h-11 bg-transparent border-0 border-b rounded-none pl-8` — no glow on focus. Error text below `text-nano text-red-500`. Consent box `bg-blue-50/50 border-blue-100 rounded-xl flex gap-2.5`. No floating labels
* **Tabs / Segments:** Container `flex gap-1 p-1 bg-slate-100 dark:bg-slate-700/50 rounded-2xl`, trigger `flex-1 px-2 py-2.5 rounded-xl text-2xs md:text-sm`, active `bg-white dark:bg-slate-800 text-primary shadow-sm`
* **Reviews:** Quote card `p-2 bg-slate-50 dark:bg-slate-900 border rounded-xl`, name `text-nano font-bold`, stars `w-2.5 h-2.5`, text italic `“...”`. Show top 2-3 + View-all link. Never inner `max-h-[120px]` scroll inside a scrolling sheet
* **Loaders:** Skeletal shimmer matching exact layout (`skeleton` gradient `90deg #f1f5f9/#e2e8f0`, dark `#1e293b/#334155`, `skeleton-shimmer 1.5s`). No circular spinners
* **Empty States:** Composed `EmptyState icon/title/message variant=compact` in `rounded-[2rem] border` container. Never bare No data text

## 5. Layout Principles

- Grid-first: CSS Grid for directories and profiles. Never flexbox percentage math. Provider grid `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3`, profile `grid grid-cols-1 lg:grid-cols-3 gap-6` (sidebar 1col + content 2col, `max-w-5xl mx-auto`)
- No overlapping except intentional avatar-over-cover. Every element occupies its own grid cell. No absolute-stacked content-on-content, no z-index spam (only navbar/modal/overlay)
- Feature rows: the generic 3-equal-cards row is BANNED. Use uniform clinical cards for directory (equal is correct there), asymmetric bento or 70/30 split only for marketing/feature sections
- Containment: app `max-w-full`, content `max-w-5xl`, sheet `sm:max-w-lg`, landing `max-width: 1400px centered`. Internal padding `p-4 md:p-6` sheets, `p-6 md:p-8` cards
- Full-height: `min-h-[100dvh]` — never `h-screen` (iOS Safari jump). Sheet `max-h-[85vh]`, modal `max-h-[92dvh]`, `pb-[max(1.25rem,env(safe-area-inset-bottom))]`
- Bezel system for premium nesting: outer `bezel bg-black/[0.04] ring-1 p-1.5 rounded-[2rem]` + inner `bezel-inner bg-white rounded-[calc(2rem-0.375rem)]`. Eyebrow pill above H1: `eyebrow rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.2em] bg-primary/10 text-primary-700 ring-1 ring-primary/20`
- Dashboard rhythm: `space-y-5`, header row `flex-col md:flex-row md:items-end justify-between`, `dashboard-main padding-bottom: 5rem` on mobile for bottom nav, `body.modal-open #mobile-bottom-nav display:none`

## 6. Motion & Interaction (Code-Phase Intent)

> Stitch generates static screens — it does not animate. This section is implementation intent for Cursor/Antigravity/Gemini CLI after export.

- **Physics:** Spring-based exclusively `stiffness: 100, damping: 20`. Easing `ease-fluid: cubic-bezier(0.32,0.72,0,1) duration-700`. No linear/ease-in-out anywhere
- **Entrance:** Cards `animate-fade-in (opacity 0 + translateY 12px -> 0, 0.35s)` with cascade `animation-delay: min(index,8)*40ms`. Modals `initial {opacity:0,y:16} animate {opacity:1,y:0}`. Sheet `slide-in-from-bottom`, overlay `fade-in-0`
- **Perpetual micro-loops:** Online dot `status-dot dot-pulse 2s infinite`, avatar hover `card-icon-animate icon-bounce 0.6s`, skeleton `skeleton-shimmer 1.5s infinite`, hero blobs `blob-float 8-12s infinite`, float `float 3s infinite`. Every active component has one infinite state
- **Tactile:** Buttons `active:scale-[0.97]` + ripple `scale 0->2.5 fade`. Cards `hover:-translate-y-0.5 hover:shadow-soft`. Links `link-underline background-size 0%->100%`
- **Hardware rules:** Animate ONLY `transform` + `opacity`. Never `top/left/width/height`. Grain `grain::before radial-gradient 18px` on fixed pseudo-element only, `pointer-events:none`. Isolate heavy loops in leaf components, target 60fps, respect `prefers-reduced-motion: reduce` (kill all animation)

## 7. Responsive Rules

Every screen must be verified at 375px, 390px, 768px, 1024px, 1440px. Responsive is a hard requirement.

- **Mobile collapse (<768px):** All multi-column grids -> single column `width:100% padding:1rem gap:1.5rem`. Profile `lg:grid-cols-3` stacks, action footer `grid-cols-2` with Book spanning `col-span-2 sm:col-span-1`. Buttons full-width `w-full py-3.5`
- **No horizontal scroll:** `overflow-x-hidden w-full max-w-full` on page roots. Critical failure if violated
- **Typography:** Headlines via `clamp(2.75rem,4vw,4.25rem)` heroes / `text-sm md:text-xl` cards. Body never below `14px`. Reviews `text-nano md:text-xs`
- **Touch:** All interactive `min 44px` (`h-11`, `py-3.5`, `p-2.5`). Generous gaps `gap-2 md:gap-3`
- **Sheets/modals:** Mobile bottom-sheet `rounded-t-[1.5rem] items-end`, desktop centered `md:rounded-[1.5rem] md:items-center md:max-w-lg`. Grab handle hidden on desktop
- **Images:** Avatar `w-12 h-12 md:w-16 md:h-16`, profile `w-24 h-24 md:w-28 md:h-28 rounded-full border-4 border-white object-cover`. Inline hero images stack below headline on mobile, never overlap text
- **Nav:** Desktop horizontal/sidebar collapses to bottom-nav + slide-in menu on mobile. No tiny unlabeled hamburger
- **Spacing:** Section gaps `clamp(3rem,8vw,6rem)` desktop -> proportionally reduced mobile, never cramped

## 8. Anti-Patterns (Banned)

- No emojis anywhere in UI, code, or alt text
- No `Inter` font — use `Outfit`, `Plus Jakarta Sans`, `Cabinet Grotesk`, `Clash Display`
- No generic serifs (`Times New Roman`, `Georgia`, `Garamond`, `Palatino`) — modern distinctive serifs only if editorial, never in clinical dashboards
- No pure black (#000000) — use Ink (#0B1526) or Zinc-950 (#18181B)
- No neon outer glows, purple/blue neon gradients, oversaturated accents >80%
- No excessive gradient text on large headers — max subtle mesh ambient
- No custom mouse cursors
- No overlapping elements — clean spatial separation always (except avatar-over-cover)
- No 3-column equal feature rows for marketing sections; uniform cards only for clinical directory
- No centered hero when variance >4 — use split/asymmetric
- No filler text: Scroll to explore, Swipe down, Discover more, scroll arrows, bouncing chevrons
- No generic names (John Doe, Acme, Nexus) — use Filipino clinical context (Muntinlupa City, General Care)
- No fake round numbers (99.99%, 50%) — use organic trust scores
- No AI copy clichés: Elevate, Seamless, Unleash, Next-Gen, Revolutionize
- No broken Unsplash links — use `picsum.photos/seed/{id}/800/600` or initials SVG avatars
- No generic shadcn defaults — radii `1.25rem-2.5rem`, Trust Blue, whisper shadows required
- No nested scroll inside scrolling sheets, no `h-screen` (use `min-h-[100dvh]`), no circular spinners (skeleton only), no z-index spam
- MuntiCares-specific: no initials-only avatar when `avatar_url` exists, no 3-button footer without hierarchy, no trust breakdown dump without summary, no booking without consent checkbox
