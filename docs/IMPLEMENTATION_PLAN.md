# GYF Design-Language Overhaul — Phase Plan

Scope source: `ScopeofIdea.md`. Target: `apps/expo` (EAS, https://get-your-fit.expo.app). Push after every phase.

Design language (from Ref1–Ref7): black editorial canvas, Cosmos-style mixed-size grid, liquid glass surfaces, sharp/boxy media frames, minimal chrome.

## Phase 0 — Foundation: tokens, fonts, responsiveness
Everything else sits on this, so it goes first.
- **Typography symmetry**: lock two families in `theme/tokens.ts` — `Fraunces_600SemiBold` for ALL headings, existing body font (Inter/system via GyfText variants) for subheadings/content. Sweep every screen for stray `fontFamily` overrides; route all text through `GyfText` variants only.
- **Responsive sizing (iOS + Android)**: no device-list fetching needed — one `scale()` helper clamped off the 360–430pt logical-width band that covers every current iPhone/Android phone, driven by `useWindowDimensions`. Apply to font sizes and key paddings via tokens. `ponytail:` linear scale clamp; per-breakpoint layouts only if a screen visibly breaks.
- Extend tokens with the glass recipe (already proven in `glass-tab-bar`) as a reusable `GlassSurface` component so every later phase reuses one implementation.

## Phase 1 — Explore page (biggest scope cluster)
- **Search bar**: pill, liquid glass (`GlassSurface`), containing an animated SVG mark modeled on Ref3's top-left dot-cluster logo (react-native-svg + reanimated rotate/stagger loop, `ReduceMotion.System`).
- **Filters**: new high-quality SVG icon; tap opens a dropdown of filter pills in a curved-end glass box (reanimated `FadeInDown`/layout animation).
- **Infinite expandable grid**: restyle `expandable-collection-grid` to Ref1/Ref2 — two-column masonry, varied tile heights, tight gutters on black, infinite scroll (FlashList/FlatList `onEndReached` against existing feed source).
- **Portfolio showcase (Ref4)**: card frames with sharp corners (radius 0–2), full article visible (`resizeMode: contain` within fixed-aspect frame), title + author row beneath — one `PortfolioCard` component shared with Stylist page.

## Phase 2 — Profile page + bottom nav avatar
- Profile pic add (reuse `expo-image-picker` if installed, else install) → persisted via existing user store/backend field.
- Bottom nav profile icon swaps to the avatar (circular masked image) when set, falls back to current person SVG.
- Reorganize profile page: clean sections (identity header, stats, actions) using existing list/section patterns — no new layout system.

## Phase 3 — Menus, settings, theme toggle
- Per-page menu/settings entry points with high-quality SVG icons and opening animations (glass sheet/dropdown reusing Phase 1's dropdown component).
- **Light/dark theme option in the menu**: extend `use-color-scheme` with a persisted override (system/light/dark) — tokens already have both palettes.

## Phase 4 — Wardrobe + Stylist pages
- Wardrobe: reorganize into the Ref1/Ref2 grid language + glass surfaces; group by category; same PortfolioCard for item detail frames.
- Stylist page: portfolio showcase via `PortfolioCard` (built in Phase 1).

## Phase 5 — Global polish pass
- Apply liquid glass wherever it elevates (sheets, headers, overlays) using `GlassSurface` only.
- Button/placement audit: every screen — each button earns its spot, thumb-reachable, consistent hit targets (`hitSlopFor` exists).
- Animation smoothness pass: entrances on all pages via reanimated layout animations, all gated on `ReduceMotion.System`.
- Final device check: web export + iOS/Android simulators at small (360×640) and large (430×932) sizes.

## Scope-point coverage
| Scope point | Phase |
|---|---|
| Design language globally from refs | 0 + all |
| Expo UI / gluestack / design skills | tooling used per phase (expo-ui, liquid-glass, frontend-design skills; gluestack only if a needed primitive is missing — existing components cover most) |
| Font symmetry (one heading font, distinct body) | 0 |
| Expo scope | all (apps/expo only) |
| Ship-quality UI/UX | all, gated in 5 |
| Explore search pill + animated Ref3 SVG | 1 |
| Filter SVG + dropdown pill box | 1 |
| Profile pic → bottom-nav avatar; clean profile | 2 |
| Menus/settings SVGs + opening animations + theme toggle | 3 |
| Infinite expandable grid (Ref1/Ref2) | 1 (explore), 4 (wardrobe) |
| Ref4 portfolio frames, sharp/boxy, whole article visible | 1 + 4 |
| Liquid glass wherever top-of-line | 0 (component), 5 (sweep) |
| Wardrobe beautify/organise | 4 |
| Meaningful button placement | 5 |
| iOS/Android dimension optimisation | 0 + 5 |
