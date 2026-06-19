# ml/

The GYF ML platform. Modules (built per `docs/implementation-plan.md`, grounded in
`docs/research/deep-research-report.md`):

- `perception/` — fashion embeddings (Marqo-FashionSigLIP), attributes, color (CIELAB/CAM16)
- `usermodel/` — body-type module (SMPL) and skin-tone module (separate, fairness-gated ⚠️)
- `recsys/` — two-tower, transformer ranker, generative (Semantic IDs / TIGER) later
- `compat/` — outfit compatibility & composition
- `tryon/` — diffusion virtual try-on (IDM-VTON → MuGa-VTON)
- `eval/` — offline + online evaluation harness (gates every model release)
- `pipelines/` — training/feature pipelines, registry hooks

Built in P1+. P0 establishes the data/event spine these consume.

## Setup

```bash
cd ml
uv sync --extra dev                            # library + tests (no model weights)
uv sync --extra perception --extra postgres    # full perception runtime
```

The library imports without `torch`/`open_clip`: the SigLIP encoder loads weights
lazily, and all logic is tested against an injected fake `Encoder` (see
`tests/test_perception.py`). Config is env-driven (`GYF_*`, shared with the API).

## P1-A — Perception (Cycle 1: A0–A2, shipped)

- `perception/model.py` — `Encoder` protocol + `SiglipEncoder` (Marqo-FashionSigLIP,
  shared 768-d image/text space; lazy weights).
- `perception/attributes.py` — zero-shot garment attributes via per-attribute text prompts,
  each with a **calibrated** confidence (cosine sims scaled by the encoder's learned
  `logit_scale`, not raw). Attributes are **category-gated**: category is predicted first
  (into the shared canonical vocabulary, `gyf_contracts.taxonomy`), its outfit slot then
  selects which others apply — so a sneaker is never asked for a neckline. Current set:
  `category, pattern, formality, material, aesthetic, season, target_audience` (all garments)
  plus `fit, silhouette, neckline, sleeve, length` (gated by slot). Add an attribute by adding
  one `AttributeSpec` to the registry; nothing else changes. A trained head can later replace
  any single attribute without changing this interface or the stored shape.
  Each label is embedded with an **ensemble** of caption templates (averaged, cached once) for
  a zero-shot accuracy lift, and every prediction reports **`certain`**: below the attribute's
  `min_confidence` floor (default 0.35) the argmax label is kept but flagged uncertain, so
  downstream never acts on a low-confidence guess. Stored shape: `{value, confidence, certain}`.
- `perception/color.py` — dominant garment color in CIELAB / LCh (CAM16 is the upgrade path).
- `perception/perceive.py` — combines embedding + attributes + color into one result.
- `perception/inspect.py` — manual check: run the real model on any image.
  `python -m perception.inspect <image> [--json]` (needs the `perception` extra; first run
  downloads the weights). See the repo root `README` for the `HF_HOME` cache note.
- `pipelines/backfill.py` — idempotent, resumable: embeds + attributes every item lacking
  the current `model_version`, writing `item_embeddings` + merging `items.attributes`.

```bash
python -m pipelines.backfill --limit 100   # process pending items
```

Catalog ingestion (feeds → `items`, region facet, dedupe) lives with its schema owner in
`services/api/app/catalog/` (`python -m app.catalog.ingest`). The **canonical garment
taxonomy** (categories, slots, region tags) is the shared contract
`packages/contracts/gyf_contracts/taxonomy.py`, imported by *both* the catalog (to normalize
feed text) and perception (to predict into the same vocabulary) — one source of truth, no
drift. Schema changes (vector(768), HNSW index, catalog provenance) are in
`services/api/db/migrations/0002_*`.

## P1-A — Retrieval & Eval (Cycle 2: A3–A4, shipped)

- **A3 retrieval** — pgvector cosine retrieval in `services/api/app/catalog/retrieval.py`
  (visually-similar + text->image, optional region filter). Endpoints: `GET /items/{id}/similar`
  and `GET /items/search?q=`. The text-query encoder is the SigLIP encoder, bridged via
  `app/catalog/perception_adapter.py` (in-process for beta; replace with a perception-service
  client at scale). Search returns an honest 503 when the perception runtime is not installed.
- **A4 eval** — `eval/metrics.py` (MRR, Recall@K) + `eval/retrieval_eval.py`
  (leave-one-out image->image evaluation over grouped open-dataset embeddings, writes a
  versioned JSON report). Offline signal for candidate selection only — promotion still
  requires online A/B + interleaving (plan §4).

**Workstream A DoD:** every item gets embeddings + attributes (A2 backfill); visually-similar
and text->image retrieval work (A3) and are eval'd with MRR/Recall (A4). ✅
