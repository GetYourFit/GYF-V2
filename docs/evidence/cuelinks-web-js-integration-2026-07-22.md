# Cuelinks web JS integration evidence — 2026-07-22

This records the Expo web/static Cuelinks JavaScript integration requested by the captain. It does
**not** promote HL-EXPLORE, HL-BUSINESS, F10 or any public-launch gate.

## What changed

- Expo web now has a root document hook at `apps/expo/src/app/+html.tsx` that emits a detectable
  inline loader with:
  - `id="gyf-cuelinks-web-loader"`
  - `data-gyf-cuelinks-web="true"`
  - `<meta name="gyf-cuelinks-web-cid" ...>`
  - the browser-only `cdn0.cuelinks.com/js/cuelinksv2.js` loader.
- The public web snippet id is fixed in source to captain-provided `305057` through
  `apps/expo/src/lib/cuelinks-web.ts`. `EXPO_PUBLIC_CUELINKS_CID` may only repeat that same public
  value; divergent overrides now fail the build/test path.
- No API token, Cuelinks transaction token or other secret is added to frontend code. The value is
  the public snippet/channel id only.

## Operator alignment with existing `274785`

The repository already uses server-side `GYF_CUELINKS_CID=274785` in `render.yaml` and the FastAPI
`CuelinksLinker` for catalogue/recommendation `buy_url` wrapping. That server-side path remains the
authoritative product-card commerce lane because it preserves product-level URLs and structured
subids for recommendation/catalogue reconciliation.

The new Expo web JavaScript is supplemental link-conversion/earning safety for static web pages. It
should not be used as product ingestion and should not replace backend `buy_url` generation. The
frontend snippet id and backend deeplink channel remain separate lanes; changing that relationship
requires a separate operator decision, not a frontend env override.

## Detection and tests

- `apps/expo/src/lib/cuelinks-web.test.ts` proves the default cId is `305057`, rejects divergent env
  overrides, builds a loader that appends `cuelinksv2.js`, and verifies the Expo `+html.tsx`
  document hook contains the visible marker.
- A built web/static page can be inspected for `gyf-cuelinks-web-loader`,
  `gyf-cuelinks-web-cid`, `data-cuelinks-cid`, and `cuelinksv2.js`.

For the 2026-07-28 source-divergence diagnosis and the still-required post-deploy dashboard/browser
checks, see [`cuelinks-web-js-install-check-fix-2026-07-28.md`](./cuelinks-web-js-install-check-fix-2026-07-28.md).

## Product boundary

Product discovery still comes from backend API/feed ingestion and real catalogue data. Product cards
must continue using backend-provided `buy_url`/`affiliate_url` values; the Cuelinks web script only
adds supplemental browser-side conversion coverage for web.
