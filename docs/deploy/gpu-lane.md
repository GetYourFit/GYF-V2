# GPU lane — running perception / the M2 bake-off on a GPU

> **Doctrine:** D1 (capability port — app code never imports a model, it calls the port),
> D7 (free-tier GPU serving), D5 (eval-gated promotion). **Source:** `ml/perception/`,
> `spaces/gyf-gpu/`.

## One model, two backends

GPU work goes through a single port — `perception.model.Encoder` — so nothing in the app
changes regardless of where the GPU is. `perception.default_encoder()` (and the bake-off)
pick the backend from one env var:

| `GYF_ENCODER_REMOTE_URL` | `GYF_ENCODER_REMOTE_KIND` | Backend | When |
| --- | --- | --- | --- |
| **unset** (default) | — | `SiglipEncoder` — local CPU or local CUDA | laptop dev, CI |
| a Gradio URL | `gradio` (default) | `RemoteEncoder` — HF ZeroGPU Space | the **image**-embed batch lane (catalog backfill) |
| a JSON URL | `http` | `HttpEncoder` — plain JSON POST | the **search** lane: Modal CPU, scale-to-zero (F2.5) |

That's the whole design: the local encoder is the always-present baseline (invariant #5);
the remote ones are optional swaps, never a requirement.

---

## ▶ Search lane (F2.5) — Modal CPU, scale-to-zero

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
