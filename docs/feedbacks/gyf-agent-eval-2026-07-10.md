# GYF Live Audit — Agent Evaluation, 2026-07-10

> Method: registered a real account on prod (`gyf-v2-app.vercel.app` / `gyf-api.onrender.com`),
> onboarded as a man (casual, warm undertone, rectangle, ₹3,000 budget), and drove the real
> API the way the app does. Every finding below has live evidence, not a doc read.

## Findings (severity-ranked, with evidence)

| # | Sev | Finding | Evidence |
|---|-----|---------|----------|
| 1 | 🔴 | **Feed loads in ~33s** | `/outfits/recommend` → 33.4s (Render free-tier spin-down + heavy compose path) |
| 2 | 🔴 | **All 5 "outfits" reuse the same shirt** | every outfit `top = item_id 60631fe1`; only bottom/shoe vary. Violates "diverse, never near-identical" |
| 3 | 🔴 | **Explore search 500s** | `/items/search?q=shirt` → HTTP 500 `internal_error`. Core discovery broken in prod |
| 4 | 🟡 | **Every explanation is one mad-lib** | all 5 verbatim: "…balanced tones, styled for easy everyday wear. These tones sit in the warm-undertone palette… Cut for your straight-lined frame… within your ₹3,000 budget." Only nouns swap |
| 5 | 🟡 | **Boys' (kids) t-shirt shown to a men's profile** | `"…Graphic Back Printed Boys T-shirt"`. Dirty gender/category data passed the filter |
| 6 | 🟡 | **Confidence = 0.0 on every outfit** | new user sees zero confidence everywhere; `taste_strength: 0.0`, identical `score 0.588` ×5. The trust signal reads "not confident" |
| 7 | 🟡 | **skin_tone silently dropped, but 100% confident** | sent `skin_tone:"medium"` → stored `"unknown"` with `field_confidence.skin_tone: 1.0`. Contradiction = bug |
| 8 | 🟢 | Catalog is large + priced | facets: 41,409 items, all priced, ₹50–54,000. So thin recs are NOT a data-volume problem |
| 9 | 🟢 | Signup auto-confirms | any email registers instantly, no verification. Convenient, but zero email ownership check |

**Working:** `/me`, `/profile`, onboarding PUT, `/social/posts` (200, 2.3s), `/collections/outfits` (200, 1.1s).

## Root causes (the honest through-line)

- **#2 (same shirt):** `recsys/compose.py:_mmr_select` runs MMR (λ=0.3) but `_diversity()` scores *whole-outfit* difference — a shared top still reads "diverse" because bottoms/shoes differ. **The anchor/top slot is never forced to vary.** Fix: penalise per-slot repetition (especially the top) in the diversity metric, or dedupe the top across the selected set.
- **#4 (template reason):** the explanation builder is a fixed sentence skeleton with garment nouns slotted in — no per-outfit variation from the actual colour/formality/fit numbers it already computes.
- **#1 (33s):** Render free tier spins down after 15 min idle → cold boot on first hit; compounded by the compose path cost. Not a code bug alone — a hosting + latency issue.
- **#3 (search 500):** real server error on `/items/search` — needs the traceback (request_id `c264552fb2464f14ae2bbeb9c522b286`).
- **#6/#7:** cold-start confidence is honestly 0 (no taste yet) — defensible — but paired with #7's dropped-but-confident skin_tone, the intake is quietly losing signal.

## Fix plan (prioritised — worst-felt first)

1. **Explore search 500** — pull the traceback, fix the crash. A core surface returning errors is launch-blocking. *(backend, ~small once traced)*
2. **Outfit diversity** — force top-slot variety in `_mmr_select`/`_diversity`. Turns "1 shirt ×5" into 5 real looks. Highest product-perception win. *(recsys, bounded)*
3. **Feed latency** — hosting fix (see below) + profile the 33s compose path.
4. **Per-outfit explanations** — vary the reason from the real per-outfit signals (colour_harmony, formality_fit, the actual garments) instead of one template.
5. **Gender/category data** — exclude kids' items for adult profiles; tighten the gender filter.
6. **skin_tone intake bug** — accept the manual value (or reject with a real 422), never store "unknown" at confidence 1.0.

Each ships as its own verified commit; re-audited against the same live test account.

## Hosting — "move off Render" analysis (honest)

The 33s is Render's **free-tier spin-down**, not Render being bad. Options, ranked for GYF (Python FastAPI + Postgres/pgvector):

| Option | Free? | Cold start | Fit for FastAPI | Effort |
|---|---|---|---|---|
| **Keep-alive ping** (cron hits `/health` every 10 min) | ✅ free | kills spin-down | no move | **1 line** ✅ |
| **Vercel Fluid Compute** (Python) | ✅ free tier | low | native FastAPI, consolidates with the web already on Vercel | medium (restructure) |
| **Google Cloud Run** | ✅ free tier | low–med | good (container) | medium |
| **Firebase** | ✅ | — | ❌ **does not host FastAPI**; only static + JS Cloud Functions. Would mean rewriting the API | high, wrong tool |

**Recommendation:** Firebase is the wrong tool — it can't host the Python API without a rewrite. The lazy correct fix for the 33s is a **free keep-alive cron ping** (one line, kills the spin-down today). If we want a real platform move for lower steady latency, **Vercel Fluid Compute** consolidates with the web that's already there. A blind port to any of these mid-flight risks breaking a live app — do it deliberately, behind the plan, not in a rush.

## Open decisions (need your call)
1. **Hosting:** keep-alive ping now (free, instant) vs plan a Vercel Fluid Compute move vs Cloud Run?
2. **Fix order:** confirm search-500 → diversity → latency, or reprioritise?
