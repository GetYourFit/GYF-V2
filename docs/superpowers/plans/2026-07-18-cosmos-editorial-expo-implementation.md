# GYF Cosmos Editorial Expo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the complete Cosmos Editorial Expo experience defined in `docs/superpowers/specs/2026-07-18-cosmos-editorial-expo-design.md`, including Personal Fit Setup, without bypassing GYF's active phase, privacy, accessibility, performance, or production-evidence gates.

**Architecture:** Extend the existing Expo Router client, GYF primitives, typed `GyfApi`, and FastAPI profile/photo contracts. Keep manual profile truth available at all times; expose photo analysis only behind strict runtime capability gates. Deliver each user surface as a vertical slice with red-green tests, route-state fixtures, device evidence, and rollback before the active contract advances.

**Tech Stack:** Expo 57, React Native 0.86, React 19, Expo Router, TypeScript, Bun tests, Expo Image/Image Picker/Blur/Haptics, Reanimated 4, Gesture Handler, React Native SVG, FastAPI/Pydantic/PostgreSQL, existing OpenAPI types.

## Global Constraints

- The authority order in `AGENTS.md` is binding; this plan never changes the active pointer.
- Implement only the current pointer's allowed write set. A later task starts only after the preceding gate records GO.
- Keep one GYF token/component system. Do not install Gluestack or another UI runtime.
- The Personal Fit Setup page is required after signup; its photo is optional and manual skin-tone/body-type entry always works.
- Photo analysis fails closed behind `photo_body_type` and `photo_skin_tone` runtime capability states.
- Never relabel source prices or silently convert user-entered budgets.
- Use existing dependencies and APIs before adding code or packages.
- Write a failing test before every behavior change and watch the expected failure.
- Preserve unrelated dirty-worktree changes and commit only scoped files.
- Every task runs focused checks; every phase runs `make fmt-check`, `make lint`, `make typecheck`, `make doctrine`, `make test`, and `bun run build`, plus its contract-specific evidence.

---

## File Structure

| Path | Responsibility |
| --- | --- |
| `apps/expo/src/theme/tokens.ts` | One semantic palette, typography, spacing, responsive, and motion contract |
| `apps/expo/src/components/ui/*` | Existing reusable GYF primitives; no second component library |
| `apps/expo/src/components/onboarding/personal-fit-form.tsx` | Shared create/edit Personal Fit Setup UI |
| `apps/expo/src/lib/personal-fit.ts` | Pure validation, confirmation, budget, and analysis-state logic |
| `apps/expo/src/lib/profile-photo.ts` | Image-picker validation and typed photo-upload boundary |
| `apps/expo/src/app/(app)/onboarding.tsx` | New-account Personal Fit route wrapper |
| `apps/expo/src/app/(app)/personal-fit.tsx` | Profile edit route wrapper |
| `apps/expo/src/app/(app)/(tabs)/profile.tsx` | Profile summary and Edit personal fit entry point |
| `apps/expo/src/components/explore/*` | Explore controls, editorial cards, and detail behavior |
| `apps/expo/src/components/grid/*` | Shared virtualized responsive grid behavior |
| `apps/expo/src/design-fixtures/*` | Route/state/width/theme evidence matrix |
| `services/api/app/profile/*` | Existing profile/photo contract and strict capability behavior |
| `services/api/tests/test_profile*.py` | Profile/photo security, merge, abstention, and persistence tests |

## Phase A — Current Pointer: EXPO-DESIGN-CORE

### Task 1: Reconcile the approved design foundation

**Files:**
- Modify: `apps/expo/src/theme/tokens.test.ts`
- Modify: `apps/expo/src/design-fixtures/core-route-states.test.ts`
- Modify: `apps/expo/src/design-fixtures/interaction-boundaries.test.ts`
- Verify existing changes: `apps/expo/src/theme/tokens.ts`
- Verify existing changes: `apps/expo/src/app/_layout.tsx`
- Verify existing changes: `apps/expo/src/components/ui/glass-surface.tsx`
- Verify existing changes: `apps/expo/src/components/navigation/glass-tab-bar.tsx`

**Interfaces:**
- Produces: `typography.display` and `typography.title` use `Fraunces_600SemiBold`; `GlassSurface` owns two non-interactive gradients; live root loads both font families.

- [ ] **Step 1: Preserve the reproduced red baseline**

Run: `cd apps/expo && bun test`

Expected: exactly the three stale design-gate assertions fail because Fraunces and shared glass are now live.

- [ ] **Step 2: Update the tests to the approved contract**

Change assertions so they require live Fraunces loading, require heading variants to share Fraunces, and inspect `glass-surface.tsx` for two `pointerEvents="none"` gradients while confirming `glass-tab-bar.tsx` consumes `GlassSurface`.

- [ ] **Step 3: Run the focused tests**

Run: `cd apps/expo && bun test src/theme/tokens.test.ts src/design-fixtures/core-route-states.test.ts src/design-fixtures/interaction-boundaries.test.ts`

Expected: all focused tests pass with zero failures.

- [ ] **Step 4: Run Expo baseline checks**

Run: `cd apps/expo && bun test && bun run typecheck && bun run build`

Expected: tests, TypeScript, and web export exit 0.

- [ ] **Step 5: Commit the bounded foundation**

Stage only the verified design-foundation files and their lock/manifest changes. Commit: `feat(expo): establish Cosmos editorial foundation`.

### Task 2: Complete route-state design evidence

**Files:**
- Modify: `apps/expo/src/design-fixtures/core-route-states.ts`
- Modify: `apps/expo/src/design-fixtures/core-route-states.test.ts`
- Modify: `apps/expo/src/components/design/core-route-review.tsx`
- Modify: `apps/expo/src/app/design.tsx`

**Interfaces:**
- Produces: deterministic fixtures for Stylist, Explore, item detail/correction, and Personal Fit Setup across compact/regular widths and light/dark themes.

- [ ] **Step 1: Add failing fixture coverage**

Add assertions for Personal Fit manual, analysis-complete, analysis-uncertain, and save-error states; assert every state declares hero, primary action, explanation/error path, and evidence status.

- [ ] **Step 2: Verify red**

Run: `cd apps/expo && bun test src/design-fixtures/core-route-states.test.ts`

Expected: failure naming the missing Personal Fit fixture states.

- [ ] **Step 3: Add the minimal typed fixtures and review compositions**

Use public catalogue imagery only. Do not embed user photos or live controls in review fixtures.

- [ ] **Step 4: Verify green and export**

Run: `cd apps/expo && bun test src/design-fixtures/core-route-states.test.ts && bun run build`

Expected: fixture tests and export pass.

- [ ] **Step 5: Record owner evidence and commit**

Update only the active contract's permitted evidence pointer after owner review. Commit: `test(expo): cover personal fit design states`.

## Phase B — Trusted Personal Fit Setup

### Task 3: Define Personal Fit domain rules

**Files:**
- Create: `apps/expo/src/lib/personal-fit.ts`
- Create: `apps/expo/src/lib/personal-fit.test.ts`
- Modify: `apps/expo/src/lib/onboarding-validation.ts`
- Modify: `apps/expo/src/lib/onboarding-validation.test.ts`

**Interfaces:**
- Produces: `AnalysisState`, `ConfirmedField<T>`, `parseBudgetInput(value: string): number | null`, `validatePersonalFit(profile): PersonalFitErrors`, and `mergePhotoEstimate(current, estimate)`.
- Consumes: generated `ProfileInput` and `BudgetRange` types.

- [ ] **Step 1: Write failing tests**

Cover canonical skin/body values, required confirmations, empty/decimal/negative budget parsing, max below min, currency normalization, partial/abstained analysis, photo replacement, and preservation of user-confirmed values.

- [ ] **Step 2: Verify red**

Run: `cd apps/expo && bun test src/lib/personal-fit.test.ts`

Expected: module-not-found failure for `personal-fit`.

- [ ] **Step 3: Implement the smallest pure model**

Use immutable objects, `Intl.NumberFormat` for display only, and the server's canonical vocabularies. Do not implement currency conversion.

- [ ] **Step 4: Verify green**

Run: `cd apps/expo && bun test src/lib/personal-fit.test.ts src/lib/onboarding-validation.test.ts`

Expected: all Personal Fit validation tests pass.

- [ ] **Step 5: Commit**

Commit: `feat(expo): define personal fit profile rules`.

### Task 4: Add the strict photo-analysis client boundary

**Files:**
- Create: `apps/expo/src/lib/profile-photo.ts`
- Create: `apps/expo/src/lib/profile-photo.test.ts`
- Modify: `app/lib/api.ts`
- Modify generated types only through: `make types`

**Interfaces:**
- Produces: `validateProfilePhotoAsset(asset)`, `uploadProfilePhoto(api, asset)`, and a typed normalized estimate result.
- Consumes: `POST /profile/photo`, `systemStatus()`, `capabilityUsable`, `expo-image-picker` assets.

- [ ] **Step 1: Write boundary tests**

Test unsupported MIME, missing bytes, invalid base64, oversize payload, strict capability refusal, body-only result, skin-only result, abstention, safe server error, and successful typed result.

- [ ] **Step 2: Verify red**

Run: `cd apps/expo && bun test src/lib/profile-photo.test.ts`

Expected: missing boundary functions fail.

- [ ] **Step 3: Implement by reusing the existing authenticated API transport**

Add one multipart method to the shared transport. Do not add Axios or another API client. Request image-picker permission only from the UI action.

- [ ] **Step 4: Verify client and server contracts**

Run: `cd apps/expo && bun test src/lib/profile-photo.test.ts`

Run: `uv run pytest services/api/tests/test_profile_photo.py services/api/tests/test_profile.py -q`

Expected: both suites pass; generated OpenAPI types remain clean.

- [ ] **Step 5: Commit**

Commit: `feat(profile): expose gated photo analysis client`.

### Task 5: Build the shared Personal Fit form

**Files:**
- Create: `apps/expo/src/components/onboarding/personal-fit-form.tsx`
- Modify: `apps/expo/src/components/onboarding/onboarding-form.tsx`
- Modify: `apps/expo/src/app/(app)/onboarding.tsx`
- Create: `apps/expo/src/app/(app)/personal-fit.tsx`
- Create: `apps/expo/src/design-fixtures/personal-fit-boundaries.test.ts`

**Interfaces:**
- Produces: `<PersonalFitForm mode="create" | "edit" onSaved={...} />`.
- Consumes: Tasks 3–4 validation and upload functions, `GyfApi.getProfile/putProfile`, consent API, theme primitives, Image Picker, and haptics.

- [ ] **Step 1: Write failing source/behavior checks**

Require accessible photo action, explicit optional-photo copy, skin/body dropdowns, currency and min/max budget fields, visible estimate labels, analysis-state messaging, duplicate-submit guard, and create/edit labels.

- [ ] **Step 2: Verify red**

Run: `cd apps/expo && bun test src/design-fixtures/personal-fit-boundaries.test.ts`

Expected: missing Personal Fit component and controls.

- [ ] **Step 3: Implement create mode**

Reuse `AuthScreen`, `GyfText`, `AtelierButton`, `AtelierCard`, `GlassSurface`, and existing consent/profile calls. Render photo controls only when strict capabilities allow them; render the complete manual path always.

- [ ] **Step 4: Implement edit mode without duplication**

Load existing values, preserve unrelated fields, distinguish estimates from confirmed selections, do not rerun analysis on mount, and leave server state untouched on cancel/back.

- [ ] **Step 5: Verify all states**

Run: `cd apps/expo && bun test src/lib/personal-fit.test.ts src/lib/profile-photo.test.ts src/design-fixtures/personal-fit-boundaries.test.ts && bun run typecheck`

Expected: all focused tests and typecheck pass.

- [ ] **Step 6: Commit**

Commit: `feat(expo): add personal fit setup and editing`.

### Task 6: Route new accounts and expose Profile editing

**Files:**
- Modify: `apps/expo/src/components/navigation/session-gate.tsx`
- Modify: `apps/expo/src/app/(app)/(tabs)/profile.tsx`
- Modify: `apps/expo/src/components/navigation/glass-tab-bar.tsx`
- Create or modify focused tests beside session/profile pure helpers.

**Interfaces:**
- Produces: new/unonboarded sessions route to `/onboarding`; Profile exposes `/personal-fit`; saved avatar remains the Profile tab glyph with SVG fallback.

- [ ] **Step 1: Write failing routing/profile tests**

Cover authenticated-not-onboarded, authenticated-onboarded, profile edit link, cancel, save/refetch, avatar success, and avatar failure fallback.

- [ ] **Step 2: Verify red**

Run the new focused Bun tests and confirm missing route/edit behavior fails.

- [ ] **Step 3: Implement the smallest shared routing decision and profile action**

Do not duplicate profile state into a new store. Navigate with Expo Router and refetch on successful edit.

- [ ] **Step 4: Verify green and activation-loop regressions**

Run: `cd apps/expo && bun test src/lib/activation-loop.test.ts src/lib/profile-summary.test.ts src/lib/avatar-upload.test.ts && bun run typecheck`

Expected: all pass.

- [ ] **Step 5: Commit**

Commit: `feat(expo): route personal fit setup and profile edits`.

## Phase C — Earned Surface Expansion

### Task 7: Finish Explore editorial discovery (`P5.4-EXPLORE` only)

**Files:**
- Modify: `apps/expo/src/app/(app)/(tabs)/explore.tsx`
- Modify: `apps/expo/src/components/explore/item-detail-sheet.tsx`
- Modify: `apps/expo/src/components/grid/expandable-collection-grid.tsx`
- Create: `apps/expo/src/components/explore/animated-gyf-mark.tsx`
- Create: `apps/expo/src/components/explore/explore-control-bar.tsx`
- Modify: `apps/expo/src/lib/explore-feed.ts`
- Modify: `apps/expo/src/lib/explore-feed.test.ts`

**Interfaces:** stable search/filter request, cancellation, dedupe, pagination, honest facets, item detail, and complete-the-look.

- [ ] Add failing tests for reset, replacement search, missing facets, dedupe, end state, and source-currency truth.
- [ ] Run focused tests and confirm expected failures.
- [ ] Implement the original dot mark, glass control bar, accessible filter sheet, and virtualized editorial feed using existing dependencies.
- [ ] Profile FlatList versus installed FlashList on contract hardware; keep only the measured winner and delete the duplicate path.
- [ ] Run Explore tests, typecheck, export, deployed India SLO/dedupe/affiliate evidence, and low-end Android profiling.
- [ ] Commit: `feat(expo): complete editorial Explore discovery`.

### Task 8: Finish Wardrobe, Saved, and Collections (`P5.2-WARDROBE` only)

**Files:**
- Modify: `apps/expo/src/app/(app)/(tabs)/wardrobe.tsx`
- Modify: `apps/expo/src/app/(app)/saved.tsx`
- Modify: `apps/expo/src/app/(app)/collections.tsx`
- Modify: `apps/expo/src/lib/wardrobe-feed.ts`
- Modify: `apps/expo/src/lib/wardrobe-feed.test.ts`

- [ ] Add failing tests for owned-versus-buy labeling, categories, add/correct/remove, empty/error/end states, and shared-card behavior.
- [ ] Verify red, implement one shared grid/detail path, then verify green.
- [ ] Prove private media, manual correction, erasure, and real owned-item styling on deployed data.
- [ ] Commit: `feat(expo): complete editorial wardrobe flow`.

### Task 9: Finish Social and professional Profile (`P5.5-SOCIAL-PROFILE` only)

**Files:**
- Modify: `apps/expo/src/app/(app)/(tabs)/social.tsx`
- Modify: `apps/expo/src/app/(app)/(tabs)/profile.tsx`
- Modify: `apps/expo/src/lib/social-feed.ts`
- Modify: `apps/expo/src/lib/social-feed.test.ts`
- Modify: `apps/expo/src/lib/profile-summary.ts`
- Modify: `apps/expo/src/lib/profile-summary.test.ts`

- [ ] Add failing tests for ownership, follow/react idempotency, report/block, creator metadata, truthful badges, portfolio states, and adapted-look provenance.
- [ ] Verify red, implement shared editorial cards and safety actions, then verify green.
- [ ] Prove moderation, privacy, deep links, sharing, download, and populated real-data journeys.
- [ ] Commit: `feat(expo): complete social profile experience`.

## Phase D — Final Experience and Release

### Task 10: Apply final motion and haptic grammar (`EXPO-19-FINAL`)

**Files:**
- Modify touched components under `apps/expo/src/components/`
- Modify: `apps/expo/src/lib/haptics.ts`
- Add focused source/behavior tests under `apps/expo/src/design-fixtures/`

- [ ] Add failing tests for reduced motion, animation cancellation, no decorative loops, and bounded haptic calls.
- [ ] Implement transform/opacity Reanimated transitions and confirmed-action haptics only.
- [ ] Verify physical Android/iOS behavior and visible equivalents.
- [ ] Commit: `feat(expo): finalize motion and haptic grammar`.

### Task 11: Complete route-by-route aesthetic and responsive acceptance (`EXPO-20/21`)

**Files:**
- Modify: `apps/expo/src/design-fixtures/core-route-states.ts`
- Modify: `apps/expo/src/design-fixtures/core-route-states.test.ts`
- Modify only failing route/component files identified by the matrix.

- [ ] Expand the matrix to every route, state, theme, width, and platform.
- [ ] Add one failing fixture/assertion for each discovered gap before fixing it.
- [ ] Verify screen reader, keyboard, Dynamic Type, RTL, contrast, touch, safe-area, offline, retry, and destructive states.
- [ ] Verify remote images have dimensions, cache/failure/retry/labels; verify unbounded collections are virtualized.
- [ ] Run the full repository gate and commit: `fix(expo): close final experience matrix`.

### Task 12: Release evidence and rollback

**Files:**
- Update only the active contract/evidence/runbook paths authorized by P6/HL.

- [ ] Run fresh full checks: `make fmt-check`, `make lint`, `make typecheck`, `make doctrine`, `make test`, `bun run build`.
- [ ] Run production-mode web, Android, and iOS checks; record startup, frame, memory, bundle, network, accessibility, privacy, and cost results.
- [ ] Build signed EAS candidates only after Expo Go and development evidence require them.
- [ ] Exercise rollback, account deletion, media erasure, offline recovery, and staged-release controls.
- [ ] Record GO/HOLD/ROLLBACK against the exact commit; do not claim hard launch from local success.
- [ ] Commit: `docs(release): record Cosmos editorial release evidence`.

## Plan Self-Review

- Spec coverage: all design-spec sections map to Tasks 1–12.
- Scope control: later surface tasks name their required active pointers.
- Dependency control: no new runtime library is required by the plan.
- Type consistency: `PersonalFitForm`, `AnalysisState`, `ConfirmedField`, `parseBudgetInput`, `validatePersonalFit`, and `uploadProfilePhoto` have one spelling and owner.
- Security/privacy: manual fallback, strict capability gating, validation, EXIF/media handling, partial updates, and truthful failure are explicit.
- No placeholders: each task names files, behavior, verification, gate, and commit.
