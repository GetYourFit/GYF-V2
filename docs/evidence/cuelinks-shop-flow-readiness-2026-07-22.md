# Cuelinks shop-flow readiness evidence — 2026-07-22

This is implementation/evidence for the Cuelinks shop-flow readiness task. It does **not**
promote a launch gate.

## What is implemented

- Catalogue/recommendation shop URLs are wrapped server-side through `CuelinksLinker` when
  `GYF_CUELINKS_CID=274785` is configured.
- Recommendation shop links use `subid=<recommendation_id>`; catalogue browse/search uses
  `subid=catalog`.
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
- GYF buy URL:
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
