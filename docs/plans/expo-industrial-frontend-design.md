# Expo Frontend — Design System Plan

Status: **shipped** (2026-07-16) — see the implementation plan's status note for deviations. Scope: `apps/expo`. Companion doc: `expo-industrial-frontend-implementation.md`.

## Why

The Expo app (post-migration from the Flutter `gyf_app` and the Next.js `app/`) currently renders with inline `style={}` objects, ad-hoc `FlatList` grids, and no shared primitives beyond `AtelierCard`/`AtelierButton`/`GyfText`. Every screen (`wardrobe.tsx`, `explore.tsx`, `saved.tsx`, `social.tsx`) reimplements card layout, filter chips, loading/error/empty states from scratch. That's fine for a migration checkpoint; it's not a flagship surface.

**Reuse policy, stated explicitly: we are porting mechanics, not aesthetics.** Only the pieces below are carried over from the old frontends — everything else in this doc is new, and the visual language is deliberately not a continuation of either the Flutter or Next.js look. Pulling every old widget forward would just re-import their generic-AI-app skin (soft glass cards, purple/blue gradients, uniform rounded-pill everything) into a fresh codebase. Don't do that. Take the *interaction* that's genuinely earned — the expandable grid's motion choreography — and design a skin for it from scratch.

## What's actually reused (mechanics only, not skin)

- `apps/expo/src/theme/tokens.ts` — kept as the token *file* (single source of truth), but its actual values (palette, radii, type scale) are up for revision below — this is infrastructure, not the design.
- `react-native-reanimated` (~4.1) and `react-native-gesture-handler` are already installed — the expand/collapse and stagger motion needs zero new dependencies.
- The Flutter grid at `gyf_app/lib/core/widgets/gyf_expandable_collection_grid.dart` is reused for exactly one thing: its *timing and choreography* (250–300ms expand, 45ms stagger, height transition before content transition). Its Material-ish visual output (card shadows, rounded chips, expand chevron) is not reused — see Visual Identity below.
- `AtelierCard`/`AtelierButton`/`GyfText` remain as the naming convention for primitives but their internals get rebuilt per the visual identity, not copied forward unchanged.

## Visual identity — what "not AI-slop" means concretely

Naming the enemy so the plan can be checked against it later. Generic AI-app design in 2025/2026 converges on: purple-to-blue or pink-to-orange gradients, glassmorphism/blur-everything, uniform 16–24px rounded corners on every element regardless of hierarchy, centered hero copy in a rounded sans (Inter/Poppins) at 3–4 font weights, soft drop shadows on every card, generic line-icon sets, and a bouncy spring on every transition. It's recognizable specifically because nothing in it is a decision — it's default Figma-community-kit output.

The existing `tokens.ts` palette (`#000000`/`#141414` true dark, `#ffffff`/`#f4f4f5` true light, no purple/blue accent, no gradient) already avoids the worst of this — that's the right instinct, push it further rather than discarding it:

- **No gradients, no glassmorphism, no blur-as-decoration.** Flat surfaces, real borders (`colors.border`, already 1px hairlines in `AtelierCard`). If depth is needed, use the `shadows` scale below sparingly (only on the expanded grid state and modals) — not on every card.
- **Asymmetric radius, not uniform pill-everything.** Current `radii.capsule: 999` on filter chips is fine (chips are genuinely pill-shaped UI), but `radii.card: 24` applied to *everything* — cards, buttons, inputs, sheets — is the generic-kit tell. Differentiate: cards keep a large, confident radius (24–28, already close), but buttons and inputs get a tighter radius (`radii.control: 14`, already exists — use it more, don't let `radii.card` bleed into non-card surfaces), and at least one deliberately sharp (0–4px) element per screen — e.g. the collection-grid header bar — to break the "everything is a soft rounded blob" monotony.
- **Typography does the differentiation work, not color.** `typography.display` at 42px/700 is a strong start. Consider one further move: a genuinely distinct display face (not system-default, not Inter) for `display`/`title` only, system font for body — a single well-chosen typeface swap is worth more than any amount of gradient tuning and costs nothing (Expo bundles custom fonts natively via `expo-font`, already implied by the Expo SDK, no new dependency). Flag as a decision to make with the user before committing — this is the one place worth spending an actual design choice rather than defaulting.
- **Motion has a point of view: decisive, not springy.** The Flutter grid's choreography (height-first, then content, real stagger, no bounce — `GyfCurve.emphasized`/`enter`, not a spring) is exactly right and exactly what generic AI apps get wrong (they spring everything). Keep that discipline; extend it to every transition, not just the grid.
- **Confidence badges / match-% pills**: avoid the reflexive "AI feature = purple sparkle icon" treatment. Use the existing `success`/`warning`/`error` semantic tokens or a plain numeric treatment (`92% match` in mono type, already `typography.mono` exists) instead of a decorative badge.

## Design tokens — extend, not replace

Add to `theme/tokens.ts` (same file, same `as const` pattern):

- `shadows`: `xs`/`sm`/`md` elevation presets (RN `shadow*` + `elevation` for Android), used sparingly per Visual Identity above — not a default on every card.
- `motion`: already has `fast/standard/calm` (160/240/300ms) — matches the Flutter grid's 250-300ms expand / 200-250ms collapse timing. No change needed, just use it, and use a non-spring easing curve (`Easing.out(Easing.cubic)` or similar) everywhere, not RN's bouncy defaults.
- `columns` breakpoints: 2 columns default (phone), 3 above ~600pt width, 4 above ~900pt (web/tablet). Compute from `useWindowDimensions()`, don't hardcode `numColumns={2}` like `wardrobe.tsx` does today.
- Optional `displayFont` token once a typeface decision is made (see above) — leave as a TODO/open question until the user picks one, don't default to a placeholder Google Font just to fill it in.

No new accent color, no gradient tokens — the existing near-monochrome palette is the differentiator, not a limitation (ponytail check: the tokens file's *values* already clear rung 1 — question whether color needs to exist at all beyond semantic success/warning/error, and the answer here is no).

## Component inventory to build

All under `apps/expo/src/components/`, one file per primitive, co-located `*.test.ts` for logic-bearing ones (grid math, state machine) per the existing repo convention (every `lib/*.ts` has a paired `.test.ts`).

1. **`grid/expandable-collection-grid.tsx`** — the signature component (see spec below).
2. **`ui/product-card.tsx`** — image (3:4 aspect) + brand/name/price + optional match-% badge + save toggle. Replaces the one-off `GarmentCard` in `wardrobe.tsx` and whatever `explore.tsx`/`saved.tsx` currently inline.
3. **`ui/skeleton.tsx`** — pulsing placeholder block (Reanimated opacity loop). Replaces bare `ActivityIndicator` usage.
4. **`ui/empty-state.tsx`**, **`ui/error-state.tsx`** — headline + description + one primary action. Every screen currently hand-rolls this differently (`wardrobe.tsx` inline empty text, `explore.tsx` etc.) — consolidate to one component with variants.
5. **`ui/filter-chip.tsx`** — extract the inline `FilterChip` from `wardrobe.tsx` (it's already correct, just trapped in one file).
6. **`ui/confidence-badge.tsx`** — small numeric-percent pill, used by both the card and the collection header.

Ladder check: six components, all reused across ≥2 existing screens today — this clears rung 1 (need to exist) because it removes duplication that already exists, not speculative future need.

## ExpandableCollectionGrid — behavior spec (ported from Flutter)

This is the flagship interaction GYF is known for; port it faithfully rather than reinventing.

- **Collapsed**: shows `previewCount` (default 4) cards + a `"+{hidden} more"` ghost button if more exist.
- **Expand**: tap header or ghost button → `LayoutAnimation`/Reanimated `Layout` transition on the container height (250–300ms, standard easing) → cards fade/translateY/scale in with a ~45ms stagger per card (`opacity 0→1`, `translateY 12→0`, `scale 0.98→1.00`). Header chevron rotates 180°.
- **Collapse**: reverse, faster (200–250ms), no stagger on the way out.
- **States**: `loading` (skeleton grid matching real card count), `empty` (empty-state + "Generate" CTA), `error` (error-state + retry), `loaded`.
- **Accessibility**: header is a single a11y button, `accessibilityLabel` announces `"{title}, {count} looks, {expanded|collapsed}"`; on toggle, fire an `AccessibilityInfo.announceForAccessibility` update, matching the Flutter `SemanticsService.sendAnnouncement` call.
- **Reduced motion**: read `AccessibilityInfo.isReduceMotionEnabled()` once on mount; if true, skip the height/stagger animation and snap.
- **Quick preview**: tapping a card opens a bottom sheet (title, image, price, match badge, AI reason, sizes) rather than navigating away — preserves scroll position/context. Use a plain `Modal` + `Pressable` backdrop; no new sheet library needed (rung 4/5 — RN `Modal` is native, already available).

## Screen-level design direction

- **Home / Explore / Saved / Wardrobe / Social**: each becomes a `FlatList` (or `ScrollView` of sections) of `ExpandableCollectionGrid` instances instead of one flat grid — "Recently added," "Because you saved X," etc. This is the actual "industrial" upgrade: structured, scannable sections instead of one undifferentiated grid, and it's the pattern the Flutter app already validated.
- Keep per-screen data-fetching hooks (`lib/*-feed.ts`) as-is — they're already clean and tested; only the render layer changes.
- Dark/light theme: tokens already support both, but every screen currently hardcodes `colors.dark.*`. Wire an actual theme context (`useColorScheme()` from RN, falling back to token default) so light mode isn't dead code. This is a real gap, not speculative — `colors.light` exists and is unused.

## Typography — a real pairing, not one display font

"No generic fonts" plus "different fonts for headings vs subheadings" means this needs an actual type system, not a single swap. Two-typeface pairing, both variable (one file, many weights — keeps bundle size sane):

- **Display/heading** — **Fraunces** (variable serif, editorial character, see prior candidate proposal). Used for `display` and `title` only: screen titles, collection-grid headers, hero numbers. Set at its higher `opsz` axis value so the ink-traps and contrast read clearly at large sizes.
- **Subheading/label/UI** — **Bricolage Grotesque** (variable grotesk, the third candidate from before). Used for `label`, `caption`, buttons, chips, nav — anywhere UI needs to feel precise rather than editorial. The serif/grotesk contrast *is* the hierarchy signal — a reader distinguishes "this is a heading" from "this is a control" by typeface family, not just size/weight, which is a stronger, more premium-reading signal than weight-only hierarchy.
- **Body** — system sans (`San Francisco`/`Roboto` via RN default). Deliberate: body copy is read, not looked at — a system font here is invisible in the right way, and it's the one place "generic" is correct, not a compromise. Only the two display faces need to be distinctive.
- **Mono** — keep existing `typography.mono` (already token-defined) for numeric/data readouts (match-%, prices, counts) — reinforces the "precise instrument" read.

Both faces ship via `@expo-google-fonts/fraunces` and `@expo-google-fonts/bricolage-grotesque` (OFL-licensed, first-party Expo font packages, loaded once via `expo-font`/`useFonts` at the root `_layout.tsx` with a splash-screen hold until loaded — standard Expo pattern, no custom font-loading logic needed).

## Liquid Glass — used correctly, not as blanket decoration

The earlier draft of this doc banned glass/blur outright, reacting against cheap glassmorphism (blur + white-opacity-overlay slapped on every card as decoration, with no relationship to what's behind it). Apple's actual Liquid Glass material (iOS 26) is a different thing: a *functional* surface — translucent, reflects and tints from real content behind it, reacts to touch, reserved for controls and floating/overlay surfaces, explicitly *not* applied to every static content card. That distinction is the rule to follow here, ported to RN:

- **Where glass is used**: the floating tab bar, the quick-preview modal sheet, any floating action button, and the collection-grid header once expanded (a light blur-tint on scroll-under content, not the product cards themselves). This is a short, deliberate list — per Apple's own anti-pattern guidance, glass on every surface degrades both performance and the "this is special" signal.
- **Where glass is *not* used**: `ProductCard`, `AtelierCard`, list rows, static content — these stay flat/opaque per the original Visual Identity section. A card grid where every card is glass is exactly the generic-AI-slop effect being avoided; a grid where cards are crisp and *one* floating control is glass is the premium signal.
- **Implementation**: `expo-blur`'s `BlurView` (first-party Expo SDK module, `tint="dark"`/`"light"` matching the active theme, `intensity` tuned per surface — high (~80) for modals over busy content, lower (~30-40) for the tab bar so it stays legible) is the RN equivalent of `UIVisualEffectView`/`glassEffect()`. Add `react-native-svg` alongside it for the subtle light-catch edge highlight (a 1px gradient stroke along the top edge of a glass surface, mimicking Liquid Glass's specular highlight) — a thin `LinearGradient`-stroked `Rect`/`Path`, not a decorative illustration.
- **Interactive glass**: the tab bar and FAB should respond to press with a brief intensity/scale pulse (Reanimated `withTiming` on `intensity`/`scale`), matching Liquid Glass's `.interactive()` behavior — glass that only ever looks static reads as a flat blur filter, not a material.
- **New dependency**: `expo-blur` — first-party Expo SDK package, zero-alternative for real backdrop blur on RN (there's no stdlib/CSS-filter equivalent on native), so it clears the ladder at "native platform feature" tier despite being an added package.

## Motion and interactivity — beyond the grid

The expandable grid's choreography (Phase 2 of the implementation plan) is the flagship interaction, but "good animations throughout, interactive features" means extending that same discipline (decisive, non-spring, purposeful) to the rest of the app rather than leaving everything else static:

- **Press feedback**: every tappable surface (`AtelierButton`, `ProductCard`, filter chips, tab bar items) gets a consistent press-down scale (0.97, ~80ms, `Easing.out`) via Reanimated — currently zero components have any press state, which is the single biggest "does this feel premium" gap.
- **Save/like toggle**: the heart/save icon on `ProductCard` gets a real micro-interaction (scale-pop 1→1.15→1 with a short mono-timed sequence), not an instant icon swap — this is the kind of detail generic AI-app clones skip entirely.
- **Pull-to-refresh**: replace the stock `RefreshControl` spinner (currently used in `wardrobe.tsx`) with a custom indicator that matches the design language once the visual identity is locked — flagged here, not built until Phase 3/4, since it's polish over a working default, not a blocker.
- **List entrance**: rows/cards entering a newly-loaded list get the same fade+translateY treatment as the grid's stagger (shared `useStaggerReveal` hook extracted from Phase 2's grid work, reused everywhere a list populates) rather than popping in instantly.
- **Gesture-driven actions**: swipe-to-remove on wardrobe items (via the already-installed `react-native-gesture-handler`'s `Swipeable`/pan gesture) instead of a plain "Remove" button — a real interactive feature, not just an animated one, and no new dependency since gesture-handler is already present.
- **Tab bar indicator**: a Liquid-Glass-tinted pill that slides/morphs between active tabs (Reanimated `Layout` transition, same technique as the grid's height animation) rather than a static highlight.

## Premium SVG — icons and illustration, not stock glyphs

Ties back to the earlier "no stock icon set" decision: the differentiator is custom vector work, not zero icons.

- **`react-native-svg`** (first-party-adjacent, the de facto standard RN SVG renderer, required by both Expo's own tooling and any custom-icon approach — no viable alternative) becomes a new dependency.
- **Icon set**: a small (15-20 mark), custom-drawn line icon set matching the type system's character (paired with the Bricolage Grotesque UI voice — precise, slightly unusual proportions) rather than a stock library's generic glyphs. Build incrementally — only draw icons screens actually need, not a speculative full set upfront (ladder check: rung 1, need-driven not speculative).
- **Illustration**: empty-states get one small custom SVG illustration each (not a stock "empty box" clipart, not a Lottie animation — a simple, on-brand line-drawing) rather than the plain text-only empty state proposed in the original component inventory. This is the "premium SVG" ask made concrete: 4-5 illustrations (wardrobe empty, saved empty, explore empty, error state, offline state), reused across screens by variant.
- **Texture**: if the near-monochrome palette wants for tactility, a very subtle (2-3% opacity) grain/noise SVG or PNG overlay on `bg` surfaces is a cheap way to avoid the "flat digital gradient" look without touching the color scheme — optional, evaluate visually before committing, easy to strip if it doesn't read well on real devices.

## Responsive sizing — every iOS and Android form factor

Everything above (grid columns, type scale, spacing, glass surfaces) has to hold up from a 5.4" iPhone mini through Pro Max, standard/foldable/tablet Android, and iPad — this isn't a separate feature, it's a constraint on every token and component already planned. Concrete rules:

- **Safe areas first, always.** `react-native-safe-area-context` is already installed — every screen root and every floating glass surface (tab bar, FAB) must consume `useSafeAreaInsets()`, not a hardcoded top/bottom padding. This covers the notch, Dynamic Island, and Android's gesture-nav inset in one mechanism — no per-platform branching needed.
- **Fluid breakpoints, not device lists.** The grid's column count (design doc, Design tokens section: 2/3/4 at ~600/~900pt) already reads from `useWindowDimensions()` rather than a device name — extend that same width-driven approach to everything, including type scale and spacing, rather than hardcoding for "iPhone" vs "iPad." Add one more breakpoint tier for very small width (<360pt — small Android phones, iPhone SE-class) that drops to a single-column grid and tightens `spacing.lg`→`md` for screen padding, so compact devices don't get section gaps sized for a tablet.
- **Dynamic Type / font scaling.** RN respects the OS text-size setting by default (`allowFontScaling`); don't disable it anywhere for the sake of pixel-perfect layout — that's an accessibility regression, not a design choice. Where a fixed-height element (a badge, a chip) risks clipping at max text scale, use `maxFontSizeMultiplier` (cap, don't disable) rather than `allowFontScaling={false}`.
- **Orientation.** Phones: expect portrait-primary but don't hard-lock it in `app.json` unless there's a real reason — the grid/card components already resize off `useWindowDimensions()`, so landscape on a phone should "just work" as a wider breakpoint rather than needing separate landscape layouts. Tablets: worth checking that section `ScrollView`s don't over-stretch card widths at very wide landscape — cap `ProductCard` max-width so a 4-column grid on a 13" iPad doesn't produce oversized cards, rather than scaling columns indefinitely.
- **Density-independent sizing.** All the token values (spacing, radii, type) are already in RN's density-independent points, not raw pixels — RN/Expo handle the iOS point-scale vs Android dp conversion automatically, so no manual DPI math is needed; the only work is making sure nothing in the app bypasses tokens with a raw pixel literal (a lint/review check during Phase 3 screen migration, not new infrastructure).
- **Touch targets.** Every interactive element (buttons, chips, save-toggle, tab bar items) needs a minimum 44×44pt (iOS HIG) / 48×48dp (Android Material) hit area regardless of visual size — for anything visually smaller (an icon-only button), use RN's `hitSlop` to pad the touch area without inflating the visual footprint. This is a real per-component check during Phase 1/2 build, not automatic.
- **No new dependency** — `useWindowDimensions`, `react-native-safe-area-context` (installed), and RN's built-in font-scaling/dp handling cover all of this; it's a discipline applied across existing phases, not a new system.

## Density — compact yet clean

"Compact yet clean" is a spacing-scale decision, not a new component:

- Tighten `spacing.md` (currently 16) toward 12-14 for list/grid gaps specifically, while keeping `spacing.lg`/`xl` (24/32) for section breaks and screen padding — the current scale is fairly generous throughout, which reads as spacious-but-generic rather than compact-and-considered. Differentiate "space between related items" (tight) from "space between sections" (generous) rather than one uniform gap value everywhere.
- Card internal padding drops slightly (current `AtelierCard` default `padding: spacing.lg` → consider `spacing.md` for grid cards specifically, keep `lg` for standalone cards like the wardrobe "add garment" form) — denser grids, same breathing room where content actually needs it.
- This is a token-file change (Phase 0) plus a per-component audit of which components use `lg` vs `md` padding — not a new density system/prop, that would be speculative (no screen needs runtime-switchable density).

## New dependencies — the actual list

Everything above that isn't already installed, in one place, all first-party Expo SDK packages (no random third-party libs):

- `expo-blur` — Liquid Glass surfaces.
- `expo-linear-gradient` — glass edge highlights only, not a color-scheme gradient.
- `react-native-svg` — custom icons and empty-state illustrations.
- `expo-font` + `@expo-google-fonts/fraunces` + `@expo-google-fonts/bricolage-grotesque` — typography.
- `expo-haptics` — pairs naturally with the press-feedback and save-toggle micro-interactions above; add here rather than deferring, since this pass is explicitly about interactive polish.

Reanimated and gesture-handler, already installed, cover everything else (stagger, press scale, swipe-to-remove, tab morph).

## Explicitly out of scope (don't build)

- No new state-management library (Zustand/Redux) — screens already use local `useState`/hooks successfully at this scale.
- No default icon-library glyph set (`@expo/vector-icons`'s stock Material/Ionicons look is itself a generic-AI-app tell) — custom SVG marks instead, per Premium SVG above.
- No color-scheme gradients (glass edge-highlight gradients are the one exception, and those are structural, not decorative).
- No design-token fork per screen — one `tokens.ts`, extended, never duplicated.
- No wholesale visual port from `gyf_app` or `app/` (Next.js) — only the grid's motion timing is reused, per the top of this doc.
- No Lottie/After-Effects animation pipeline — Reanimated + custom SVG covers every motion need identified above; adding a second animation runtime for illustration-level motion is not justified until a specific screen needs it.
