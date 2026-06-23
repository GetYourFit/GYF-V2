# GPU lane — running perception / the M2 bake-off on a GPU

> **Doctrine:** D1 (capability port — app code never imports a model, it calls the port),
> D7 (free-tier GPU serving), D5 (eval-gated promotion). **Source:** `ml/perception/`,
> `spaces/gyf-gpu/`, `notebooks/m2_bakeoff_colab.ipynb`.

## One model, two backends

GPU work goes through a single port — `perception.model.Encoder` — so nothing in the app
changes regardless of where the GPU is. `perception.default_encoder()` (and the bake-off)
pick the backend from one env var:

| `GYF_ENCODER_REMOTE_URL` | Backend | When |
| --- | --- | --- |
| **unset** (default) | `SiglipEncoder` — local CPU or local CUDA | laptop dev, **Colab** (uses Colab's GPU locally), CI |
| set to a Gradio URL | `RemoteEncoder` — calls a remote GPU endpoint | a hosted GPU: HF Space, RunPod/Modal Gradio, etc. |

That's the whole design: the local encoder is the always-present baseline (invariant #5);
the remote one is an optional swap, never a requirement.

---

## ▶ Free path (recommended) — run M2 on Colab's free T4

No subscription, no remote URL. The notebook regenerates the catalog from a public dataset
and runs the bake-off on Colab's GPU with the **local** encoder.

1. Open **colab.research.google.com** → upload `notebooks/m2_bakeoff_colab.ipynb`.
2. `Runtime → Change runtime type → T4 GPU`.
3. `Runtime → Run all`; paste a GitHub read token when prompted.
4. It prints the leaderboard and downloads the `EvalReport`s → commit them to
   `eval-reports/bakeoffs/` as the M2 evidence.

Kaggle (≈30 GPU-hrs/week) works the same way if you prefer.

---

## ▶ Local path — your own machine

```bash
make m2-bakeoff          # dockerized, weights cached in the gyf-hf-cache volume
# or directly:
uv run --project ml python -m eval.bake_off
```

CPU works (slow); a local NVIDIA/Intel GPU is auto-selected.

---

## ▶ Remote serving lane (optional, for scale) — `spaces/gyf-gpu`

A persistent Gradio GPU endpoint, reusable for production perception and the M3/M4 photo
modules — not just one bake-off. Deploy it on whatever GPU host you like:

- **HF ZeroGPU** — needs **HF Pro** (~$9/mo) to attach ZeroGPU hardware to your own Space.
- **RunPod / Modal Gradio** — cheap pay-per-use; same `app.py` works.

Deploy `spaces/gyf-gpu/` (Gradio: `app.py` + `requirements.txt`), then point the stack at it:

```bash
GYF_ENCODER_REMOTE_URL=https://<your-endpoint>   # e.g. https://<user>-gyf-gpu.hf.space
GYF_HF_TOKEN=hf_...                              # only if the endpoint is private
```

Now `default_encoder()` and the bake-off embed through that GPU with **zero code changes**;
unset the var to fall back to local. The Space's `ALLOWED_MODELS` must stay in sync with the
`encoder` entries in `models.registry.json` (commercial-clean / Apache-2.0 only).

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
