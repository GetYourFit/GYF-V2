# Expo EAS immutable deployment header blocker — 2026-07-30

## Incident

CD run `30519352337` created and promoted an EAS immutable deployment from the exact
main SHA, then correctly failed verification at
`https://get-your-fit--gb43dfhr1j.expo.app`. The verifier found every required
security header except `X-Frame-Options: DENY`. Promotion and bundle provenance
therefore did not count as deployment success.

The checked-in `expo-router` plugin configuration already contained all five
headers. The local export route manifest also contained `X-Frame-Options: DENY`,
but the deployed EAS response omitted it. This isolates the blocker to the
provider-side response transformation, not the verifier or source configuration.
The other live headers were present, including `Content-Security-Policy:
frame-ancestors 'none'`; that CSP is defense in depth, not a substitute for the
explicit X-Frame-Options contract.

## Fix

`apps/expo/src/app/+middleware.ts` is now enabled through
`expo-router.unstable_useServerMiddleware` and calls `expo-server`'
`setResponseHeaders` with the same five-header contract. This applies the headers
at the server response boundary for HTML and API responses while retaining the
exported `expo-router` configuration. It does not weaken the verifier, provenance
check, immutable URL requirement, API probes, Cuelinks check, alias cache policy,
or rollback record.

The minimum local export proved both paths:

- with the plugin configuration, `dist/server/_expo/routes.json` contains all five
  headers and an exported middleware bundle;
- with `X-Frame-Options` deliberately removed from the plugin configuration, the
  route manifest omits it but `npx expo serve dist` still returns
  `x-frame-options: DENY` from middleware, and the immutable deployment verifier
  passes all five headers plus the exported entry bundle.

The provider limitation is not treated as a reason to weaken EAS verification or
switch production silently. A fresh main CD deployment must prove the fix at its
own immutable URL before it is a release/rollback artifact. If EAS still omits the
header after middleware, hold the deployment and use the already-approved
commercial static-host path only through its own header, immutable-artifact and
rollback gate; no provider purchase or cutover is authorised by this change.

## Cost and remaining holds

The fix adds no dependency, vendor, recurring cost, secret, or hosting change.
The physical-device/native acceptance, EAS live redeploy, API production evidence,
Cuelinks production evidence, and global F2.5 India-vantage SLO/EXPLAIN gate remain
open. This document records a local reproduction and fix, not production launch
success.
