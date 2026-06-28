# GYF Elevation Program — real data · premium surface · clean codebase

> **Status:** active (created 2026-06-29). The **elevation track** of the launch push —
> complements `gyf-v2-launch-program.md` (the surface-first method/order) and
> `accuracy-precision-trust.md` (model accuracy/trust). Vision/law/tech precedence unchanged:
> `ideas-complete.md` → `engineering-doctrine.md` → `tech-stack.md` → `roadmap.md`.
> **DRY:** model-per-pillar + eval gates live in their source docs; this file owns the
> **data-sourcing, product-surface art-direction, and codebase-structure** workstreams.

## Why this exists

A grounded audit (three parallel Explore agents over the real repo, 2026-06-29) found the bones
stronger than they feel — the gaps are **specific and fixable, not a rewrite**:

- **Data:** ingestion is already a clean `FeedSource` port (`services/api/app/catalog/sources.py`);
  the `items` table already carries `price/currency/affiliate_url/region_tags/source_*`; search/recs/
  explore already expose `buy_url`. Missing: a **real affiliate-network connector + owned images +
  a live feed**. → a connector job.
- **Surface:** components are well-built (loading/empty/error states, a11y, motion all present) but
  there is **no real design-token system** (every value is an arbitrary `bg-[var(--x)]`/`text-[10px]`),
  page containers/headers are inconsistent, no page-level motion, no toast system. It reads as
  "components bolted together," not art-directed. → a design-system + art-direction pass on the base.
- **Codebase:** mostly sound (contracts are the single source of truth, Protocol ports, no circular
  deps, no tracked caches). Real offenders: **`services/api/app/main.py` is a 959-line god-file**
  (8 route groups + 23 lazy DI getters) and **ML duplication** (`_select_device`, three `remote.py`
  gradio clients). → targeted, behavior-preserving refactor.

## 0. Standing directive + per-workstream reviewers (binding)

Operate as a **principal engineer. Session cost is never a constraint on doing it right.** Use
subagents and loop engineering as aggressively as possible; every workstream is a bounded loop
`rubric → generate → evaluate (auto + visual + adversarial) → specialist review → GATE →
promote|iterate`. A gate failure stops promotion, never the loop. Clean structure + best
programming principles are a hard gate — no college-project work ships.

Reviewer/harness map: `ecc:react-reviewer`+`ecc:typescript-reviewer` (TSX) ·
`ecc:fastapi-reviewer`+`ecc:python-reviewer` (API) · `ecc:mle-reviewer` (ML/data) ·
`ecc:database-reviewer` (SQL/migrations) · `ecc:security-reviewer` (every input/auth/endpoint) ·
`ecc:a11y-architect`+`ecc:frontend-design-direction` (surface) · `ecc:code-architect`/`ecc:architect`
(refactor) · `ecc:silent-failure-hunter`+`ecc:code-reviewer` (every diff). Harnesses:
`ecc:gan-design` (UI) · `ecc:gan-build` (logic) · `verify` (E2E run-and-observe) ·
`ecc:refactor-clean` (dead code) · `ecc:orch-refine-code` (behavior-preserving refactor) ·
`ecc:continuous-learning` (calibration) · `ecc:loop-start`.

## W-DATA — Real, buyable catalog (affiliate networks)

Decision (locked): ingest from **affiliate networks** (Rakuten/Awin/Impact/CJ, Amazon PA-API).
Reuse the existing port; do not rebuild. Build: (1) fill `AffiliateFeedSource` with a per-network
HTTP/SFTP connector → `RawFeedItem` via `column_map`, credentials in `config.py` (never committed);
(2) **image ownership** — download product/on-model images to Supabase Storage `catalog/`, store
owned URL in `items.image_refs`, affiliate URL as fallback, `image_hash` dedup; (3) taxonomy
coverage (`gyf_contracts/taxonomy.py`, incl. India saree/kurta) + region tagging; (4) availability
re-sync cron; (5) **ingestion quality-report gate** (`mle-reviewer`): % items with working buy-link,
real price, loadable owned image, valid embedding, non-academic license — below threshold blocks the
feed's prod promotion, not the loop. Then backfill embeddings (`ml/pipelines/backfill.py`, GPU lane).
**Status: blocked on signing up for ≥1 affiliate network.**

## W-SURFACE — Million-dollar product look (full art-direction)

Decision (locked): full art-directed redesign via `ecc:gan-design`, on the solid base. Foundation
first: (1) **real design system** — extend `app/tailwind.config.ts` (`theme.extend`) + `globals.css`
tokens (color/spacing/radius/shadow/type), kill ~100 arbitrary values; finalize Editorial-Gallery
art direction (serif display + clean sans, whitespace, large imagery, restrained palette, lux
motion) as a one-page spec the loop scores against; (2) **layout primitives** — `<PageContainer>`,
standardized headers/altitude, sticky+blur headers, page-entrance motion; (3) **primitive polish**
— one card-hover language, `FilterBar`→styled `Select`, all buttons via `Button`, drop the
`--danger` hack (use `--error`); (4) **premium affordances** — toast system (Sonner), richer
skeletons, empty-state art, micro-interactions, image treatment. Then per-screen loops (Stylist →
Explore → Onboarding → Social → Profile → Saved/Wardrobe → Auth), each gated on a rubric
(craft · hierarchy · motion · WCAG 2.2 · responsiveness · brand cohesion · LCP/CLS).

## W-STRUCTURE — Clean, debuggable codebase (targeted refactor, behavior-preserving)

(1) **Split** `services/api/app/main.py` → `app/routers/{system,catalog,profile,recommendations,
feedback,collections,wardrobe,social}.py` + `app/container.py` `ServiceContainer` centralizing the
23 lazy repo getters; `main.py` = app wiring only. (2) **De-dup ML** — `_select_device` →
`ml/common/device.py`; three `remote.py` gradio clients → `ml/common/remote_client.py`
`RemoteInferenceClient`; shared `RemoteEstimator` base for body/skintone. (3) **Document** the
dense-but-OK modules (`recsys/compose.py`, `goals.py`, `social.py`) with section headers; split only
on a true SRP break. (4) **Enforce** — `ecc:refactor-clean` (knip/ts-prune/depcheck + ruff/vulture),
module-boundary lint, structured logging + consistent error envelopes across routers,
`ecc:silent-failure-hunter` over every diff; `make ci` stays the green commit gate. Method:
`ecc:orch-refine-code` (green → restructure → green → review → gated commit). No behavior change.

## Sequencing (parallel, gated loops)

- **Now:** W-STRUCTURE 1–2 (god-file split + ML dedup, low-risk) ∥ W-SURFACE foundation (tokens +
  layout primitives) ∥ W-DATA connector once a network is signed up.
- **Next:** W-SURFACE per-screen loops ∥ W-DATA image ownership + backfill + prod ingest ∥
  W-STRUCTURE enforcement.
- **Continuous:** accuracy/trust loops L1–L6 consume the new real catalog + real behavioral events.

**Per-workstream DoD (all hold):** `make ci` green · specialist reviewers pass · `verify` E2E green ·
W-DATA passing ingestion quality report · W-SURFACE passing design rubric + Lighthouse per screen ·
no doctrine invariant traded.
