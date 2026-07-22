# Cuelinks shop-flow readiness evidence — 2026-07-22

This is implementation/evidence for the Cuelinks shop-flow readiness task. It does **not**
promote a launch gate.

## What is implemented

- Catalogue/recommendation shop URLs are wrapped server-side through `CuelinksLinker` when
  `GYF_CUELINKS_CID=274785` is configured.
- Recommendation shop links use `subid=<recommendation_id>`; catalogue browse/search now use
  structured `subid=catalog_<item_id>`; pre-existing product-level Cuelinks deeplinks are
  rewrapped with the requested GYF subid instead of silently losing attribution.
- The linker now hides unsafe or non-product shop destinations instead of surfacing a
  broken/misleading CTA:
  - non-HTTPS URLs;
  - naked retailer home pages;
  - Cuelinks shortlink/aggregator hosts such as `clnk.in` and `*.clnk.in` when no product URL is
    present;
  - `linksredirect.com` links whose embedded `url=` target is only a home page.
- Subids containing unsafe/free-text characters are hashed before leaving GYF, so accidental user
  data is not leaked to affiliate URLs.
- Expo shop surfaces now show a visible affiliate disclosure before shop actions: GYF may earn a
  commission; ranking and price are not changed.
- The retained Next.js rollback/oracle surfaces use the same frontend URL guard and visible
  disclosure for shop actions until F13 deletes that client.

## Safe external validation

Network validation used redirect-only GET requests with no login, cart, checkout or purchase action.

### Captain-provided links

`https://clnk.in/BKo4`

1. `301 -> https://linksredirect.com/?cid=274785&source=linkkit&url=https%3A%2F%2Fwww.adidas.com.hk%2F`
2. `302 -> https://invol.co/...&url=https%3A%2F%2Fwww.adidas.com.hk%2F`
3. `302 -> https://click.linksynergy.com/deeplink?...&murl=https%3A%2F%2Fwww.adidas.com.hk`
4. `302 -> https://www.adidas.com.hk?...affiliate tracking...`
5. Retailer returned automated `403 Access Denied`, but the destination was a tracked **home page**,
   not a product path.

`https://ajo.clnk.in/BKo6`

1. `301 -> https://linksredirect.com/?cid=274785&source=linkkit&url=https%3A%2F%2Fajiogram.ajio.com%2F`
2. `302 -> https://tracking.ajio.business/click?...&sub1=cuelinks_274785`
3. `302 -> https://ajiogram.ajio.com/?utm_source=cuelinks&...`
4. Retailer returned automated `403 Access Denied`, but the destination was a tracked **home page**,
   not a product path.

Verdict: the provided Cuelinks links prove Cuelinks redirect attribution can reach retailer home
pages, but they do **not** provide product title, image, price, availability or product URL data.
GYF must not pretend products can be derived from these links alone.

### Representative GYF generated catalogue link

Production browse returned real catalogue rows with product-level wrapped URLs, e.g.:

- item: `Rare Rabbit Men's Fullsleen Beige Cotton Plain Regular Fit Full Sleeve Collared Shirt`
- GYF buy URL captured in that earlier proof (current catalogue links use the structured
  `catalog_<item_id>` subid form):
  `https://linksredirect.com/?cid=274785&source=api&subid=catalog&url=https%3A%2F%2Fwww.thehouseofrare.com%2Fproducts%2Ffullsleen-mens-shirt-beige`
- redirect chain:
  1. `linksredirect.com` ->
     `performance.gotrackier.com/click?...&url=https%3A%2F%2Fwww.thehouseofrare.com%2Fproducts%2Ffullsleen-mens-shirt-beige`
  2. tracker ->
     `https://www.thehouseofrare.com/products/fullsleen-mens-shirt-beige?...Affiliate...`
  3. retailer canonicalized host ->
     `https://thehouseofrare.com/products/fullsleen-mens-shirt-beige?...Affiliate...`
  4. final response `200 text/html`, Shopify `template-product` page.

Verdict: generated GYF links can hand off to a product page when the catalogue row already contains
an existing product-level retailer URL.

## Exact blocker for captain-provided links

Blocked for product extraction from `https://clnk.in/BKo4` and `https://ajo.clnk.in/BKo6`: those
links are Cuelinks linkkit shortlinks to retailer/aggregator home pages. To show products derived
from that Cuelinks flow, GYF needs one of:

1. a Cuelinks/product-feed integration or API credential that returns product rows with title, image
   URL, price/currency, availability, retailer identity and product-level deep link; or
2. product-level retailer/affiliate deep links for the intended Adidas/AJIO products, not home-page
   shortlinks; or
3. permission to ingest an approved retailer/product feed for those merchants and then wrap each
   product URL through Cuelinks.

A Cuelinks conversion/reporting token alone is insufficient; it can reconcile transactions after
clicks, but it does not create product catalogue data.

## Cuelinks SDK/snippet review (captain-provided, 2026-07-22)

Captain supplied two additional Cuelinks materials for review: the
`Cuelinks-React-Native-Integration-Guideline.pdf` (v1.0.0) and the `cuelinksv2.js` site snippet
loaded with `cId=274785`. Both were fetched and inspected.

- **React Native SDK (`link-kit`)**: an Android-only native module (Gradle dependency
  `com.cuelinks.sdk:link-kit`, an `AndroidManifest` `channelId` meta-data entry, a
  `ReactContextBaseJavaModule` bridge). Its single capability is
  `CuelinksUtil.getAffiliatedUrl(url, sub1, sub2, ...)`: given a URL the app already has, it
  returns that same URL wrapped for Cuelinks attribution (up to 5 sub-ids). There is no iOS
  module, no web module and no method that lists, searches or returns product data — it is a
  link-in/link-out call, functionally identical to the server-side
  `https://linksredirect.com/?cid=...&url=...` wrap `CuelinksLinker` already performs in
  `services/api/app/affiliate.py`.
- **`cuelinksv2.js`**: a browser-only script for traditional websites. It walks
  `document.getElementsByTagName('a')`/`area` on the rendered page and attaches
  `mousedown`/`click` handlers that rewrite each anchor's `href` to
  `https://linksredirect.com?cid=...&url=<original href>&subid=...` at click time. It requires a
  DOM (`document`, `window.location`, `attachEvent`/`addEventListener`) that does not exist in a
  React Native/Expo runtime, and it only ever operates on `<a>` tags the page already renders — it
  cannot discover or emit new product URLs.
- **Conclusion**: both materials confirm Cuelinks' product here is *link conversion* (take a URL
  GYF already has, return a tracked/affiliated version of that same URL), not *product ingestion*
  (title, image, price, availability, retailer identity for products GYF does not already have a
  URL for). This does not add a fourth option to the blocker above: GYF's existing server-side
  `CuelinksLinker` already reproduces the SDK/snippet's behaviour for the platform GYF actually
  ships (Expo, not a browser website), so adopting either artifact adds no new capability. Product
  cards still require one of the three options above — feed/API/catalog credential, or
  Deeplink=Yes product URLs, or an approved retailer feed — before automatic product-level shop
  links can be proven end to end.

## Recommended automated path (seam implemented in follow-up)

Captain asked for automatic product updates and automatic Cuelinks link generation. Given the SDK
review above, the correct shape is a backend ingestion + wrap pipeline, not a client-side SDK. The
internal feed/campaign seam is now implemented and documented in
[`cuelinks-product-ingestion-2026-07-22.md`](./cuelinks-product-ingestion-2026-07-22.md):

1. **Product feed/API import**: a scheduled job pulls product rows (title, image, price, currency,
   availability, retailer identity, canonical product URL) from a Cuelinks product feed/API
   credential, or from an approved retailer feed for merchants where the Cuelinks campaign is
   `Deeplink=Yes`. This is the only step that can create new catalogue rows; nothing client-side
   can substitute for it.
2. **Scheduled refresh**: the same job re-runs on a schedule (for example the existing catalogue
   refresh cadence) so price/availability/deletions stay current, instead of a one-time import.
3. **Affiliate wrapping**: each imported product's canonical retailer URL is wrapped server-side by
   `CuelinksLinker` (`services/api/app/affiliate.py`), the same code path this slice hardened, using
   `GYF_CUELINKS_CID=274785`. This keeps affiliate wrapping centralized and testable rather than
   duplicated per client.
4. **Fallback for a merchant without feed/API access**: only accept a product-level, `Deeplink=Yes`
   merchant/product URL for that specific item; a `Deeplink=No` campaign (as shown in the Adidas
   campaign screenshot) can only wrap to that brand's home page and must not be presented as a
   product link.
5. **Client role**: for product cards, Expo (and the retained Next.js oracle) only ever call
   `safeExternalShopUrl` on a URL the backend already produced; they do not call the Cuelinks RN SDK
   or use it for product data, since that SDK cannot supply product data and would duplicate
   wrapping logic that already lives in `CuelinksLinker`. The Expo web build target does load the
   `cuelinksv2.js` browser snippet as a supplemental, non-product-ingestion earning-detection loader;
   see [`cuelinks-web-js-integration-2026-07-22.md`](./cuelinks-web-js-integration-2026-07-22.md).

Live execution of steps 1-2 still requires the Cuelinks product-feed/API credential (or an approved
retailer feed) that is outstanding; GYF does not claim that credential exists or that production
product ingestion is proven end to end.

## Focused validation attempted in this worktree

- `no-mistakes doctor` passed (git/gh/data/daemon/agent configuration OK).
- Safe network proof reran the two captain links and the representative generated catalogue link
  with no login, cart, checkout or purchase action; results matched the redirect chains above.
- Focused API proof: `pytest -q tests/test_affiliate.py` via a worktree-local `uv` shim passed
  `15 passed`, with one retained Starlette/httpx deprecation warning (includes a regression test
  guarding the double percent-decoding fix for embedded `linksredirect.com` targets).
- Full API proof: `pytest -q` passed `454 passed, 20 skipped, 8 warnings`.
- Focused frontend proof: `bun test apps/expo/src/lib/stylist-feed.test.ts app/lib/shop-links.test.ts`
  via a worktree-local Bun shim passed `12 pass`.
- Full JS proof: `bun run test` passed `185` Expo tests and `79` retained-web tests, with retained
  Vite/Rolldown and React `act(...)` warnings.
- `bun run format:check`, `bun run lint`, `bun run typecheck` and `bun run build` passed; lint kept
  the existing retained-web raw `<img>` warning.
- Doctrine checks passed: model licence, promotion, ports and doc alignment.
