# Expo Frontend — Implementation Plan

Status: proposed. Scope: `apps/expo`. Companion doc: `expo-industrial-frontend-design.md` (read first — this plan assumes its typography pairing, Liquid Glass rules, motion/SVG/density decisions, and responsive-sizing constraints).

Do not implement without confirmation on phase boundaries below — each phase ends in a working, testable app state; land and verify before moving to the next.

## Phase 0 — dependencies, tokens, fonts, responsive foundation

1. Install the design doc's "New dependencies" list: `expo-blur`, `expo-linear-gradient`, `react-native-svg`, `expo-font`, `@expo-google-fonts/fraunces`, `@expo-google-fonts/bricolage-grotesque`, `expo-haptics`. One commit, `bun install`, confirm `expo start --web` still boots before anything else.
2. Load fonts in root `apps/expo/src/app/_layout.tsx` via `useFonts` + a splash-screen hold (standard `expo-splash-screen` pattern) — app must not render text in the wrong face on cold start, so this gates first paint.
3. Extend `theme/tokens.ts`:
   - `typography`: repoint `display`/`title` to Fraunces, `label`/`caption`/button text to Bricolage Grotesque, leave `body`/`bodySmall` on system sans, keep `mono` as-is (per design doc's Typography section).
   - `shadows`: `xs`/`sm`/`md` elevation presets, used only where the design doc calls for them (glass surfaces, expanded grid state) — not a default on cards.
   - `spacing`: split the current single `md` into tighter item-level vs. section-level use (design doc's Density section) — adjust values, keep the same key names so call sites don't need a rename pass.
   - Add a `breakpoints` export (`compact: 360, regular: 600, wide: 900`) — the one shared source for every width-driven decision (grid columns, type scale, section padding) instead of magic numbers per component.
4. Add `theme/use-color-scheme.ts` (`useAppColorScheme()` wrapping RN's `useColorScheme()` with manual override via existing `lib/storage.ts`) and `theme/use-responsive.ts` (`useResponsive()` returning `{ width, tier, insets }` — wraps `useWindowDimensions()` + `useSafeAreaInsets()` from the already-installed `react-native-safe-area-context` in one hook so every component below reads from one place instead of three).

Exit criteria: `bun test`, `tsc --noEmit` clean; app boots on web with Fraunces/Bricolage visibly rendering somewhere trivial (e.g. the existing screen titles, no layout changes yet); no screen logic changed.

## Phase 1 — primitives: state components + icon/illustration set

1. Build `ui/skeleton.tsx`, `ui/filter-chip.tsx` (extracted from `wardrobe.tsx`'s inline `FilterChip`), `ui/confidence-badge.tsx` (numeric/mono treatment per design doc, not a decorative badge).
2. Build `ui/empty-state.tsx` / `ui/error-state.tsx` with the custom SVG illustration slot (design doc's Premium SVG section) — draw the first 2 illustrations only (wardrobe-empty, generic-error), not all 5 upfront; add the rest in Phase 5 as each screen actually needs one (need-driven, not speculative).
3. Start the custom icon set (`components/icons/`) — draw only the icons Phase 1-2 components need immediately (save/heart, chevron, close, retry — 4-6 marks), not the full 15-20 upfront. Each icon is a small `react-native-svg` component taking `size`/`color` props.
4. Every interactive primitive here (filter chip, any icon button) gets the press-scale micro-interaction (design doc's Motion section: 0.97 scale, ~80ms) and a 44×44pt/48×48dp minimum hit area via `hitSlop` where the visual target is smaller — this is the baseline "everything is alive" pass, not deferred polish.
5. `*.test.ts` for logic only (skeleton count math, empty-state variant selection) per existing `lib/*.test.ts` convention.

Exit criteria: `bun test`, `tsc --noEmit` clean; components verified standalone via `expo start --web`, not yet wired into screens.

## Phase 2 — ProductCard + grid math + touch/size discipline

1. Build `ui/product-card.tsx` — consolidates `GarmentCard` (`wardrobe.tsx`) and whatever `explore.tsx`/`saved.tsx` inline, with optional `matchPercent`/`onSavedChanged`. Save-toggle uses the scale-pop micro-interaction (design doc's Motion section) plus `expo-haptics` light-impact on toggle, not an instant icon swap.
2. Build `grid/column-count.ts` — pure function reading the Phase 0 `breakpoints` token (2/3/4 columns, plus the new <360pt single-column tier) with a `.test.ts` covering every boundary width including the new compact tier.
3. Card sizing respects `useResponsive()`: cap `ProductCard` max-width on wide/tablet layouts (design doc's Responsive section — no unbounded card growth on a 13" iPad grid) and use `maxFontSizeMultiplier` on any fixed-height text within the card so large-Dynamic-Type doesn't clip it.

Exit criteria: `ProductCard` verified at three widths (compact phone, standard phone, tablet/web-wide) via `expo start --web` resize, not yet wired into production screens.

## Phase 3 — ExpandableCollectionGrid

1. Build `grid/expandable-collection-grid.tsx`: collapsed/expanded state, "+{n} more"/"Collapse" ghost buttons, per-card staggered reveal (Reanimated `useSharedValue` + `withDelay`/`withTiming`, mirroring the Flutter `_StaggeredReveal` interval math from the design doc), height transition via Reanimated `Layout` (verify it behaves on `react-native-web`; fall back to `LayoutAnimation.configureNext` if not — this ships to web too).
2. Header uses the sharp (0-4px radius) treatment from the design doc's Visual Identity section — the one deliberately-not-rounded element per screen.
3. Quick-preview `Modal` sheet on card tap (title/image/price/badge/AI reason/sizes) — this is the first real Liquid Glass surface: `expo-blur` `BlurView` background, `intensity` ~80, tinted to the active theme, with the SVG edge-highlight from the design doc's Liquid Glass section.
4. Reduced-motion check via `AccessibilityInfo.isReduceMotionEnabled()`; column count and grid padding read from `useResponsive()` (Phase 0), not a hardcoded prop.
5. `expandable-collection-grid.test.ts` — state machine only (expanded/collapsed toggling, visible/hidden-count math), extracted into a plain function per the existing ponytail-mandated "one runnable check" rule for branch-heavy components.

Exit criteria: component works standalone against mock/fixture data in one throwaway screen, verified at compact/standard/tablet widths, before touching production screens.

## Phase 4 — app shell: glass tab bar + safe areas

1. Rebuild the tab bar (`(app)/(tabs)/_layout.tsx`) as a floating Liquid Glass surface: `BlurView` background (lower intensity, ~30-40, per design doc — stays legible over scrolling content), safe-area-aware bottom inset via `useResponsive()`, and a morphing active-tab indicator (Reanimated `Layout` transition, same technique as the grid's height animation).
2. Any FAB gets the same glass + interactive-press treatment.
3. Every screen root adopts safe-area insets from `useResponsive()` instead of ad-hoc padding — this is the one truly global change in this phase, done once here rather than repeated per-screen in Phase 5.

Exit criteria: tab bar and any FAB verified on a device/simulator with a notch and one with Android gesture-nav (or the closest available simulator profiles) — this is a case where `expo start --web` isn't sufficient, a simulator check is required.

## Phase 5 — screen migration (one screen at a time, in this order)

Order chosen by risk: simplest data shape first, most complex (Social) last. Each screen gets: the grid swap, its remaining empty-state illustrations (Phase 1's deferred 3), responsive column/spacing behavior, and any screen-specific interactive gesture.

1. **Wardrobe**: swap the flat `FlatList` grid for `ExpandableCollectionGrid` (per-category or single, based on real data shape). Add swipe-to-remove via the already-installed `react-native-gesture-handler` (design doc's Motion section), replacing the plain "Remove" button. Draw the wardrobe-specific empty-state illustration if not already covered by Phase 1's generic one.
2. **Saved**: same grid pattern; sections by save-recency if `saved-feed.ts` exposes timestamps, else one grid. Saved-specific empty-state illustration.
3. **Explore**: multi-section grids ("For you," "Trending") — this is where sectioning earns its keep. Explore-specific empty-state illustration.
4. **Social**: last; extend `ProductCard` only if the domain overlap is real (author/engagement fields), otherwise a legitimately separate card component — don't force reuse.

Each screen migration is its own commit; run `tsc --noEmit` + `bun test` + a manual `expo start --web` resize check (compact/standard/tablet) + simulator spot-check after each, before moving to the next.

## Phase 6 — theme wiring + density/responsive polish pass

1. Replace hardcoded `colors.dark.*` references screen-by-screen with `useAppColorScheme()` (Phase 0). Do this after screens are stable, so it's a mechanical pass rather than fighting two refactors at once.
2. Verify contrast via the existing `contrastRatio()` validator for every text/bg pairing actually in use, both themes.
3. Full-app responsive sweep: every screen checked at the compact (<360pt), standard phone, and tablet/wide breakpoints; confirm no raw pixel literals bypass the `spacing`/`breakpoints` tokens (grep for numeric literals in `style={}` blocks as a lint-style check, not new tooling).
4. Pull-to-refresh gets the custom indicator (design doc's Motion section) replacing the stock spinner, now that the rest of the visual language is stable enough to design against.

Exit criteria: this is the last phase — app should be feature-complete against both plan docs after this lands.

## Verification gates (every phase)

- `cd apps/expo && bun test`
- `cd apps/expo && tsc --noEmit`
- `expo start --web` manual smoke, resized across compact/standard/tablet widths.
- From Phase 4 onward, at least one simulator/device check (notch + Android gesture-nav) for anything touching safe areas or the glass tab bar — web resize alone doesn't catch inset bugs.

## Explicit non-goals for this pass

- No test-library addition (RTL, Detox) — existing `bun test` + pure-function tests match the repo's established pattern.
- No Storybook/component-explorer scaffolding — component count doesn't justify it; manual `expo start --web` checks are sufficient at this scale.
- No Lottie/After-Effects pipeline — Reanimated + custom SVG covers every motion need identified in the design doc.
- No runtime density-switcher — the compact/standard/wide behavior is derived from actual screen width, not a user-facing setting.
