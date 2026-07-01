# GYF — Complete Frontend Execution Plan

> **Created:** 2026-07-01  
> **Status:** Active — Phases 1 & 2 fully specified and executing.  
> **Standard:** Industrial-grade, multi-user deployable, mobile-first, WCAG 2.2 AA.  
> **Motivation:** "The standard isn't 'good enough' — it's 'holy shit, that's done.'"

---

## Overview

Two parallel tracks of frontend work, with Phase 1 as a prerequisite for Phase 2.

| Phase | Focus | Scope |
|---|---|---|
| **1** | Mobile optimization + Logo intro | Layout, touch targets, intro animation |
| **2** | Design overhaul | Typography (Jakarta Sans), interactivity, component elevation |

---

## Phase 1 — Mobile-First Optimization + Logo Intro Animation

### 1A. Logo Intro Animation (replaces letter stagger)

**File:** `app/components/intro/app-intro.tsx`

**Current state:** Three letters (G, Y, F) stagger in individually with a scan line and tagline.

**Target:** The actual GYF brand monogram (`/assets/logo.png`) — an interlocked serif GYF mark — animated with a premium entrance sequence:
1. Full-screen near-black overlay fades in instantly (covers initial flash)
2. Logo mark scales from 0.7 → 1.0 with the lux curve (600ms), simultaneous opacity 0 → 1
3. Subtle radial glow blooms behind the mark (opacity 0 → 0.15 → 0) — editorial atmosphere
4. Hold at full for 800ms
5. Logo scales slightly up (1.0 → 1.04) and fades out simultaneously with the overlay
6. Total duration: ~2.8s (same as before, no user-time regression)
7. Image rendered white via `filter: brightness(0) invert(1)` on the dark background
8. `prefers-reduced-motion`: static logo held briefly, then fade — no scale animation

### 1B. Mobile Layout Fixes

**Auth pages (`app/(auth)/layout.tsx`):**
- Centred, full-height layout with correct top/bottom safe-area padding
- Min-touch-target 44px on all form controls
- Auth form max-width capped at 420px, padded `px-5` on small screens

**Bottom nav:**
- Already has `env(safe-area-inset-bottom)` — verified correct
- Active indicator spring animation already present
- Label font size bump to `0.625rem` (currently `0.5625rem`) for readability on 375px screens

**Stylist feed (`/`):**
- Staggered card grid already 1-col on mobile — confirmed correct
- `StylistControls` — ensure goal input doesn't trigger viewport zoom on iOS (font-size ≥ 16px)
- `OutfitCard` action buttons: save/dismiss min-height confirmed `min-h-11` (44px) ✅

**Explore page (`/explore`):**
- `FilterBar` sticky top with `backdrop-blur-md` ✅
- Filter row wraps on mobile ✅  
- Search input font-size set to 16px to prevent iOS zoom
- Price input font-size 16px

**Page containers:**
- `PageContainer` — add `px-4 sm:px-6 lg:px-8` consistently
- `PageHeader` — tighten vertical spacing on mobile

**Onboarding wizard:**
- Step navigation buttons confirm 44px touch targets
- Photo upload drop zone — full-width, 180px min-height on mobile
- Step panel min-height reduced from `min-h-80` to `min-h-72` on small screens

**Wardrobe grid:**
- `gap-3` on mobile confirmed ✅, `grid-cols-2` ✅

**Social feed:**
- Post card image `aspect-square` ✅
- FAB positioning already clears bottom nav ✅

---

## Phase 2 — Design Overhaul

### 2A. Typography — Plus Jakarta Sans Throughout

**Replace:**
- Inter → Plus Jakarta Sans (all weights: 300, 400, 500, 600, 700)
- Playfair Display → Plus Jakarta Sans (editorial/display styles use 700wt + tight tracking)
- JetBrains Mono → Plus Jakarta Sans Mono (or retain JetBrains for code/status only)

**Font stack in `lib/fonts.ts`:**
```ts
Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["300","400","500","600","700"], variable: "--font-jakarta" })
```

**CSS token updates in `globals.css`:**
- `--font-display: var(--font-jakarta)` — 700wt, tight tracking
- `--font-body: var(--font-jakarta)` — 400/500wt
- Keep `--font-mono: var(--font-jetbrains)` for metadata/status glyphs

**Type scale adjustments for Jakarta Sans:**
- `.t-display`: 700wt (Jakarta's hinting is denser than Playfair)
- `.t-headline`: 600wt
- `.t-editorial`: 500wt italic
- All letter-spacing / line-height tuned to Jakarta Sans metrics

### 2B. Interactive Design Upgrades

**Outfit cards:**
- Tap/press scales the card (`scale-[0.985]`) on mobile — haptic affordance
- Image strip: `aspect-[3/4]` items → subtle zoom on hover/focus (`scale-105`)
- Save button: fill animation (bg sweeps left-to-right on press) instead of instant toggle
- "View look" overlay: always visible on mobile (opacity-100), hover-only on desktop

**Bottom nav:**
- Active tab: warm-gold `accent-warm` color instead of plain white
- Indicator line color: `bg-accent-warm`
- Tab press: `scale-90` spring bounce

**Explore FilterBar:**
- Chip-style occasion/style pills instead of `<select>` dropdowns (scrollable horizontal row)
- Active filter chips: filled `bg-accent text-bg`
- Clear button: animated `X` icon

**Onboarding wizard:**
- Step progress: thick pill bar (`h-1`) with color sweep animation as steps complete
- Style intent chips: spring scale on toggle (1 → 1.08 → 1)
- Estimated badge: sparkle pulse animation

**Social feed:**
- Post card: swipe-to-react gesture on mobile (react on left swipe → `like`)
- FAB: morph from circle to `+` with spring entrance

**Profile stats grid:**
- Number counter animation (count up from 0 on mount)
- Stats are tappable links with press scale

**Toast notifications:**
- Slide in from bottom on mobile, from top-right on desktop
- Progress bar drain animation for auto-dismiss

**Buttons:**
- Primary: shimmer sweep on hover (moving highlight)
- Ghost: underline wipe on hover
- All: `active:scale-[0.96]` spring press feedback

### 2C. Design Language Refinements

**Color:** Retain Editorial Noir palette. Add:
- `--color-accent-cool: #7B9EFF` — a cool periwinkle for secondary interactive states
- `--color-success: #4CAF7A`

**Borders:** Increase default border visibility slightly (`rgba(255,255,255,0.12)`) for better definition on OLED screens.

**Cards:** 2px border-radius on interactive cards only (cards with hover states) — subtle, premium.

**Spacing system:** Consistent 4/8/12/16/24/32/48px rhythm enforced throughout.

**Motion:** All animations use `--ease-lux: cubic-bezier(0.16, 1, 0.3, 1)` — no bounce, no elastic. Spring physics only on layout/press states.

---

## Implementation Order

```
Phase 1:
  [1] Update fonts.ts → add Plus Jakarta Sans (needed by Phase 2, do first)
  [2] Update globals.css → new tokens + type scale
  [3] Rewrite app-intro.tsx → logo mark animation
  [4] Fix mobile layout issues (auth layout, input font-size, page containers)

Phase 2:
  [5] Update all interactive components (buttons, cards, nav)
  [6] Update FilterBar → chip pills
  [7] Update Onboarding → step progress + chip animations
  [8] Update Profile → counter animations
  [9] Update Social → swipe gesture + FAB morph
  [10] Update Toast → slide + progress drain
```

---

## Quality Gates (all must pass before ship)

- [ ] `make ci` passes clean (typecheck + lint + tests)
- [ ] Lighthouse mobile score ≥ 90 (Performance, Accessibility, Best Practices)
- [ ] All interactive elements have ≥ 44px touch targets
- [ ] `prefers-reduced-motion` respected on all animations
- [ ] `focus-visible` ring on all interactive elements (WCAG 2.2 AA)
- [ ] No iOS input zoom (all inputs font-size ≥ 16px)
- [ ] Fonts load with `display: swap` (no FOIT)
- [ ] Intro animation plays once per session (sessionStorage gate) ✅ already

---

## File Change Register

| File | Change |
|---|---|
| `app/lib/fonts.ts` | Add Plus Jakarta Sans, remove Inter/Playfair |
| `app/app/globals.css` | Update font tokens, type scale, new color tokens |
| `app/app/layout.tsx` | Update font variable class names |
| `app/components/intro/app-intro.tsx` | Logo mark animation |
| `app/app/(auth)/layout.tsx` | Mobile-first centered layout |
| `app/components/ui/button.tsx` | Shimmer hover, press scale |
| `app/components/layout/bottom-nav.tsx` | Accent-warm active color, press scale |
| `app/components/layout/page-container.tsx` | Consistent mobile padding |
| `app/components/layout/page-header.tsx` | Mobile spacing |
| `app/components/stylist/outfit-card.tsx` | Mobile tap affordance, save fill animation |
| `app/components/stylist/stylist-controls.tsx` | Input font-size 16px |
| `app/components/explore/filter-bar.tsx` | Chip-pill filters, 16px inputs |
| `app/components/onboarding/onboarding-wizard.tsx` | Pill progress bar, chip spring |
| `app/components/social/social-feed.tsx` | FAB spring entrance |
| `app/components/profile/profile-view.tsx` | Counter animation on stats |
| `app/components/ui/toast.tsx` | Slide + progress drain |
