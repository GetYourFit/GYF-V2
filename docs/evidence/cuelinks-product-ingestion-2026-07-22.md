# Cuelinks product ingestion evidence — 2026-07-22

This records the automatic-ingestion implementation seam for Cuelinks. It does **not** prove live
Cuelinks product-feed access and does **not** promote F4, P5.4, HL-EXPLORE or HL-BUSINESS.

## What changed

- `services/api/app/catalog/cuelinks.py` now models Cuelinks campaign capability rows with explicit
  `Deeplink=Yes/No`, country, vertical, status, merchant, campaign ID, domain and home URL.
- `services/api/app/catalog/cuelinks_api.py` adds a backend-only Cuelinks Publisher API client for
  the current developer-doc V3 endpoints `GET /pub_api/v3/ping`, `GET /pub_api/v3/campaigns` and
  `POST /pub_api/v3/links/convert`, using `Authorization: Token <redacted-api-key>` as documented at
  `https://developers.cuelinks.com/#api`. It also records the legacy Apiary v2 shapes from
  `https://cuelinks.docs.apiary.io/#reference/authentication`, where auth is
  `Authorization: Token token=<redacted-api-key>` and endpoints include `/v2/campaigns.json`,
  `/v2/links.json`, `/v2/offers.json` and `/v2/transactions.json`. The implemented client targets
  V3, validates the HTTPS API base URL, rejects unsafe or homepage-only product URLs before
  conversion, sanitizes `subid`, and never logs or returns the token.
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
- Expo Saved product cards pass backend `buy_url` into the card and render a compact affiliate
  disclosure only when `safeExternalShopUrl` accepts the URL. Unsafe/home/shortlink URLs render no
  disclosure and no shop affordance. Explore already discloses affiliate links through its own
  item detail sheet CTA, which predates this branch.

## Blocker for real live ingestion

Live Cuelinks product ingestion is blocked until GYF receives/configures a real product-row source.
The captain-provided Publisher API endpoints help with campaign discovery and link conversion:

```text
GYF_CUELINKS_CID=<redacted Cuelinks channel id>
GYF_CUELINKS_API_KEY=<redacted Cuelinks Publisher API token>
GYF_CUELINKS_API_BASE_URL=https://developers.cuelinks.com/pub_api/v3
# Optional local exports when Cuelinks/retailers provide product rows:
GYF_CUELINKS_PRODUCTS_FEED_PATH=<product feed export with title/image/price/availability/merchant/product URL>
GYF_CUELINKS_CAMPAIGNS_PATH=<campaign export with Deeplink Yes/No>
```

Operators configure `GYF_CUELINKS_API_KEY` only in the backend runtime secret store (for example
Render API env); never in `EXPO_PUBLIC_*`, `NEXT_PUBLIC_*`, checked-in env files or support/debug
logs. Live verification may check that the variable is present and that mocked/client construction
uses `Authorization: Token ...`, but must not print the value.

Captain-confirmed Publisher API permissions are `read:campaigns`, `read:reports`,
`read:transactions`, `read:offers` and `write:links`. Cross-checking the developer and Apiary docs:
V3 documents `GET /pub_api/v3/campaigns`, `POST /pub_api/v3/links/convert`,
`GET /pub_api/v3/transactions`, `GET /pub_api/v3/reports/performance` and
`GET /pub_api/v3/reports/campaigns`; Apiary v2 documents `GET /v2/offers.json`,
`GET /v2/transactions.json`, `GET /v2/campaigns.json` and `GET /v2/links.json`. This PR implements
only the planned API-support surface: `read:campaigns` for campaign discovery and `write:links` for
conversion. `read:reports` and `read:transactions` belong to future affiliate reconciliation;
`read:offers` is the follow-up candidate to inspect for product-card rows before making Cuelinks the
sole product source.

Campaign endpoints discover merchant/campaign metadata and link-conversion endpoints wrap a URL
GYF already knows; neither endpoint by itself returns product title, image, price, currency,
availability and canonical product URL rows. Apiary's v2 `offers` sample returns offer/coupon fields
such as campaign, title, description, URL and affiliate URL, not a full product-card catalogue row;
transaction/report endpoints are post-click reconciliation data and are not catalogue sources. Real
product cards still require one of: a Cuelinks product-feed/product API endpoint that returns those
row facts, an approved retailer feed/API for each campaign merchant, or manually supplied product
URLs plus separate title/image/price/availability truth. If Cuelinks has no product-feed endpoint
for this publisher account, the exact remaining blocker is access to a rights-cleared product
feed/API for Indian fashion merchants whose campaign rows permit product-level deeplinking. The
JS/RN SDK and browser snippet remain link-conversion-only evidence; they cannot supply product rows.

## Sole product-source decision

Captain's rule is correct: if Cuelinks provides a complete product source, GYF should make it the
only product source and remove/disable other product-fetching paths in that follow-up slice. This PR
does **not** do that because the provided and implemented Publisher API surface is campaign
discovery plus known-URL conversion only. Mocked regressions freeze that distinction with
`publisher_payload_has_product_rows(...)`: campaign payloads and conversion payloads return false;
a future product/feed payload returns true only when it includes title, image, price, availability
and product URL fields.

Therefore existing retailer/feed sources must not be removed in this PR. The exact follow-up, once
Cuelinks provides a product feed/API with those fields plus campaign `Deeplink=Yes`, belongs in the
master plan's catalogue/product-source slice rather than this API-support PR:

1. add the Cuelinks product endpoint/transport behind `CuelinksProductFeedSource` or its successor;
2. configure catalogue ingestion to accept only Cuelinks-backed rows for production catalogue
   refresh;
3. disable/delete non-Cuelinks product fetchers in the same slice after rollback evidence; and
4. add tests that no production refresh path instantiates Shopify, generic delimited affiliate, or
   other non-Cuelinks product fetch sources.

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

## Validation target

Focused commands for this seam:

```bash
cd services/api
uv run pytest -q tests/test_cuelinks_publisher_api.py tests/test_cuelinks_ingestion.py \
  tests/test_affiliate.py tests/test_catalog_feeds.py \
  tests/test_retrieval.py::test_postgres_repo_hydrates_and_attributes_results_in_one_query
bun test apps/expo/src/lib/stylist-feed.test.ts app/lib/shop-links.test.ts \
  apps/expo/src/design-fixtures/interaction-boundaries.test.ts
```

Broader validation belongs in the commit/no-mistakes handoff. No production ingestion, live Cuelinks
campaign sync, live link conversion or earnings-statement reconciliation is claimed from this mocked
client work.
