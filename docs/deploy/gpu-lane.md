# GPU lane — running perception / the M2 bake-off on a GPU

> **Doctrine:** D1 (capability port — app code never imports a model, it calls the port),
> D7 (free-tier GPU serving), D5 (eval-gated promotion). **Source:** `ml/perception/`,
> `spaces/gyf-gpu/`.

## Canonical owner and retained custody

The one canonical image/text contract is
`packages/contracts/gyf_contracts/encoder.py:ImageTextEncoder`; the one production
model identity is `RUNTIME_MODELS["encoder"]` plus `models.registry.json`. Local,
HTTP and Gradio adapters implement that port. The API reaches it only through
`services/api/app/catalog/perception_adapter.py`, and the durable query cache is keyed by
registry model ID.

`ml/serving/modal_encoder.py` is the sole production-capable Modal owner: it pins the
registry production model at deploy time, has required bearer auth, a health endpoint,
CPU/memory limits, a persistent weight volume and memory snapshot. `infra/modal/encoder.py`
is retained **custody only**, not a deploy target or rollback claim: it is an older
multi-model Modal implementation with a different allow-list, optional auth and no pinned
registry model/volume snapshot. It cannot be deleted or treated as a rollback until the
owner verifies external Modal custody and rehearses rollback; no production config references it.

The local foundation added in PR #57 is a correctness/shadow foundation, not a promotion:
it has no frozen text-retrieval corpus, India latency/RSS/CPU measurement, artifact SHA-256,
shadow/canary or rollback evidence. The present image-category bake-off and Apache-2.0 registry
metadata do not establish any of those missing gates.

| Owner/path | Actual role/caller | State and evidence owner |
| --- | --- | --- |
| `gyf_contracts.encoder.ImageTextEncoder` | shared image/text port; 768-d index contract | `packages/contracts/tests/test_encoder.py` |
| `models.registry.json` + `RUNTIME_MODELS` | one allowed production identity | registry/eval-policy tests; Apache-2.0 and the existing image-category report only |
| `ml/perception/model.py:SiglipEncoder` | local CPU/CUDA implementation; local and remote fallback | perception/model-load tests; artifact hash absent |
| `ml/perception/remote.py:HttpEncoder` | API search HTTP adapter | HTTP contract, timeout and redirect tests |
| `ml/perception/remote.py:RemoteEncoder` | ZeroGPU batch/lab adapter | remote shape, fallback and cache tests |
| `ml/serving/modal_encoder.py` | configured production-capable Modal deployment | API wire tests; real Modal warm/cold/RSS/CPU evidence absent |
| `infra/modal/encoder.py` | retained legacy Modal custody | no production config/test owner; external rollback custody unverified |
| `spaces/gyf-gpu/app.py` | public ZeroGPU inference lab | allow-list registry test; never production |
| `ml/pipelines/backfill.py`, `backfill_gender.py` | catalog writes/zero-shot prompt work | resumability/lane reporting tests; no production data mutation authorized |
| `query_cache.py` + `perception_adapter.py` | API-only model bridge and `(query, model_id)` cache | API cache invalidation and lexical-fallback tests |

The only completed maintenance reduction here is ownership, not deletion: the ML and API
settings defaults now derive from `RUNTIME_MODELS["encoder"]` instead of carrying two extra
model-URI literals. No implementation, dependency, provider or custody file was removed; that
would be an unsupported reduction claim until the retained lane has rollback proof.

`perception.default_encoder()` (and the bake-off) pick an implementation from one env var:

| `GYF_ENCODER_REMOTE_URL` | `GYF_ENCODER_REMOTE_KIND` | Backend | When |
| --- | --- | --- | --- |
| **unset** (default) | — | `SiglipEncoder` — local CPU or local CUDA | laptop dev, CI |
| ignored, may be stale | `local_cpu` | `SiglipEncoder(..., device="cpu")` | explicit always-on SigLIP2 CPU baseline on Render-compatible compute |
| a Gradio URL | `gradio` (default) | `RemoteEncoder` — HF ZeroGPU Space | the **image**-embed batch lane (catalog backfill) |
| a JSON URL | `http` | `HttpEncoder` — plain JSON POST | the **search** lane: canonical Modal CPU owner, scale-to-zero (F2.5) |

That's the whole design: the local encoder is the always-present baseline (invariant #5);
the remote ones are optional swaps, never a requirement.

---

## ▶ Search lane (F2.5) - Modal CPU, scale-to-zero

Why it exists: `/items/search` embeds the user's text. On the ZeroGPU Space that cost
**29.7 s** cold from India (`docs/plans/scale-3k-inr.md` §1) — product-killing. The SigLIP
**text tower needs no GPU**, so it runs on a CPU container that scales to zero, cold-starts
in seconds (weights in a Modal Volume + memory snapshot), and stays inside Modal's $30/month
free credits. In front of it sits the Postgres query-embedding cache
(`services/api/app/catalog/query_cache.py`), so a repeated query never re-embeds at all.

```bash
pip install modal && modal setup
modal secret create gyf-encoder-key GYF_ENCODER_API_KEY=$(openssl rand -hex 32)
modal deploy ml/serving/modal_encoder.py     # prints https://<workspace>--gyf-encoder-web.modal.run
```

Then, on the API (Render dashboard — these are the only three vars):

```
GYF_ENCODER_REMOTE_URL=https://<workspace>--gyf-encoder-web.modal.run
GYF_ENCODER_REMOTE_KIND=http
GYF_ENCODER_REMOTE_KEY=<the same key>
```

The lane serves exactly one model — the promoted production encoder baked in at deploy time
— and refuses any other `model_id`, so no research checkpoint can reach it by config drift.
Verify with `python3 scripts/measure_slo.py` from an Indian connection: `search_uncached`
must land under 3 s p95, `search_cached` under 0.9 s.

## ▶ Local CPU foundation (POC only) - explicit Render-compatible baseline

This lane is opt-in and reversible. It does not promote a model, change
`models.registry.json`, reindex production, or require a live remote service. Set only:

```
GYF_ENCODER_REMOTE_KIND=local_cpu
```

`encoder_for()` then ignores any stale `GYF_ENCODER_REMOTE_URL` and instantiates the incumbent
shared `google-siglip2-base-v1` text/image encoder on CPU. Use it only for the bounded local
foundation work documented in [`docs/plans/scale-3k-inr.md`](../plans/scale-3k-inr.md). Before any
future runtime export or deployment promotion, run the repeatable bounded text benchmark (no
catalogue writes):

```bash
GYF_PERCEPTION_DEVICE=cpu OMP_NUM_THREADS=2 MKL_NUM_THREADS=2 \
  uv run --project ml --extra perception python -m eval.benchmark_encoder \
  --device cpu --repeats 3 --timeout-seconds 300 \
  --output docs/evidence/results/local-cpu-siglip2-YYYY-MM-DD.json
```

Then pass the frozen parity/truth/latency/RSS harness in `ml/eval/encoder_foundation.py`,
followed by the shadow, canary, India-SLO, reindex, and rollback gates from that plan. The
benchmark is local evidence only; a failed load/deadline is not semantic success, and the API
keeps its lexical fallback.

---

## ▶ Free path (recommended) — dockerized bake-off

No subscription, no remote URL. `make m2-bakeoff` runs the whole bake-off in a container
(weights cached in the `gyf-hf-cache` named volume) with the **local** encoder — on a CUDA
host it uses the GPU, on a laptop it falls back to CPU. It regenerates the catalog from a
public dataset, prints the leaderboard, and writes the `EvalReport`s to
`eval-reports/bakeoffs/` as the M2 evidence. `make m2-clean` reclaims the image + weights.

For a hosted GPU instead, deploy the HF ZeroGPU Space (below) and point
`GYF_ENCODER_REMOTE_URL` at it.

---

## ▶ Local path — your own machine

```bash
make m2-bakeoff          # dockerized, weights cached in the gyf-hf-cache volume
# or directly:
uv run --project ml python -m eval.bake_off
```

CPU works (slow); a local NVIDIA/Intel GPU is auto-selected.

---

## ▶ Encoder inference lab (optional) — `spaces/gyf-gpu`

A public Gradio lab for commercial-clean encoder inference and bake-offs. It is **not a
production serving path** and exposes no photo/user-model endpoints. Deploy it on whatever
GPU host you like:

- **HF ZeroGPU** — needs **HF Pro** (~$9/mo) to attach ZeroGPU hardware to your own Space.
- **RunPod / Modal Gradio** — cheap pay-per-use; same `app.py` works.

Deploy `spaces/gyf-gpu/` (Gradio: `app.py` + `requirements.txt`), then point the stack at it:

```bash
HF_TOKEN=hf_... HF_USER=<your-hf-username> bash scripts/deploy_gpu_space.sh
```

`HF_TOKEN` needs write access for this deployment; do not put it in source control. The script
atomically mirrors the canonical folder, deleting remote-only retired code while preserving the
Hub-managed `.gitattributes` file.

```bash
GYF_ENCODER_REMOTE_URL=https://<your-endpoint>   # e.g. https://<user>-gyf-gpu.hf.space
GYF_HF_TOKEN=hf_...                              # only if the endpoint is private
```

Now `default_encoder()` and the bake-off can embed through that GPU with **zero code changes**;
unset the var to fall back to local. The Space's `ALLOWED_MODELS` must stay in sync with
commercial-clean `encoder` entries in `models.registry.json`; CI enforces that boundary.

The text endpoint declares `duration=30`: ZeroGPU checks and reserves the declared ceiling before
running a request, and shorter realistic durations receive better queue priority. Validate a new
revision with 20 fixed queries, one cold plus three warm rounds: zero errors, 768-dimensional
vectors, remote p50/p95 ≤0.75s/1.5s, and API semantic-search p50/p95 ≤2s/3s. If any quality,
shape, availability, or latency gate regresses, restore the previous Space revision and restart the
API so its process-wide client reconnects.

### Smoke test
```python
from gradio_client import Client
c = Client("https://<your-endpoint>")
print(c.predict("hf-hub:Marqo/marqo-fashionSigLIP", ["a red dress"], api_name="/embed_texts")["dim"])  # 768
```

---

## Promotion (any path)

A bake-off never auto-promotes. If a candidate beats the incumbent (`is_improvement` true),
flip its registry lane to `production`, point its `eval_report` at the committed report, and
re-run `scripts/check_promotion.py` (M1 gate). See PROGRESS.md (M2 embedding upgrade).
```
