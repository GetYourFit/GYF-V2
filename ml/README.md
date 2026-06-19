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
- `perception/attributes.py` — zero-shot pattern/formality/fit via text prompts; each
  prediction carries a softmax confidence.
- `perception/color.py` — dominant garment color in CIELAB / LCh (CAM16 is the upgrade path).
- `perception/perceive.py` — combines embedding + attributes + color into one result.
- `pipelines/backfill.py` — idempotent, resumable: embeds + attributes every item lacking
  the current `model_version`, writing `item_embeddings` + merging `items.attributes`.

```bash
python -m pipelines.backfill --limit 100   # process pending items
```

Catalog ingestion (feeds → `items`, taxonomy, region facet, dedupe) lives with its schema
owner in `services/api/app/catalog/` (`python -m app.catalog.ingest`). Schema changes
(vector(768), HNSW index, catalog provenance) are in `services/api/db/migrations/0002_*`.

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
