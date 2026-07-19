# GYF Design-First Evidence Sequencing

Status: **APPROVED DESIGN — subordinate to the active execution contract until that contract records the owner amendment**

Date: 2026-07-19

## Decision

The owner has no physical Android device and wants the complete Cosmos Editorial design build before native acceptance testing. The project will implement the approved design surfaces now and defer only tests that require physical hardware. Automated tests, type checks, doctrine checks, builds, bundle budgets, accessibility assertions, and production-web verification remain mandatory during implementation.

## Build lane

The active contract will add one bounded `COSMOS-DESIGN-BUILD` pointer. This pointer permits the UI, pure domain logic, typed client boundaries, fixtures, and focused server-contract work named in Tasks 3–11 of the approved Cosmos implementation plan. Work remains sequential and uses the existing Expo Router client, GYF primitives, typed transport, and FastAPI contracts.

Each task must:

- begin with a reproduced failing test for each behavior change;
- preserve manual profile truth, strict capability closure, source-currency truth, privacy, and accessibility;
- pass its focused tests and type checks;
- pass canonical repository CI and fresh web and Android exports before its phase commit;
- use one design system and the current dependency graph unless a measured requirement proves otherwise;
- commit and push only implementation-owned files.

The build lane may implement a surface whose product gate remains unproved. It must label unavailable capabilities honestly, keep them closed at runtime, and avoid `GO`, beta, release, or production-readiness claims.

## Hosting boundary

Expo is the only client and hosting target for this work. The first implementation task must remove the active Vercel deployment job and Vercel Make targets before any design-code commit can reach `main`. Later commits may build and deploy only `apps/expo` through EAS Hosting at `https://get-your-fit.expo.app`.

No workflow, preview, production promotion, rollback, or manual command may deploy this design build to Vercel. Existing Vercel external state remains untouched; it is neither a deployment target nor a rollback target.

## Deferred native acceptance

Physical-device evidence moves to one release-blocking `NATIVE-ACCEPTANCE` pointer after the design build. It retains every unresolved hardware check:

- compact and regular Android screenshots in light and dark;
- launch, navigation, deep-link, offline, retry, and image-failure journeys;
- TalkBack names, roles, values, actions, order, and error announcements;
- largest font and display scales, reduced motion, rotation, keyboard, and safe areas;
- release-mode startup, frame time, memory, image decoding, and scrolling;
- visible confirmation for supported haptics;
- final owner visual acceptance.

The project must obtain this evidence from real Android hardware before native release or public-launch approval. An external tester or real-device service may supply it. An emulator can strengthen development evidence but cannot be described as physical-device proof. Expo documents [installable APK builds](https://docs.expo.dev/build-reference/apk/) and [EAS Workflow Maestro tests](https://docs.expo.dev/eas/workflows/examples/e2e-tests/) as available later-stage tools.

## Evidence states

The design lane ends in `DESIGN BUILD COMPLETE — NATIVE ACCEPTANCE HOLD` when Tasks 3–11 pass their automated gates. It does not close `EXPO-DESIGN-CORE`, `EXPO-19`–`EXPO-21`, a P5 product gate, Task 12, or hard launch.

`NATIVE-ACCEPTANCE GO` requires the physical evidence above against the exact tested commit. Failures return to the smallest owning design task, add a red regression where automation can represent the defect, and rerun both automated and physical checks.

## Rejected alternatives

- Remaining blocked until the owner buys a device delays all design work without improving its quality.
- Treating an emulator or web screenshot as physical evidence creates a false release claim.
- Removing automated tests until the end makes defects harder to isolate and contradicts the approved implementation plan.

## Rollback

Each task remains a bounded commit. A regression reverts the smallest failing task or component. The verified EAS Hosting deployment stays the rollback target until a later Expo deployment passes the same hosting proof.
