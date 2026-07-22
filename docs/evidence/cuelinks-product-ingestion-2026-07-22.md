# Cuelinks product ingestion evidence — 2026-07-22

This records the automatic-ingestion implementation seam for Cuelinks. It does **not** prove live
Cuelinks product-feed access and does **not** promote F4, P5.4, HL-EXPLORE or HL-BUSINESS.

## What changed

- `services/api/app/catalog/cuelinks.py` now models Cuelinks campaign capability rows with explicit
  `Deeplink=Yes/No`, country, vertical, status, merchant, campaign ID, domain and home URL.
- `CuelinksProductFeedSource` imports product-feed rows only for active Indian fashion campaigns
  where `Deeplink=Yes`. Required row facts are title, category, image URL, price/currency,
  availability, merchant/campaign and original product URL.
- `Deeplink=No` or non-fashion campaigns are retained as campaign facts but skipped as product rows;
  they can never become fake product catalogue data or a product-level shop CTA.
- Imported products store Cuelinks provenance in item attributes under `commerce`:
  merchant, domain, affiliate network, campaign ID, `deeplink_enabled` and original product URL.
- Cuelinks wrapping remains server-side through `CuelinksLinker`; recommendation links keep
  `subid=<recommendation_id>`, while catalogue/saved/explore links now use structured
  `subid=catalog_<item_id>` so statements can be reconciled by product later.
- Expo Explore product cards pass backend `buy_url` into the card and render a compact affiliate
  disclosure only when `safeExternalShopUrl` accepts the URL. Unsafe/home/shortlink URLs render no
  disclosure and no shop affordance.

## Blocker for real live ingestion

Live Cuelinks product ingestion is blocked until GYF receives/configures a real Cuelinks product
feed/API export and campaign capability export:

```text
GYF_CUELINKS_PRODUCTS_FEED_PATH=<product feed export with title/image/price/availability/merchant/product URL>
GYF_CUELINKS_CAMPAIGNS_PATH=<campaign export with Deeplink Yes/No>
GYF_CUELINKS_CID=274785
```

The JS/RN SDK and browser snippet remain link-conversion-only evidence; they cannot supply product
rows. A Cuelinks conversion/report token alone is also insufficient for catalogue ingestion.

## Fixture proof

Focused tests cover the screenshot examples without hard-coding Columbia:

- Adidas India fixture: `Deeplink=No` → product rows skipped, including product-looking URLs and
  brand-home URLs.
- Columbia Sportswear India fixture: `Deeplink=Yes` → product row imported with original product URL
  and Cuelinks provenance.
- A second generic Indian fashion merchant with `Deeplink=Yes` imports successfully, proving the
  path supports all eligible campaign rows supplied by the export rather than a Columbia special
  case.
- A non-fashion Indian merchant with `Deeplink=Yes` is skipped because this importer is scoped to
  Indian fashion retail.

## Validation performed locally

Focused commands run in this disposable worktree:

```bash
cd services/api && uv run pytest -q tests/test_cuelinks_ingestion.py tests/test_affiliate.py tests/test_catalog_feeds.py tests/test_retrieval.py::test_postgres_repo_hydrates_and_attributes_results_in_one_query
bun test apps/expo/src/lib/stylist-feed.test.ts app/lib/shop-links.test.ts apps/expo/src/design-fixtures/interaction-boundaries.test.ts
```

Both passed after formatting. Broader validation is recorded in the commit/no-mistakes handoff; no
live Cuelinks feed/API credential was available, so no production ingestion or earnings statement
reconciliation is claimed.
