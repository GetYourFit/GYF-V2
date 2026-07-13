# GPU lane — running perception / the M2 bake-off on a GPU

> **Doctrine:** D1 (capability port — app code never imports a model, it calls the port),
> D7 (free-tier GPU serving), D5 (eval-gated promotion). **Source:** `ml/perception/`,
> `spaces/gyf-gpu/`.

## One model, two backends

GPU work goes through a single port — `perception.model.Encoder` — so nothing in the app
changes regardless of where the GPU is. `perception.default_encoder()` (and the bake-off)
pick the backend from one env var:

| `GYF_ENCODER_REMOTE_URL` | Backend | When |
| --- | --- | --- |
| **unset** (default) | `SiglipEncoder` — local CPU or local CUDA | laptop dev, CI |
| set to a Gradio URL | `RemoteEncoder` — calls a remote GPU endpoint | a hosted GPU: HF Space, RunPod/Modal Gradio, etc. |

That's the whole design: the local encoder is the always-present baseline (invariant #5);
the remote one is an optional swap, never a requirement.

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
GYF_ENCODER_REMOTE_URL=https://<your-endpoint>   # e.g. https://<user>-gyf-gpu.hf.space
GYF_HF_TOKEN=hf_...                              # only if the endpoint is private
```

Now `default_encoder()` and the bake-off can embed through that GPU with **zero code changes**;
unset the var to fall back to local. The Space's `ALLOWED_MODELS` must stay in sync with
commercial-clean `encoder` entries in `models.registry.json`; CI enforces that boundary.

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
re-run `scripts/check_promotion.py` (M1 gate). See `docs/plans/m2-embedding-upgrade.md`.
```
