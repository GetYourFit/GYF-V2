# Commerce attribution operating contract

**Scope:** the free Expo styling handoff. This is affiliate measurement, not payment,
entitlements, a product-feed cutover, or a ranking input.

## Canonical event semantics

| Stage | Owner | Truth rule |
| --- | --- | --- |
| Recommendation placement | FastAPI recommender `IMPRESSION` | Server records `recommendation_id`, item, rank and actual serving context. |
| Retailer handoff | Expo `shop_click` feedback | Sent only after `Linking.openURL` resolves. Context v1 contains random route-local `session_id`, placement, product target, `subid`, and recommendation/rank when present. It is intent, not cart or purchase. |
| Affiliate statement | `scripts/sync_conversions.py` | Only `approved`, `confirmed`, `paid`, `success`, or `successful` creates `purchase`. Pending/unknown status is unknown. |
| Reconciliation | `scripts/sync_conversions.py` | Later refund/cancel/reversal creates idempotent `conversion_reversal`; reports exclude its transaction from confirmed conversion and contribution. |

The server-owned deeplink subid is the recommendation ID for Stylist and
`catalog_<item_id>` elsewhere. A conversion gets an item target only if that subid
has exactly one distinct `shop_click` item. Multiple candidate clicks are recorded
at recommendation level; no item is guessed. Cuelinks Publisher APIs and SDKs are
link conversion/campaign tools, **not a product feed**. Price, currency, merchant,
availability and product URL remain unavailable unless the existing catalogue source
supplies them.

`event_id` and affiliate transaction id make retries idempotent. This context holds
no new personal fields: session ids are random, route-local and transient; all event
writes remain subject to existing behavioural-learning consent, retention and account
delete coverage.

## Measurement and guardrails

`python scripts/report_profitability.py` reports disclosed handoffs, confirmed and
reversed conversions, repeat use, and contribution margin. It never counts a click
as a purchase. Actual reported commission is shown separately; any estimated
commission and hosting allocation are explicitly placeholders until operator inputs
are verified. Gross sale value is not profit.

Before any experiment/rollout, record the cohort anchor, minimum sample and decision
owner in the existing experiment evidence. Primary metric: first-session explained
outfit save → disclosed retailer handoff. Counter-metrics: save/correction rate,
reversal rate, failed handoff rate, accessibility defects, behavioural-consent
coverage, p95 API/client impact, and monthly hosting/GPU spend. The hard budget stays
under ₹3,000/month; this slice adds no paid provider spend.

Keep the handoff disabled by withholding unsafe/missing product URLs (the existing
linker returns `null`). Roll back by reverting the Expo handoff and stopping the
statement job; preserve already-recorded append-only outcomes for consent/delete
handling. Do not promote a ranker, change product sources, or implement monetization
from these measurements.

## Verification

1. Run focused Expo attribution and accessibility tests plus API affiliate tests.
2. Run the profitability fixture tests and migration graph check.
3. On a disposable authenticated account, verify disclosure appears before the
   retailer action, missing price/link stays unavailable, Back returns to styling,
   and exactly one `shop_click` is persisted after a successful handoff.
4. Re-run `report_profitability.py` against a permitted database. If no database or
   statement credential is available, record the result as an environment-gated
   unknown—not zero revenue or zero reversals.

The partial `shop_click` subid index adds storage only for outbound-click rows and
bounds statement reconciliation reads. The Expo change adds no dependency or asset.
A clean isolated export measured the web entry bundle at 2,862,286 bytes versus
2,860,385 bytes on clean `origin/main` (**+1,901 bytes**); both exports passed the
Cuelinks-loader verifier. The existing 2,700,000-byte web budget fails on both
baselines, so this slice does not introduce that pre-existing budget breach.
