# Recommendation integrated proof — 2026-07-22

Status: **EVIDENCE ONLY — subordinate to** [`active-execution-contract.md`](./active-execution-contract.md). This note records one local inspection/test packet for the recommendation loop. It does not promote F2.5, F3, F5, F6, Expo cutover, beta or hard launch.

## Flow inspected

- **Expo:** `apps/expo/src/app/(app)/(tabs)/index.tsx`, `apps/expo/src/lib/stylist-feed.ts`, `apps/expo/src/lib/activation-loop.test.ts`, and the shared `GyfApi` transport in `app/lib/api.ts`.
- **API:** `services/api/app/routers/recommendations.py`, `services/api/app/routers/feedback.py`, `services/api/app/dependencies.py`, request IDs in `services/api/app/observability.py`, and consent gating in `services/api/app/profile/account.py` / `gyf_contracts.consent`.
- **Recommendation/ML:** `services/api/app/recsys/{conditioning,candidates,compose,service,taste,signals}.py`, catalogue retrieval through `CandidateRepository`, and the event export in `ml/pipelines/export_events.py`.
- **Existing evidence:** active-contract `F2.5-04 GO` production timing evidence, launch-plan F3/F5/F6 gates, `docs/plans/ml-data-flywheel.md`, and retained Expo activation-loop tests.

## Local reproduction and proof added

Focused tests now cover the closest local loop available without production credentials:

1. authenticated profile/onboarding state -> `GET /outfits/recommend` -> complete explained outfits, `recommendation_id`, `X-Request-ID`, and impression events;
2. `POST /feedback` save on a served item with the echoed `recommendation_id`;
3. subsequent recommendation using the joined taste signal to alter the next slate;
4. `GET /outfits/alternates` serving a correction candidate, logging the alternate as an impression, and keeping only same-slot alternates;
5. export/training examples excluding stale or forged `recommendation_id` outcomes instead of treating them as organic positives;
6. online taste SQL requiring recommendation-scoped outcomes to join a prior served impression and using safe UUID casting so malformed target IDs cannot break the taste read.

## Fixes in this packet

- Alternate/correction candidates are now logged as served item impressions with `surface=alternates`, `replaced_item_id`, rank, optional score and the original `recommendation_id` when present.
- The alternates endpoint drops hydrated results whose slot does not match the replaced garment, so a noisy retrieval result cannot turn a top swap into footwear.
- The ML export no longer turns unmatched recommendation-scoped outcomes into organic training positives.
- The online taste repository now learns from recommendation-scoped outcomes only when a prior matching impression exists for the same user, target and `recommendation_id`; organic no-context actions still remain usable.

No dependency, model, GPU provider, cache, vector store, affiliate/shop-link, payment or infrastructure change was made.

## Validation

- `services/api/.venv/bin/pytest -q services/api/tests/test_recsys.py services/api/tests/test_learning_consent.py` -> **93 passed, 2 skipped**, one retained Starlette/httpx warning.
- `ml/.venv/bin/pytest -q ml/tests/test_export_events.py` -> **15 passed**.
- `services/api/.venv/bin/pytest -q services/api/tests` -> **452 passed, 20 skipped**, eight retained warnings.
- `ml/.venv/bin/pytest -q ml/tests` -> **103 passed**.
- Touched-file Ruff checks and format checks passed for API/ML Python files; full `ruff check` passed for both API and ML.
- `node_modules/.bin/prettier --check "**/*.{ts,tsx,js,jsx,json,md}"` passed.
- `make doctrine` passed model license, promotion, port and doc-alignment gates.

Environment-gated or pre-existing failures in this disposable lane:

- `uv` and `bun` were not on PATH; Python checks used the existing checked-in Python 3.12 virtual environments, and `make fmt-check` failed at `bun: command not found`.
- Direct `tsc --noEmit` passed for `app` and `packages/types`; Expo direct `tsc --noEmit` failed on pre-existing URL type incompatibilities in `src/design-fixtures/motion-grammar.test.ts` and `src/design-fixtures/route-exports.test.ts`.
- Full ML `ruff format --check ml` still reports untouched `ml/tests/test_remote_encoder.py` would be reformatted; touched ML files are formatted.

Full no-mistakes/PR/CI remains a separate validation step; this packet does not claim it.

## Holds / blocked launch evidence

- No production Supabase/Render credentials or India-vantage browser/device run were available in this lane, so no new production SLO, EXPLAIN, ≥99% join-integrity, physical Android, closed-beta or cohort quality claim is made.
- F6 learned-ranker promotion remains blocked until sufficient clean, consented, joined behavioural data exists and passes the frozen offline -> shadow -> cohort gates.
- Try-on remains closed until F9; this recommendation proof does not open or exercise a renderer lane.
