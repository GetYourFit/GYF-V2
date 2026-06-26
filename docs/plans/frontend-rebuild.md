# GYF Frontend — Industrial-Grade Rebuild Plan

> **Objective.** Redesign the GYF product surface from the current warm-beige editorial style
> to a clean, modern, black-and-white industrial design that matches the aesthetic of
> [getyourfit.tech](https://getyourfit.tech) — then build out every missing page and feature
> to bring the frontend to production/launch quality.
>
> **Constraint.** Backend API contracts (`@gyf/types`, FastAPI endpoints) are fixed — this
> plan touches only the `app/` Next.js package. No backend changes required.

---

## 0. Current State Audit

### What exists

| Path | Description | Quality |
|---|---|---|
| `app/(app)/page.tsx` | Stylist feed (outfit recommendations) | ✅ Logic solid, needs restyle |
| `app/(app)/onboarding/page.tsx` | Manual + photo onboarding | ✅ Logic solid, inconsistent styles |
| `app/(app)/saved/page.tsx` | Saved looks placeholder | ⚠️ Empty shell only |
| `app/(auth)/login/page.tsx` | Login | ✅ Functional |
| `app/(auth)/signup/page.tsx` | Signup | ✅ Functional |
| `components/stylist/stylist-feed.tsx` | Feed + skeleton + undo | ✅ Keep logic, restyle |
| `components/stylist/outfit-card.tsx` | Outfit card (images + actions) | ✅ Keep logic, restyle |
| `components/stylist/stylist-controls.tsx` | Goal + occasion filter bar | ✅ Keep logic, restyle |
| `components/stylist/confidence-meter.tsx` | Confidence indicator | ✅ Keep, restyle |
| `components/onboarding/onboarding-form.tsx` | Profile form | ✅ Logic solid, mixed styles |
| `components/onboarding/photo-upload.tsx` | Photo estimation upload | ✅ Keep, restyle |
| `components/layout/app-nav.tsx` | Top navigation | ✅ Functional, restyle |
| `components/ui/` | button, field, input, select | ⚠️ Minimal, needs complete overhaul |
| `lib/fonts.ts` | Cormorant + DM Sans + DM Mono | 🔄 Replace font stack |

### Critical gaps (missing pages)
- **Explore / Discover** — catalog browsing beyond AI picks
- **Wardrobe** — user's own garments
- **Social / Socials** — posts, style sharing, following
- **Profile** — public profile, badges, gamification
- **Virtual Try-On** — see outfit on your own photo
- **Collections** — organized saved looks (Saved page is a placeholder)

### Style inconsistency
The codebase has a **split personality**: `globals.css` uses warm beige CSS vars (`--bg: #F0ECE2`, `--gold: #8B6B3E`) while `tailwind.config.ts` has a dark monochrome palette (`bg: #0A0A0A`). The onboarding form uses vanilla Tailwind (`bg-white`, `rounded-2xl`, `border-neutral-200`) while stylist components use the CSS vars. **This must be unified.**

---

## 1. Design System — Black & White Industrial

> Inspired by getyourfit.tech: pure monochrome, sharp edges, editorial typography,
> precise spacing. No warm tones, no beige, no gold. Clean. Modern. Confident.

### 1.1 Color Tokens

**Completely replace `globals.css` and `tailwind.config.ts`.**

```css
/* globals.css — new token set */
:root {
  /* Backgrounds */
  --bg:          #0A0A0A;   /* page canvas — near-black */
  --surface:     #111111;   /* card / panel surface */
  --surface-2:   #1A1A1A;   /* elevated surface (modals, dropdowns) */
  --surface-3:   #222222;   /* hover state on surfaces */

  /* Borders */
  --border:      rgba(255,255,255,0.06);   /* subtle structural border */
  --border-mid:  rgba(255,255,255,0.12);   /* medium border */
  --border-hi:   rgba(255,255,255,0.22);   /* high-contrast border */

  /* Text */
  --text:        #F0F0F0;   /* primary text */
  --text-mid:    #999999;   /* secondary / muted */
  --text-faint:  #555555;   /* placeholder / disabled */

  /* Accent */
  --accent:      #FFFFFF;   /* pure white — CTA, active states */
  --accent-warm: #C8A96E;   /* reserved only for confidence / editorial callouts */

  /* Utility */
  --rule:        rgba(255,255,255,0.07);   /* dividers */
  --lux:         cubic-bezier(0.16, 1, 0.3, 1);
}
```

```ts
// tailwind.config.ts — aligned to CSS vars
colors: {
  bg:           'var(--bg)',
  surface:      'var(--surface)',
  'surface-2':  'var(--surface-2)',
  'surface-3':  'var(--surface-3)',
  border:       'var(--border)',
  'border-mid': 'var(--border-mid)',
  'border-hi':  'var(--border-hi)',
  text:         'var(--text)',
  'text-mid':   'var(--text-mid)',
  'text-faint': 'var(--text-faint)',
  accent:       'var(--accent)',
  'accent-warm':'var(--accent-warm)',
  rule:         'var(--rule)',
}
```

### 1.2 Typography

**Replace Cormorant + DM Sans with a sharper, industrial editorial stack.**

| Role | Font | Usage |
|---|---|---|
| Display | **Playfair Display** (400/700 italic) | Hero headings, outfit names, editorial moments |
| Body | **Inter** (300/400/500/600) | All UI copy, labels, nav |
| Mono | **JetBrains Mono** (400) | Confidence scores, metadata, badges, status |

Sizing scale uses `clamp()` for fluid responsive type. No `text-xs` scattered inline — use semantic classes via `@layer components`.

```css
/* @layer components — semantic type classes */
.t-display  { font: 500 clamp(2.25rem, 5vw, 4rem)/1.05 var(--font-display); letter-spacing: -0.02em; }
.t-headline { font: 400 clamp(1.5rem, 3vw, 2.25rem)/1.1 var(--font-display); }
.t-title    { font: 500 1.125rem/1.3 var(--font-body); letter-spacing: -0.01em; }
.t-body     { font: 400 0.9375rem/1.6 var(--font-body); }
.t-caption  { font: 400 0.75rem/1.4 var(--font-body); letter-spacing: 0.01em; }
.t-label    { font: 500 0.6875rem/1 var(--font-body); letter-spacing: 0.22em; text-transform: uppercase; }
.t-mono     { font: 400 0.6875rem/1 var(--font-mono); letter-spacing: 0.08em; }
```

### 1.3 Spacing & Layout

- Max content width: `1280px` (wide enough for a 3-column card grid)
- Horizontal gutter: `clamp(1.25rem, 5vw, 3rem)`
- Base spacing unit: `4px` (Tailwind default — use scale values, never magic numbers)
- Card border-radius: `0` (sharp corners — industrial, not rounded-card style)
- Inputs: `0` border-radius, `1px solid var(--border-mid)` underline or full border

### 1.4 Motion

All animations use `var(--lux)` easing. Defaults:

| Interaction | Duration | Property |
|---|---|---|
| Hover / active | `180ms` | `color`, `border-color`, `background` |
| Card image zoom | `500ms` | `transform: scale(1.03)` |
| Page entrance | `400ms` | `opacity` + `translateY(8px)` via Framer Motion |
| Modal / sheet | `300ms` | `opacity` + `translateY(12px)` |
| Skeleton pulse | `1.4s` | Custom keyframe with `background-position` |

### 1.5 Shared Components to Rebuild (`components/ui/`)

Every primitive must be built to the new token set with full keyboard/a11y support.

| Component | Notes |
|---|---|
| `Button` | Variants: `primary` (white fill, black text), `ghost` (border only), `danger` (destructive), `icon`. Sizes: `sm`, `md`, `lg`. |
| `Input` | Black bg, white text, border-bottom underline + full border variant. Focus ring: `1px solid var(--accent)`. |
| `Select` | Custom styled, keyboard accessible, uses Radix UI `Select`. |
| `Field` | Label + input composition with error/hint slot. |
| `Badge` | Monospace pill. Variants: `default`, `warm`, `muted`. |
| `Chip` | Toggle chip for multi-select (style intents, occasions). Replaces ugly `rounded-full` buttons. |
| `Skeleton` | Dark skeleton with shimmer keyframe. |
| `Meter` | Confidence / progress bar. Thin, white-on-dark. |
| `Divider` | `1px solid var(--rule)` horizontal rule. |
| `Sheet` / `Modal` | Slide-up on mobile, centered on desktop. Radix Dialog. |
| `Toast` | Error / success / info. Bottom-right. Radix Toast. |
| `Avatar` | Circular, monogram fallback. Sizes `sm`, `md`, `lg`. |
| `Tag` | Read-only label. Uppercase, monospace, minimal. |

---

## 2. Page & Route Architecture

```
app/
├── (marketing)/         # public, no auth gate (future: landing page lives here)
├── (auth)/
│   ├── login/           # exists — restyle only
│   └── signup/          # exists — restyle only
└── (app)/               # auth-gated product surface
    ├── layout.tsx        # AppShell: sidebar nav + content area
    ├── page.tsx          # /  → Stylist feed (exists — restyle + enhance)
    ├── onboarding/       # exists — restyle + enhance
    ├── saved/            # exists as placeholder — implement
    ├── wardrobe/         # NEW
    ├── explore/          # NEW
    ├── social/           # NEW
    ├── profile/          # NEW (own profile)
    ├── profile/[id]/     # NEW (public profile)
    └── try-on/           # NEW (behind feature flag initially)
```

### Navigation model

**Desktop**: fixed left sidebar (`240px` wide) — logo, nav links, profile thumbnail, sign-out.
**Mobile**: bottom tab bar (5 items max) — hidden on auth/onboarding pages.

Nav items (in order):

| Icon | Label | Route |
|---|---|---|
| Sparkles | Stylist | `/` |
| Compass | Explore | `/explore` |
| BookmarkSimple | Saved | `/saved` |
| Shirt | Wardrobe | `/wardrobe` |
| Users | Social | `/social` |
| User | Profile | `/profile` |

---

## 3. Page Specifications

### 3.1 Auth Pages (Login / Signup)

**Design:** Full-viewport split. Left half: large Playfair Display headline ("Dress better. Every day."), background image or abstract dark gradient. Right half: the form on `--surface` panel.

**Components:**
- `AuthForm` (exists) — restyle to new tokens
- Email + password inputs (existing `Input` component, restyled)
- `Button` primary variant
- Link to signup/login toggle
- Google OAuth button (if configured)

**Animations:** Form panel slides in from right on mount.

---

### 3.2 Onboarding (existing — enhance)

**Design:** Single-column, max `640px`, dark surface panels replacing `bg-white rounded-2xl`. Progress indicator at top (4 steps: You → Style → Budget → Privacy).

**UX upgrade:**
- Replace plain form sections with a **stepped wizard** (one section per screen, smooth step transitions via Framer Motion).
- **Photo upload** gets a large drag-and-drop zone with animated border on hover.
- **Style intent chips** replace `rounded-full` buttons — use new `Chip` component.
- Pre-filled fields show a subtle "estimated from photo" `Tag` badge.
- Final CTA: "Meet your stylist →" transitions to the feed.

**Keep:** All form logic, `applyEstimated`, `ProfileInput`, consent handling, `photoUpload` API calls.

---

### 3.3 Stylist Feed (existing — restyle + enhance)

**Design:** Full-width content area with sidebar nav visible. Header: `t-display` headline + status line.

**Layout:**
- Controls bar: goal input (full-width) + occasion select inline, styled with industrial border treatment.
- Grid: `3-col` on `lg`, `2-col` on `md`, `1-col` on `sm`. No `gap-px` hack — use `gap-5` with explicit card borders.

**OutfitCard redesign:**
- Sharp black card on `--surface`.
- Garment images: keep side-by-side, but add a subtle overlay label (`TOP`, `BOTTOM`, `SHOES`) using `t-mono` in a `Badge`.
- Explanation text: Playfair Display italic, `t-headline` size, white.
- Confidence meter: thin white bar, percentage in `t-mono`.
- Action row: `Save look` (ghost button), `Shop` (primary), `✕` (icon ghost).
- Hover: `border-color` transitions to `--border-hi`, subtle `box-shadow: 0 0 0 1px var(--border-hi)`.

**Skeleton:** Dark shimmer skeletons that respect the card aspect ratio.

**Status line:** mono pill badges — "Cold start", "Personalized", "Taste 72%" — white border, `t-mono`.

**Keep:** All API logic, feedback, save/dismiss/undo handlers, `StylistQuery`.

---

### 3.4 Saved / Collections (currently a placeholder — implement)

**Data source:** `GET /profile/saved` (to be confirmed with API) or filter interactions where `action=save`. Initially client-driven: re-fetch outfit data from stored IDs.

**Design:** Masonry-style `2-col` grid on desktop, `1-col` on mobile. Each saved look renders a compact `SavedCard` (image thumbnails strip + outfit name + date saved + "Remove" icon).

**Empty state:** Centered illustration-free callout — "No saved looks yet. Head to your stylist." with CTA button.

**Sections (future):** Group by occasion or date. Initially: flat chronological list, newest first.

---

### 3.5 Wardrobe (new page)

> Stores the user's own garments — GYF styles *around* their real closet.

**Route:** `/wardrobe`

**Design:** Grid of user-uploaded garment cards + an "Add garment" CTA always visible.

**Add garment flow (Sheet/Modal):**
1. Upload photo (drag-and-drop zone — reuse `PhotoUpload` pattern).
2. Auto-classify: call `POST /wardrobe/items` with image → API returns `category`, `color`, `title` estimate.
3. User confirms/edits fields.
4. Item appears in grid immediately (optimistic).

**Garment card:**
- Image (3:4 ratio), `--surface` background.
- Category `Tag` top-left.
- Brand / title below image.
- Delete icon on hover.

**Sections:** Filter chips by category (Tops / Bottoms / Shoes / Accessories). Active filter highlights in white.

**Integration with Stylist:** A toggle on the Stylist feed — "Style around my wardrobe" — passes `wardrobe_mode: true` to the recommend endpoint when the feature gate is ready.

---

### 3.6 Explore / Discover (new page)

> Catalog browsing beyond AI picks — discovery mode.

**Route:** `/explore`

**Design:** Full-bleed editorial header ("What's in season.") above a filterable 3-column garment grid.

**Filter bar (sticky below nav):**
- Category: horizontal scroll chips (All, Tops, Bottoms, Dresses, Shoes, Accessories)
- Occasion: select dropdown
- Price range: dual-thumb range input
- Sort: select (Trending / New / Price ↑ / Price ↓)

**Garment card:**
- Image (3:4), sharp corners.
- Brand name in `t-mono`.
- Title in `t-body`.
- Price in `t-mono`.
- Bookmark icon (top-right, ghost → filled on save).

**Infinite scroll** with `IntersectionObserver` — load next page when last row enters viewport. Skeleton cards during load.

**Zero-results state:** "Nothing matches these filters" + reset filters link.

---

### 3.7 Social (new page)

> Style posts — shareable, reactable. Users share looks; followers can dress like them re-rendered to their own profile.

**Route:** `/social`

**Design:** Two-column feed (posts left, trending/who-to-follow right) on desktop. Single column on mobile.

**Post card:**
- Header: Avatar + username + "is wearing" + occasion tag.
- Outfit image grid (same side-by-side as outfit card).
- Stylist explanation in Playfair italic.
- Action bar: ❤ Like (count), 💬 Comment (count), ↗ Share, 👗 "Dress like me" CTA.

**"Dress like me" flow:**
- Opens a modal: "Recreate this look for *your* profile."
- Calls `POST /social/recreate` with post ID → returns a new outfit recommendation conditioned on the follower's skin tone / body type / budget.
- Shows the re-rendered outfit in the modal with a "Save this look" action.

**Create post:**
- Floating `+` button (bottom-right, desktop bottom of sidebar).
- Sheet: pick from saved looks → write caption → publish.

**Trending sidebar:** Top styles this week. Who to follow list (users with most saves/shares).

**Badges panel:** Earned badges displayed on social cards (e.g., "Trendsetter", "Fashion Mogger").

---

### 3.8 Profile (new page)

> Own profile: outfits made, badges earned, style stats.

**Route:** `/profile` (own) and `/profile/[id]` (public view)

**Design:**
- Full-width cover area (dark gradient with subtle noise texture).
- Avatar (large, `96px`) + username + "member since" in `t-mono`.
- Stats row: Outfits made · Looks saved · Followers · Following.
- Badge shelf: horizontal scroll of earned badges (icon + label chips).
- Tabs: Posts | Saved | Wardrobe (public: Posts only).

**Edit profile (own only):**
- Inline edit for username, bio — pencil icon → input state.
- Link to `/onboarding` for style profile changes.

**Badge system:**

| Badge | Trigger |
|---|---|
| Fashion Mogger | 10 looks saved by others |
| Trendsetter | Post reaches 50 likes |
| Early Adopter | First 1,000 users |
| Style Veteran | 100 AI sessions |
| Wardrobe Master | 20+ wardrobe items |

---

### 3.9 Virtual Try-On (new page, behind feature flag)

> See the complete designed outfit on your own photo.

**Route:** `/try-on` (hidden from nav until `FEATURE_TRYON=true`)

**Design:**
- Left panel: upload own photo (full-height drop zone).
- Right panel: pick an outfit from saved looks or current stylist recommendation.
- "Try it on" CTA triggers `POST /try-on` with user photo + outfit IDs.
- Result renders full-height on a dark surface. Confidence badge + explanation. Download button.

**States:** idle → uploading → processing (animated progress ring) → result → error.

**Privacy notice:** "Your photo is processed ephemerally and never stored." Linked to consent settings.

---

## 4. Component Tree

```
app/
├── components/
│   ├── ui/                      # design system primitives (full rebuild)
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx           # Radix UI Select
│   │   ├── field.tsx
│   │   ├── badge.tsx
│   │   ├── chip.tsx
│   │   ├── skeleton.tsx
│   │   ├── meter.tsx
│   │   ├── divider.tsx
│   │   ├── avatar.tsx
│   │   ├── tag.tsx
│   │   ├── sheet.tsx            # Radix Dialog, slide-up
│   │   ├── modal.tsx            # Radix Dialog, centered
│   │   └── toast.tsx            # Radix Toast
│   ├── layout/
│   │   ├── app-shell.tsx        # sidebar + content area wrapper
│   │   ├── sidebar-nav.tsx      # desktop left nav
│   │   ├── bottom-nav.tsx       # mobile tab bar
│   │   └── page-header.tsx      # shared page title + breadcrumb
│   ├── auth/
│   │   └── auth-form.tsx        # restyle only
│   ├── onboarding/
│   │   ├── onboarding-wizard.tsx # stepped wrapper (new)
│   │   ├── onboarding-form.tsx   # keep logic, restyle
│   │   └── photo-upload.tsx      # keep logic, restyle
│   ├── stylist/
│   │   ├── stylist-feed.tsx      # keep logic, restyle
│   │   ├── outfit-card.tsx       # keep logic, restyle
│   │   ├── stylist-controls.tsx  # keep logic, restyle
│   │   └── confidence-meter.tsx  # keep, restyle as Meter
│   ├── saved/
│   │   ├── saved-grid.tsx        # new
│   │   └── saved-card.tsx        # new
│   ├── wardrobe/
│   │   ├── wardrobe-grid.tsx     # new
│   │   ├── garment-card.tsx      # new
│   │   └── add-garment-sheet.tsx # new
│   ├── explore/
│   │   ├── explore-grid.tsx      # new
│   │   ├── explore-card.tsx      # new
│   │   └── filter-bar.tsx        # new
│   ├── social/
│   │   ├── social-feed.tsx       # new
│   │   ├── post-card.tsx         # new
│   │   ├── create-post-sheet.tsx # new
│   │   └── trending-sidebar.tsx  # new
│   ├── profile/
│   │   ├── profile-header.tsx    # new
│   │   ├── badge-shelf.tsx       # new
│   │   └── profile-tabs.tsx      # new
│   └── try-on/
│       ├── tryon-uploader.tsx    # new
│       └── tryon-result.tsx      # new
```

---

## 5. Technical Decisions

### 5.1 Dependencies to add

| Package | Purpose |
|---|---|
| `@radix-ui/react-dialog` | Sheet + Modal |
| `@radix-ui/react-select` | Accessible custom select |
| `@radix-ui/react-toast` | Toast notifications |
| `@radix-ui/react-tabs` | Profile page tabs |
| `@radix-ui/react-slider` | Price range filter |
| `framer-motion` | Page transitions, card entrances (already in tech-stack) |
| `next/font/google` | Playfair Display + Inter + JetBrains Mono |

> All Radix UI packages are MIT-licensed and free. No paid dependencies.

### 5.2 Fonts (replace `lib/fonts.ts`)

```ts
import { Playfair_Display, Inter, JetBrains_Mono } from 'next/font/google'

export const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
})

export const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-body',
  display: 'swap',
})

export const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-mono',
  display: 'swap',
})
```

### 5.3 State management

- **Local UI state**: `useState` / `useReducer` — no external library needed at this scale.
- **Server state / data fetching**: existing `browserApi()` pattern kept. Wrap in a custom `useQuery` hook per resource to share loading/error logic across pages.
- **Feature flags**: env vars (`NEXT_PUBLIC_FEATURE_TRYON`, etc.) read in a `lib/flags.ts` module.

### 5.4 Accessibility

- All interactive elements: keyboard navigable, visible focus rings (`outline: 2px solid var(--accent)`).
- Color contrast: white text on `#0A0A0A` bg exceeds WCAG AA (21:1).
- `aria-busy`, `aria-pressed`, `aria-current` already used in existing components — keep.
- Images: meaningful `alt` text on all garment images.
- Form errors: `role="alert"` (already in place — keep).

### 5.5 Performance

- Images: `next/image` where domain is known; plain `<img loading="lazy">` for dynamic API URLs (current approach — keep for beta).
- Font display: `swap` for all fonts — no layout shift.
- Skeleton loading: shown immediately while data fetches — never show a blank screen.
- Bundle: audit with `next build --analyze` after each new page. Keep JS budget under `150kB` first load.

---

## 6. Implementation Phases

### Phase 1 — Design System Foundation (2–3 days)
**Goal:** Unified token set, rebuilt primitives, restyled shell. No new pages.

- [ ] Replace `globals.css` with new token set (black/white palette)
- [ ] Align `tailwind.config.ts` to CSS vars
- [ ] Replace fonts in `lib/fonts.ts` (Playfair + Inter + JetBrains Mono)
- [ ] Update `app/layout.tsx` with new font variables
- [ ] Rebuild all `components/ui/` primitives (Button, Input, Select, Field, Badge, Chip, Skeleton, Meter, Divider, Avatar, Tag)
- [ ] Add Sheet, Modal, Toast (Radix)
- [ ] Build `components/layout/sidebar-nav.tsx` and `components/layout/bottom-nav.tsx`
- [ ] Build `components/layout/app-shell.tsx` (replaces current `(app)/layout.tsx`)
- [ ] Restyle `AppNav` → remove old nav, wire into AppShell
- [ ] Restyle auth pages (login + signup)

**Definition of done:** All existing pages render with the new design system, zero warm-beige tokens remain, all UI primitives documented.

---

### Phase 2 — Core Pages Restyle (2–3 days)
**Goal:** Bring existing functional pages to production visual quality.

- [ ] Restyle `StylistFeed` — new grid, new status badges, controls bar
- [ ] Restyle `OutfitCard` — sharp dark card, rebuilt action row
- [ ] Restyle `StylistControls` — industrial goal input, clean occasion select
- [ ] Restyle `ConfidenceMeter` → use new `Meter` component
- [ ] Upgrade `OnboardingForm` to stepped wizard with Framer Motion transitions
- [ ] Restyle `PhotoUpload` with new drag-and-drop zone design
- [ ] Restyle all form fields in onboarding to match new `Field` / `Input` / `Select`
- [ ] Restyle `Style intent` toggles as `Chip` components

**Definition of done:** Stylist flow (login → onboarding → feed) is production-quality end-to-end with the new design.

---

### Phase 3 — Saved Collections (1 day)
**Goal:** Replace the placeholder with a real functional page.

- [ ] Build `components/saved/saved-grid.tsx` and `saved-card.tsx`
- [ ] Implement data fetching (saved interactions → outfit details)
- [ ] Empty state design
- [ ] Remove + undo action

---

### Phase 4 — Wardrobe (2 days)
**Goal:** Users can manage their own garments.

- [ ] Build `/wardrobe` route and page
- [ ] Build `components/wardrobe/garment-card.tsx`
- [ ] Build `components/wardrobe/add-garment-sheet.tsx` with `PhotoUpload` reuse
- [ ] Category filter chips
- [ ] Optimistic add / delete

---

### Phase 5 — Explore (2 days)
**Goal:** Catalog discovery beyond AI picks.

- [ ] Build `/explore` route and page
- [ ] Build `components/explore/explore-card.tsx` and `filter-bar.tsx`
- [ ] Category, occasion, price, sort filters
- [ ] Infinite scroll with `IntersectionObserver`
- [ ] Garment bookmark → adds to saved

---

### Phase 6 — Social (3 days)
**Goal:** Style-sharing feed with "Dress like me" re-rendering.

- [ ] Build `/social` route and page
- [ ] Build `components/social/post-card.tsx` (reactions, share, dress-like-me)
- [ ] Build `components/social/create-post-sheet.tsx`
- [ ] Build `components/social/trending-sidebar.tsx`
- [ ] "Dress like me" modal with re-render call

---

### Phase 7 — Profile + Badges (2 days)
**Goal:** Own and public profile views with gamification.

- [ ] Build `/profile` and `/profile/[id]` routes
- [ ] Build `components/profile/profile-header.tsx`, `badge-shelf.tsx`, `profile-tabs.tsx`
- [ ] Badge definitions and display logic
- [ ] Follower / following counts
- [ ] Inline username / bio edit

---

### Phase 8 — Virtual Try-On (2–3 days, behind flag)
**Goal:** Beta try-on surface wired to the existing `POST /try-on` endpoint.

- [ ] Build `/try-on` route (feature-flagged with `NEXT_PUBLIC_FEATURE_TRYON`)
- [ ] Build `components/try-on/tryon-uploader.tsx` and `tryon-result.tsx`
- [ ] Processing state animation (progress ring)
- [ ] Download result image
- [ ] Privacy notice + consent check

---

## 7. Quality Gates

Before any phase is considered complete:

- **Visual:** Page matches the black/white industrial design spec. No warm-beige tokens, no rounded-2xl cards, no `neutral-*` Tailwind classes.
- **Functional:** All API calls work (no mock data in production paths). Empty states handle gracefully.
- **Accessible:** `make ci` passes; keyboard navigation works; focus rings visible.
- **Responsive:** Tested at `375px`, `768px`, `1280px` breakpoints.
- **Performance:** No `console.log` in production; no unused imports; `next build` reports no errors.
- **Types:** `tsc --noEmit` passes with zero errors.

---

## 8. File-Level Change Summary

| File | Action | Notes |
|---|---|---|
| `app/globals.css` | **Rewrite** | New black/white token set |
| `app/tailwind.config.ts` | **Rewrite** | Aligned to CSS vars |
| `lib/fonts.ts` | **Rewrite** | Playfair + Inter + JetBrains Mono |
| `app/layout.tsx` | **Update** | New font variables |
| `components/ui/*` | **Rebuild** | All primitives to new design system |
| `components/layout/app-nav.tsx` | **Replace** | With sidebar-nav + bottom-nav in AppShell |
| `components/stylist/*.tsx` | **Restyle** (logic untouched) | New tokens throughout |
| `components/onboarding/*.tsx` | **Restyle + enhance** | Stepped wizard, new chip components |
| `app/(auth)/*.tsx` | **Restyle** | New split-screen layout |
| `app/(app)/saved/page.tsx` | **Implement** | Replace placeholder |
| `app/(app)/wardrobe/` | **New** | Full page |
| `app/(app)/explore/` | **New** | Full page |
| `app/(app)/social/` | **New** | Full page |
| `app/(app)/profile/` | **New** | Own + public routes |
| `app/(app)/try-on/` | **New** | Feature-flagged |

---

## 9. What Does NOT Change

- `lib/api.ts`, `lib/api-client.ts` — API client logic is untouched
- `lib/supabase/*` — auth infrastructure untouched
- `lib/vocab.ts` — constants untouched
- `lib/cn.ts` — utility untouched
- `middleware.ts` — auth middleware untouched
- `next.config.ts`, `vercel.json` — build config untouched
- All backend contracts (`@gyf/types`, FastAPI endpoints) — strictly out of scope
- All test files — updated only where component APIs change (prop names, etc.)

---

## 10. Guiding Principles for Implementation

1. **No warm tones.** If a class contains `gold`, `amber`, `beige`, `warm`, or `neutral-*`, it does not belong in this codebase.
2. **No border-radius on cards.** Inputs may have `rounded-sm`; cards, panels, and modals are `rounded-none`. Industrial = sharp.
3. **Logic before style.** When restyling existing components, change CSS only — never touch event handlers or API calls in the same commit.
4. **Keep or extend, never duplicate.** Shared primitives live in `components/ui/`. No page-local `Button` variants.
5. **Skeletons before spinners.** Every async surface must show a skeleton immediately. No blank screens, no centered spinners.
6. **Mobile first, then desktop.** Write `sm:`, `md:`, `lg:` modifiers — never assume desktop width.
7. **ECC skills for review.** Use `ecc:react-reviewer` after each phase; `ecc:accessibility` before shipping Phase 1; `ecc:security-reviewer` before any auth-touching change.
