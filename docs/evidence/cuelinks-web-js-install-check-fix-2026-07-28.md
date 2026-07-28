# Cuelinks web JS installation diagnosis — 2026-07-28

This remains a supplemental browser-side conversion lane. It does not promote an F/HL gate and does
not solve Cuelinks product-feed credentials or product-card title/image/price/availability sourcing.
Those remain separate from JavaScript link conversion.

## Reproduction before correction

The public raw response for `https://get-your-fit.expo.app` returned HTTP 200 with the static Expo
loader in `body`, public cId `305057`, and no `Content-Security-Policy` response header. The deployed
inline source was:

```js
var cId='305057';
(function() {
  var s = document.createElement('script');
  s.type = 'text/javascript';
  s.async = true;
  s.src = (location.protocol=='https:'?'https://cdn0.cuelinks.com/js/':'http://cdn0.cuelinks.com/js/')+'cuelinksv2.js';
  document.getElementsByTagName('body')[0].appendChild(s);
}());
```

A direct read-only HTTPS request to `https://cdn0.cuelinks.com/js/cuelinksv2.js` returned HTTP 200
with `application/javascript`. The dashboard itself was not available without captain credentials,
so its result cannot be independently reproduced here.

`chrome-devtools-axi` was attempted for the required browser DOM/network/console capture, but this
worker host has no Google Chrome executable. That is an environment limitation, not equivalent to a
browser success result; the post-deploy procedure below remains required.

## Root cause analysis

- **Initiating trigger:** PR 48 changed the production static loader from the supplied vendor source
to a single-quoted, no-argument rewrite.
- **Earliest divergence:** raw delivered HTML differs from the captain-provided reference at the
first executable line (`var cId='305057';` rather than `var cId =  "305057";`) and throughout the
function body (`document` rather than the supplied `(d, t)` form, quote/spacing/operator changes).
- **Masking condition:** local/export and direct CDN checks only establish executable equivalence;
they cannot establish a literal-source dashboard scanner's acceptance.
- **Visible symptom:** the Cuelinks EXPO dashboard continues to report that JavaScript is incorrect.

The leading explanation is literal-source matching. It is falsified if a fresh deployed page contains
the supplied source exactly once, the browser requests the CDN successfully without CSP/console
errors, and the dashboard still rejects it after its normal scan/cache interval.

## Correction and regression proof

`buildCuelinksWebLoaderScript` now emits the captain-provided reference exactly, including the
public cId, two spaces before the cId literal, `(function(d, t) {`, double quotes, and `}());`.
`+html.tsx` remains Expo Router's web-only static document hook, so native iOS/Android bundles do
not import or execute this loader. The static document contains exactly one loader; hydration and
SPA route changes do not recreate `+html.tsx`.

`apps/expo/scripts/verify-cuelinks-web-export.mjs` runs as part of the Expo `build` script. It
inspects every freshly exported HTML page and fails unless each has exactly one loader in `body` with
the exact executable vendor source. Focused unit coverage also executes the loader against a minimal
DOM, proving one HTTPS CDN script append, and asserts the native root layout has no Cuelinks import.

## Required post-merge production evidence

1. Fetch the deployed raw HTML and confirm one exact loader for cId `305057` in `body`.
2. Use Chrome DevTools on the deployed URL to capture runtime DOM placement, console/CSP errors, and
the `https://cdn0.cuelinks.com/js/cuelinksv2.js` request/status.
3. Run the Cuelinks dashboard installation check with captain credentials after any vendor cache
window. Record pass/fail rather than inferring it from source.
4. If it still fails despite the three public checks, record the dashboard/cache/vendor blocker and
escalate it; do not claim installation is fixed.
