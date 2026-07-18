# Expo Design Core Evidence — 2026-07-18

Status: **EVIDENCE ONLY — HOLD; physical Android evidence remains open**

This record covers only `EXPO-DESIGN-CORE`. It does not promote later phases.

## Workstation evidence

| Gate | Result | Evidence |
| --- | --- | --- |
| Token source | PASS | `tokens.ts` owns colour, material, spacing, width, radius, type, motion, and elevation values. A source test rejects scattered material RGBA values in shared glass and P2 detail surfaces. |
| Component source | PASS | P2 routes reuse `GyfText`, `AtelierButton`, `PressableScale`, `GlassSurface`, `CatalogImage`, `ProductCard`, confidence, loading, empty, and error primitives. No second UI runtime is installed. |
| Route-state matrix | PASS for deterministic fixtures | Stylist, Explore, item detail/correction, and Personal Fit declare happy, loading, empty/partial, error, offline/capability, and manual/uncertain states across 320, 390, 768, and 1280 widths in light and dark. Fixture tests preserve the matrix. |
| Contrast | PASS for token pairs | `tokens.test.ts` enforces 4.5:1 text contrast and 3:1 large/state contrast in both themes. |
| Touch and semantics | PASS for source/unit gates | Shared target math enforces at least 48 dp; P2 controls expose labels, roles, busy/disabled/selected state, visible errors, and text equivalents for haptics. |
| Reduced motion | PASS for source/unit gates | Reanimated paths use `ReduceMotion.System`; the bounded Spark animation cancels during cleanup. |
| Remote imagery | PASS | P2 remote images require HTTPS and use one `expo-image` primitive with explicit geometry, disk caching, stable recycling keys, accessible failure text, and retry. |
| Lists | PASS for current P2 volume | Explore uses `FlatList` with stable keys, pagination, dedupe, refresh, empty, loading, and end states. Fixed chip/pairing/outfit groups remain bounded `ScrollView` content. Unused FlashList was removed. |
| Expo graph | HOLD | `expo install --check` reports current dependencies, but a clean frozen-lockfile install makes Expo Doctor pass only 19/20: `expo-linking` retains `expo-constants` 57.0.5 beside the SDK's 57.0.6. Bun override, plain/forced lock regeneration and an equivalent resolution did not deduplicate it; no hand-edited lockfile is accepted. |
| Repository CI | PASS locally | Canonical local gates passed formatting, JavaScript/Python lint, global types, doctrine, 438 API tests (20 environment-gated skips), 130 Expo tests (3,165 assertions), and 77 retained-web tests. GitHub main CI remains red on the separately recorded trailing-whitespace failure until the clean branch changes are pushed. |
| Web bundle | PASS | 51-route export; 2,490,185 bytes against the executable 2,700,000-byte ceiling. |
| Android bundle | PASS | Hermes export; 4,689,439 bytes against the executable 5,000,000-byte ceiling. |
| Production web | PASS | EAS deployment `emrc2qswgs` serves `entry-d5d5fa310a208df6c8376dc8471bf6c9.js` at both its immutable URL and `https://get-your-fit.expo.app` with HTTP 200. Both remote bundles exactly match the local SHA-256 `212870c76af4d8cf1da6999859e5a33b6d2124b622fd21b79ecb89d8411829cc`. Deployment `4z5dx9grt2`, mistakenly created from the Android export directory, returned 404 and was rejected and superseded before this evidence was accepted. |

## Required physical evidence

These checks require the owner's Android device and remain HOLD:

- compact and regular Android screenshots for the P2 review routes in light and dark;
- Expo Go launch, tab, back, deep-link, offline/retry, and image-failure smoke;
- TalkBack order, names, roles, values, actions, and error announcements;
- largest font/display scale, reduced motion, rotation, keyboard, and safe-area checks;
- release-mode startup, frame-time, memory, image-decode, and scroll measurements;
- visible confirmation for save/correction/error haptics on supported hardware.

Connect Expo Go to `exp://192.168.1.21:8081`. The persistent server runs in tmux session `gyf-design`.
