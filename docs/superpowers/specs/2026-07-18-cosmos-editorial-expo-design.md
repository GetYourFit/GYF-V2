# GYF Cosmos Editorial Expo Design Specification

**Status:** Proposed specification for owner review  
**Date:** 2026-07-18  
**Source:** `ScopeofIdea.md` and `Reference/Ref1.jpeg` through `Reference/Ref7.jpeg`  
**Target:** `apps/expo` on iOS, Android, and responsive web  
**Authority:** Subordinate to `docs/vision/ideas-complete.md`, `docs/engineering-doctrine.md`, `docs/plans/active-execution-contract.md`, and `docs/plans/gyf-launch-refactor-plan.md`

## 1. Purpose

This specification translates the supplied references into one production design for GYF's Expo client. It covers the global visual language, authentication, Stylist, Explore, Wardrobe, Social, Profile, settings, motion, responsive behavior, accessibility, and performance.

This document does not change execution order. Work enters only through the active contract's current pointer and allowed write set. Later surfaces remain designed but blocked until their P3, P5, or P6 gate opens.

## 2. Product outcome

GYF should feel like a calm editorial atelier built around vivid fashion. Product and outfit imagery carries the visual energy. Interface chrome stays quiet, precise, and useful. Every interaction helps a person discover, understand, save, correct, or act on a complete look.

The experience succeeds when:

- a first-time user can reach a useful, explained outfit without a photo;
- every recommendation shows complete garments, confidence, reasons, and correction controls;
- Explore supports fast, deep, non-repeating discovery with honest price and availability;
- Wardrobe clearly separates owned garments from products to buy;
- Profile presents real work, likes, posts, and earned status without clutter;
- every route works in light and dark themes, with Dynamic Type, reduced motion, screen readers, keyboard navigation, and platform back behavior;
- measured device evidence supports the frame, startup, memory, bundle, and interaction budgets fixed by the active contract.

## 3. Design principles

### 3.1 Editorial, not dashboard

Use strong imagery, asymmetric composition, deliberate whitespace, sparse metadata, and restrained controls. Avoid dense admin layouts, uniform card grids, generic gradients, decorative AI sparkles, and repeated rounded containers.

### 3.2 Outfits before items

Stylist leads with complete looks. Explore may lead with items or portfolios, but each item should expose a path to compatible garments or a complete look. Product detail must preserve retailer truth and availability.

### 3.3 Trust remains visible

Reasons, confidence, matched constraints, unavailable slots, stale data, and abstention must remain legible. Visual polish must never conceal missing garments, network failure, correction failure, or uncertain inference.

### 3.4 One system

Extend the existing GYF primitives and tokens. Do not install Gluestack as a second UI runtime. Apply Gluestack's useful constraints—semantic tokens, consistent variants, compound controls, spacing discipline, and dark-mode parity—inside the existing TypeScript component layer.

### 3.5 Motion explains state

Motion shows hierarchy, continuity, selection, expansion, saving, correction, and navigation. It does not decorate idle screens. Every animation must respect the system reduced-motion setting and have a static equivalent.

### 3.6 Native and universal

Use Expo Router, Expo SDK modules, React Native primitives, and already-installed dependencies first. Use Expo Go until a gated capability proves it needs a development build. Avoid device-name branches and hand-maintained phone dimension lists.

## 4. Reference translation

| Reference | Extracted language | GYF application |
| --- | --- | --- |
| Ref1 | Sparse, zoomed-out infinite canvas; mixed white and black editorial boards | Expanded collection and Canvas composition; never compromise list fallback or touch targets |
| Ref2 | Dense asymmetric masonry; variable aspect ratios; narrow dark gutters | Explore, Wardrobe, Saved, and portfolio grids with bounded virtualization |
| Ref3 | Black canvas; two-column discovery; dot-cluster mark; floating icon-only pill navigation | Explore feed, animated search mark, and existing five-tab glass bar |
| Ref4 | Search-first discovery; category rail; sharp editorial frames; title and creator metadata | Explore search/filter header, portfolio cards, stylist collections, and social discovery |
| Ref5 | Quiet password step; centered hierarchy; sparse controls | Authentication and recovery composition |
| Ref6 | Large focused input; keyboard-aware layout; single primary action | Login/signup field states and keyboard avoidance |
| Ref7 | Editorial welcome statement; floating image constellation; strong single CTA | Welcome and onboarding introduction |

References guide composition, density, and interaction. They do not authorize copying logos, trademarks, content, or proprietary assets.

## 5. System architecture

```text
Expo Router routes
        |
        v
Feature screens and route-local state
        |
        +--> GYF primitives and semantic tokens
        +--> Typed GyfApi and existing feed/domain helpers
        +--> Expo Image / Image Picker / Haptics / Blur
        +--> Reanimated / Gesture Handler
        +--> FlatList or FlashList after measured selection
```

Route files remain thin. Shared components, feature logic, types, fixtures, and tests stay outside `src/app`. Server state remains in the existing typed transport/query boundary; local disclosure, selection, and form state stays local. Do not add Redux, Zustand, a second transport, or a client database for this redesign.

## 6. Design system

### 6.1 Typography

- Fraunces is the only editorial display face for `display` and `title` variants.
- Bricolage Grotesque is the UI face for navigation, labels, buttons, and short controls.
- The system sans stack handles long body copy where it improves legibility.
- Mono/numeric styling is reserved for prices, counts, match percentages, and diagnostic facts.
- All screens use `GyfText` variants. Route-specific `fontFamily` values are prohibited.
- Dynamic Type remains enabled. Fixed-height controls must grow or apply a justified `maxFontSizeMultiplier`; they must never disable scaling.

### 6.2 Color

- Keep one semantic palette for light and dark themes: background, surface, raised surface, text, muted text, faint text, border, accent, success, warning, and error.
- Product imagery supplies most color. No decorative purple/blue AI gradients.
- Status never relies on color alone.
- Text and controls must pass programmatic contrast tests in both themes and on fallback glass backgrounds.

### 6.3 Shape and spacing

- Sharp or nearly sharp frames belong to editorial media and portfolio cards.
- Continuous curves belong to hero frames, sheets, primary controls, and the floating tab bar.
- Capsules belong to search, compact filters, and singular actions—not every container.
- Existing spacing tokens and responsive tiers remain authoritative. No device-specific magic numbers.

### 6.4 Glass

Use the existing `GlassSurface` as the only cross-platform glass recipe. Glass is allowed for:

- floating navigation;
- search and filter controls over imagery;
- transient sheets, dropdowns, and quick previews;
- a small number of floating actions.

Static product cards, list rows, profile sections, and wardrobe tiles remain opaque. Android and web may use a higher-opacity fallback when blur or contrast is unreliable. Nested glass is prohibited.

### 6.5 Icons and marks

- Extend the existing SVG icon set; do not add an icon-font library.
- Create the Ref3-inspired dot-cluster as an original GYF mark, not a traced logo.
- Decorative SVGs are hidden from assistive technology. Icon-only actions require accessible labels and at least the project's minimum touch target.
- Animate a wrapper with transforms/opacity rather than repainting complex SVG paths.

### 6.6 Shared component boundaries

Reuse or extend these components before creating another primitive:

- `GyfText`: all typography and text color variants;
- `PressableScale`: accessible press feedback and bounded haptics;
- `GlassSurface`: glass material and fallback;
- `ProductCard`: purchasable product presentation;
- `ExpandableCollectionGrid`: preview/expanded collection behavior;
- `FilterChip`: selected/unselected filters;
- `Skeleton`, `EmptyState`, confidence components, and shared icons;
- `GlassTabBar`: stable five-destination navigation.

Add a component only when two real screens share the same behavior. Candidate additions are an animated GYF mark, an Explore control bar, a portfolio card, and a profile avatar control.

## 7. Navigation and information architecture

The five stable tabs remain Stylist, Explore, Wardrobe, Social, and Profile. Saved, Collections, Account, Status, Support, Grievance, Canvas, item detail, outfit detail, and Try-on remain stack children, sheets, or profile/account destinations.

- Tabs never appear or disappear because of feature flags.
- Profile uses the uploaded avatar in the tab bar when a valid image exists; otherwise it uses the existing person icon.
- Every screen has a deep-linkable route, deterministic back behavior, restoration state, and loading/error boundary.
- Use Expo Router presentation for modal and form-sheet navigation. Do not create a second navigation system inside components.

## 8. Screen specifications

### 8.1 Welcome and authentication

Welcome uses Ref7's sparse editorial composition: a concise promise, a bounded constellation of fashion images, legal links, and one primary Start action. The layout must remain usable without remote images.

Login, signup, password creation, recovery, and reset follow Ref5 and Ref6:

- one visible task per step;
- large readable field value and connected label;
- password visibility control with an accessible name;
- keyboard-safe primary action;
- inline validation announced as an error;
- loading, retry, expired-link, offline, and successful-completion states;
- no authentication secret or privileged key in the bundle.

### 8.2 Onboarding

Manual onboarding remains the authoritative path. Photo assistance stays optional and gated by the photo/privacy phase.

- Collect only fields required for the trusted outfit loop: region/culture, style intent, occasion, budget, body context, tone context, and optional natural-language goal.
- Explain why sensitive information is requested.
- Permit correction and skipping where the product remains useful.
- Preserve existing values on partial profile updates.
- Show progress without trapping the user in an irreversible wizard.

### 8.3 Stylist

Stylist presents one complete outfit decision before secondary alternatives.

- Hero composition shows every available slot with consistent framing.
- Evidence rail shows matched constraints, reason, confidence, uncertainty, and the fastest correction.
- Save, skip, shop, correct, and undo have stable event identities.
- Corrections must visibly affect the next recommendation while unrelated constraints stay stable.
- Empty, partial, abstained, stale, loading, error, and unavailable-item states remain useful and honest.
- Portfolio-style alternative looks reuse the shared editorial card only when the content shape matches.

### 8.4 Explore

Explore combines Ref3's discovery grid with Ref4's search-first header.

- The top control is a capsule glass search field containing the original animated dot-cluster mark.
- Search input is debounced or explicitly submitted through the existing retrieval path; replacement searches cancel stale work.
- A custom filter icon opens an accessible sheet/dropdown with occasion, style, garment slot, category, gender scope, and price only when facets support it.
- Applied filters appear as removable pills and reset consistently.
- The feed uses variable but bounded aspect ratios, tight dark gutters, stable keys, dedupe, pagination, refresh, end-of-catalogue, and retry.
- Frames show the complete source image with an intentional `contentFit`; no accidental crop may hide the garment/article.
- Item detail exposes price, currency, availability, retailer, similar items, complete-the-look, save, and affiliate redirect.
- Long-press saving may supplement but never replace a visible Save action.

### 8.5 Wardrobe, Saved, and Collections

Wardrobe prioritizes what the user owns.

- Group by useful garment categories and permit search/filter without duplicating server truth.
- Owned items and products to buy use visibly different labels and actions.
- Capture supports user-initiated image selection, denial/retry, MIME/size/decode checks, EXIF removal, private upload, correction, and deletion only in the authorized wardrobe/photo slice.
- Saved and Collections reuse the same cards, grid logic, states, and item detail instead of cloning screens.
- Empty states lead to one relevant action: add an item, explore, or return to Stylist.

### 8.6 Profile and settings

Profile has four clear regions: identity, real activity facts, portfolio, and account actions.

- Avatar control supports add, replace, remove, upload progress, failure, and privacy copy.
- A valid avatar becomes the Profile tab glyph through `expo-image`; failure falls back to the person SVG without breaking navigation.
- Portfolio shows created outfits, liked outfits, posts, and saved work only when the corresponding data exists.
- Badges display only earned, server-backed facts with anti-abuse rules; no decorative fake achievements.
- Settings lives under Profile/Account and includes system, light, and dark appearance choices, consent, export, deletion, support, grievance, status, and sign out.
- Destructive actions require clear confirmation and must not use optimistic success.

### 8.7 Social and portfolio

Social uses the same editorial visual grammar but remains a distinct safety boundary.

- Feed cards expose creator, garments, reactions, save, share, report, block, and shop where authorized.
- Recreate/restyle adapts inspiration to the follower's constraints and records provenance; it must not imply an exact copy.
- Download and share use explicit user actions and preserve privacy rules.
- Moderation, ownership, empty feed, deleted media, blocked user, and failed upload states are part of acceptance.

### 8.8 Menus and transient surfaces

Menus and filters use Router sheets or one shared accessible dropdown/sheet composition. They provide focus restoration on web, screen-reader announcements on native, Escape/back dismissal, visible close actions, and reduced-motion transitions. Each menu contains only actions relevant to its route.

## 9. Responsive behavior

- Use `useWindowDimensions`, flex layout, existing compact/phone/regular/wide tiers, and safe-area insets.
- Do not fetch or maintain a catalog of phone dimensions.
- Validate at least 360×640 and 430×932 phone viewports, responsive web, and the active contract's compact/regular Android fixtures.
- Foldables and tablets use the same width tiers; add a new breakpoint only after a measured layout failure.
- Grid column count derives from available width and minimum card width.
- Bottom navigation clears gesture insets and keyboard states.
- Text expansion, localization, and right-to-left layout must not hide actions or reorder meaning.

## 10. Images, lists, and performance

### 10.1 Images

Remote garment, outfit, portfolio, and avatar media use `expo-image` with explicit dimensions, a stable recycling key where lists recycle cells, a truthful placeholder, retry, and an appropriate cache policy. Use high priority only for visible hero content; do not mark every grid image high priority. Decode thumbnails at display size and bound prefetching.

### 10.2 Lists

Virtualize every unbounded collection. Use FlatList/SectionList by default where it meets the contract's budgets. Use the already-installed FlashList for measured high-volume or heterogeneous feeds where it improves frame time or memory. Do not place dynamic unbounded data in `ScrollView` with `.map()`.

Every list requires stable keys, memoized item components where profiling supports it, pagination, dedupe, refresh, loading, empty, error, retry, and end state. React Compiler compatibility takes priority over blanket manual memoization.

### 10.3 Motion and frame budget

- Run continuous gesture and layout animation through Reanimated/Gesture Handler.
- Prefer transform and opacity on the UI thread.
- Common feedback lasts 120–240 ms; calm transitions may reach 300 ms.
- Decorative infinite animation is prohibited. The search mark may animate briefly on loading or explicit interaction, then settle.
- Cancel stale animations and honor `ReduceMotion.System`.
- Profile release builds on representative Android hardware and iOS when available; simulator smoothness alone is not acceptance evidence.

### 10.4 Render discipline

Keep callbacks and component identities stable on hot list paths, derive simple values during render, avoid duplicate server state, cancel stale requests, and remove waterfalls where independent requests can start together. Do not add memoization without a stable-prop or measured-render reason.

## 11. Haptic grammar

Haptics supplement visible feedback and run only on supported native devices.

- Selection/light feedback: a confirmed filter or tab selection when native convention supports it.
- Impact/medium feedback: correction applied, save confirmed, or a bounded gesture threshold.
- Success notification: a completed asynchronous save/upload only after server confirmation.
- Error notification: a validation or API failure that also has visible text.
- Destructive warning: before a confirmed destructive boundary where platform convention supports it.

Do not trigger haptics on every tap, keyboard key, scroll event, or animation frame. Web receives no simulated haptic.

## 12. Accessibility

Every route must pass:

- logical screen-reader order and names, roles, hints, values, and selected/expanded states;
- visible focus and keyboard operation on web;
- connected labels and errors for every field;
- accessible icon-only controls and decorative-image exclusion;
- sufficient touch targets and spacing between destructive/primary actions;
- contrast in both themes and on every glass fallback;
- Dynamic Type without clipped actions;
- reduced-motion parity;
- announcements for asynchronous success/failure and expanded/collapsed collections;
- non-gesture alternatives for every core action;
- alt text or meaningful labels for product and user media without inventing unavailable facts.

## 13. Privacy, security, and truth

- Validate route params, API responses, upload metadata, and external URLs at boundaries.
- Keep tokens in SecureStore on native and the approved secure session mechanism on web.
- Strip EXIF and apply private storage, consent purpose, TTL, export, and erasure rules to user media.
- Never log photos, auth material, raw sensitive profile values, or retailer secrets.
- Affiliate redirects disclose the destination and use canonical validated URLs.
- Do not claim price, availability, fit, body inference, or try-on accuracy beyond current evidence.
- A failed capability must show a useful deterministic/manual path.

## 14. Testing and evidence

Each vertical slice uses the smallest test set that proves its risk:

- unit tests for pure grid, theme, filter, profile, validation, and state-transition logic;
- component tests for semantic roles, expanded states, error announcements, and reduced motion;
- transport/contract tests for pagination, cancellation, idempotency, avatar upload, and profile preservation;
- route fixtures for light/dark, loading, empty, partial, stale, offline, denied, error, and destructive states;
- screenshot review against Ref1–Ref7 for composition, not pixel copying;
- physical or representative device checks for touch, keyboard, screen reader, image failure, low-memory paging, and haptics;
- web export, focused tests, typecheck, lint, doctrine, and repository gates required by the active contract.

No phase closes from a route existing, a mock passing, or one attractive screenshot.

## 15. Delivery phases and gates

| Phase | Deliverable | Contract alignment | Exit evidence |
| --- | --- | --- | --- |
| 0. Baseline | Route/state/width inventory, token audit, performance baseline, reference acceptance matrix | P3 preparation | reproducible fixtures and budgets |
| 1. Foundation | Typography, semantic tokens, responsive tiers, themes, glass/icon/motion rules | `EXPO-DESIGN-CORE` | owner-approved Stylist/Explore/detail compositions in both themes |
| 2. Auth and onboarding | Ref5–Ref7 welcome/auth/manual onboarding states | P2/P3, EXPO-05 truth | deployed manual journey, recovery, a11y, privacy |
| 3. Trusted Stylist | Complete outfit, evidence rail, correction loop, feedback actions | `EXPO-CORE-01`, P3 | real deployed correction causality and event joins |
| 4. Explore | Search, animated mark, filters, masonry discovery, detail, complete-the-look | `P5.4-EXPLORE` | deep paging, SLO, dedupe, price/availability, low-end Android |
| 5. Wardrobe | Owned-item organization, capture/correction, Saved/Collections reuse | `P5.2-WARDROBE` | private media and honest own-vs-buy journey |
| 6. Profile and Social | Avatar/tab glyph, professional profile, settings, social portfolio and safety | `P5.5-SOCIAL-PROFILE` | privacy, moderation, deep links, populated journeys |
| 7. Final system | Route-wide design, motion, information architecture, accessibility and performance | `EXPO-19-FINAL` through `EXPO-21` | complete route/state/platform matrix |
| 8. Release | EAS candidates, rollback, store/accessibility/security/performance evidence | P6/F11/F12/HL | owner GO/HOLD/ROLLBACK decision |

Phases are dependency-ordered. A blocked later phase does not justify parallel half-built UI.

## 16. Explicit non-goals

- No Gluestack installation or wholesale component migration.
- No second token, theme, navigation, state, transport, or animation system.
- No device-dimension database or per-model layout branches.
- No blanket FlashList conversion without list semantics and evidence.
- No blanket `priority="high"` image loading.
- No haptic on every tap or keyboard event.
- No decorative looping animation, Lottie pipeline, icon font, or speculative 3D engine.
- No glass on static content cards.
- No photo inference, open try-on, badges, or social claims before their production gates.
- No replacement of existing working primitives merely to match a library example.

## 17. Acceptance criteria

The specification is implemented only when:

1. Every `ScopeofIdea.md` requirement maps to a delivered phase or an explicitly blocked gate.
2. Ref1–Ref7 influence the intended surfaces without copying protected assets.
3. One token and component system governs every completed route.
4. All unbounded collections are virtualized and meet measured device budgets.
5. Remote images have explicit sizing, caching, failure, retry, and accessibility behavior.
6. Motion and haptics follow the bounded grammar and reduced-motion rules.
7. Light, dark, Dynamic Type, screen reader, keyboard, touch, and responsive states pass.
8. Auth, profile media, consent, export, deletion, affiliate links, and failures preserve security and truth.
9. The active contract's exact phase gate passes with recorded rollout and rollback evidence.
10. Obsolete paths are deleted only through the protected cleanup gate.

## 18. Specification decisions

- **Chosen:** evolve the existing Expo/GYF component system.
- **Rejected:** install Gluestack as a second UI runtime.
- **Chosen:** sparse functional glass.
- **Rejected:** glassmorphism on every card.
- **Chosen:** measured FlatList/SectionList/FlashList selection.
- **Rejected:** unconditional component replacement based on a raw scope rule.
- **Chosen:** meaningful haptics after confirmed state changes.
- **Rejected:** haptics on every interaction.
- **Chosen:** phase-gated vertical slices.
- **Rejected:** one global visual sweep across unfinished product surfaces.

