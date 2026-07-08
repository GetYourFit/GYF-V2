# GYF Flutter App (frontend)

Frontend-only Flutter app for GYF, built from `../Front/16_IMPLEMENTATION_PLAN.md`
(source docs: `../Front/00…15`). UI, design system, motion, haptics, accessibility —
no backend logic; data goes through mocked repositories.

## Toolchain

The Flutter SDK lives in `../.tooling/flutter` (3.44.5 stable). Because the sandbox
blocks writes to `$HOME`, always invoke it through the wrapper, which redirects
`HOME`/`PUB_CACHE` into `../.tooling`:

```sh
../.tooling/gyf-flutter pub get
../.tooling/gyf-flutter analyze
../.tooling/gyf-flutter test
```

## Status

- **Phase 0 — Design tokens: done.** `lib/app/design_tokens/` (colors incl. semantic
  `GyfColorScheme` ThemeExtension for light+dark, typography, spacing, shape/elevation/
  blur/opacity, motion, haptic tokens, breakpoints/icons) + `lib/app/theme/gyf_theme.dart`
  building both ThemeData entirely from tokens. Theme switch animates 250 ms.
- **Phase 1 — in progress.** Services: HapticService (throttling + levels, tested),
  ThemeManager (persisted), AccessibilityManager, AnimationManager (reduced-motion gate).
  Navigation: GoRouter `StatefulShellRoute` with the 5 tabs (per-tab state preserved),
  deep-link fallback screen, internal `/gallery` component gallery.
  First primitives: GyfPrimaryButton, GyfEmptyState, GyfSkeleton (shimmer).
- **Next:** remaining §5.3 component library (cards, inputs, overlays, feedback, status,
  AI components), golden tests, then Phase 2 (splash/onboarding/auth).

Architecture rules (enforced in review): tokens only — no raw hex/px/ms in widgets;
features never import other features' UI; haptics only via HapticService; 5-state
matrix on every async surface; copy from `11_UX_WRITING_GUIDE`.
