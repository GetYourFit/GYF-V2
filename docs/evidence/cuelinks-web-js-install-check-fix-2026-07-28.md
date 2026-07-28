# Cuelinks web JS installation-check fix — 2026-07-28

Follows up on [`cuelinks-web-js-integration-2026-07-22.md`](./cuelinks-web-js-integration-2026-07-22.md).
Does not promote any HL-* or F-phase gate; this is a link-conversion earning fix, separate from
product-feed display (Cuelinks V3 has no product feed endpoint).

## Problem

The Cuelinks dashboard's EXPO channel installation check for `https://get-your-fit.expo.app`
reported "Javascript Code added is incorrect", even though the 2026-07-22 loader
(`apps/expo/src/lib/cuelinks-web.ts` + `apps/expo/src/app/+html.tsx`) was live in production and
functionally equivalent to Cuelinks' snippet (confirmed via `curl https://get-your-fit.expo.app/`).

## Root cause

Cuelinks' installation checker matches the literal snippet text (quote style, spacing, inline
ternary), not just functional equivalence. The prior loader used double quotes, spaced `=`, and a
`d.location`/named-function-argument rewrite that differed byte-for-byte from Cuelinks' own
snippet, which the captain's dashboard screenshot quoted verbatim.

## Fix

`buildCuelinksWebLoaderScript` in `apps/expo/src/lib/cuelinks-web.ts` now emits Cuelinks' EXPO
channel snippet close to byte-for-byte: `var cId='305057';`, single-quoted strings, no spacing
around `=`, and the inline
`(location.protocol=='https:'?'https://cdn0.cuelinks.com/js/':'http://cdn0.cuelinks.com/js/')+'cuelinksv2.js'`
ternary, appended to `document.body` via `getElementsByTagName('body')[0].appendChild(s)`. The
detectable markers (`id="gyf-cuelinks-web-loader"`, `data-gyf-cuelinks-web`, `data-cuelinks-cid`,
`gyf-cuelinks-web-cid` meta) are unchanged so existing tests/tooling can still find the loader.

Web-only scope is unchanged: the snippet is injected exclusively through Expo Router's web-only
root document hook (`apps/expo/src/app/+html.tsx`, the `+html` convention Expo Router only renders
for web static export). Native iOS/Android builds never load this file.

## Verification

- `bun test apps/expo/src/lib/cuelinks-web.test.ts` — updated assertions for the literal snippet
  text pass.
- `npx expo export --platform web --clear` then inspected `apps/expo/dist/index.html`: the exported
  static HTML contains the exact literal snippet inline in `<body>`, confirming the built web output
  (not just source) carries the fix.
- No secrets added; only the public numeric Cuelinks cId (`305057`, `EXPO_PUBLIC_CUELINKS_CID`
  configurable) appears in client code, same as before.
