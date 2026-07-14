# Free-Forever, GYF-Trained Virtual Try-On — the Moat Plan

> **Status: historical/evidence only.** Superseded by
> [`tryon-subscription-monetization.md`](./tryon-subscription-monetization.md) and the
> [`active-execution-contract.md`](./active-execution-contract.md) (try-on is F8/F9);
> nothing here independently authorises implementation.

> **Question answered:** how does GYF get virtual try-on that is (1) **$0 forever**,
> (2) **commercially clean**, and (3) **a real moat** because it trains on GYF's own
> data? This doc is the researched answer + the phased build. Written 2026-07-10.
> Sources cited inline; verified against primary repos, not marketing badges.

---

## 0. The one hard truth (why there's no shortcut)

**A free + commercial + good VTON model does not exist off-the-shelf.** Every strong
open try-on checkpoint is *free to run but illegal to monetize*, because its **weights
are trained on VITON-HD or DressCode** — datasets released under research-only terms.
The taint is in the **weights**, not the code:

| Model | Code license | Weights (what you'd actually serve) | Commercial? |
|---|---|---|---|
| **Leffa** (Meta, CVPR 2025) | **MIT** ✅ | trained on VITON-HD / DressCode | ❌ tainted |
| CatVTON (ICLR 2025) | CC-BY-NC-SA 4.0 | non-commercial | ❌ |
| IDM-VTON | code varies | SDXL + VITON-HD | ❌ |
| StableVITON | code varies | SD1.5 + VITON-HD | ❌ |
| OOTDiffusion | CC-BY-NC-SA | VITON-HD / DressCode | ❌ |

**Leffa is the only one whose *code* is MIT.** That's the whole game: an MIT
architecture means GYF can legally **take the model design and train its own weights
from scratch on its own data** — producing a checkpoint with zero dataset taint that
GYF owns outright. The others don't even give you that door.

So the plan is not "download a free model." It is: **rent Leffa now to ship (paid,
tiny), and train Leffa's MIT architecture on GYF's own catalog to own it free forever.**
One continuous model lineage — no vendor swap, no wasted work.

Sources: [Leffa GitHub (MIT)](https://github.com/franciszzj/Leffa) ·
[Leffa HF](https://huggingface.co/franciszzj/Leffa) ·
[CatVTON (CC-BY-NC-SA)](https://github.com/Zheng-Chong/CatVTON) ·
[FASHN — open VITON model comparison](https://fashn.ai/blog/comparing-the-top-4-open-source-virtual-try-on-viton-models)

---

## 1. What "own it" actually requires

To ship a commercial-clean Leffa checkpoint, **every input to training must also be
clean**, not just the architecture:

1. **Architecture** — Leffa, MIT. ✅ clean.
2. **Base backbone** — Leffa builds on **Stable Diffusion 1.5 inpainting**
   (CreativeML OpenRAIL-M — commercial *permitted* with behavioural use-restrictions).
   ✅ clean enough (not NC). Confirm the exact checkpoint at build time.
3. **Training data** — **GYF's own catalog on-model photos** only. Never VITON-HD /
   DressCode. This is the moat input (§3). ✅ clean by construction.
4. **Preprocessing models** — VTON training needs, per image: a **garment-agnostic
   mask**, **human parse**, and **pose/DensePose**. Each of *those* models has its own
   license, and this is the hidden rabbit hole:
   - **DensePose** (Detectron2) — Apache-2.0 ✅
   - **DWPose / RTMPose** (pose) — Apache-2.0 ✅ — **use these, NOT OpenPose** (OpenPose
     is non-commercial — a classic trap that would re-taint the pipeline).
   - **SCHP human parsing** (LIP/ATR-trained) — license **must be verified**; swap for
     an Apache/MIT parser if it isn't clean. ⚠️ due-diligence item.

**Invariant:** the D2 CI license gate (already in the repo) must be extended to cover
the preprocessing models too — not just the VTON weights. A clean VTON checkpoint fed
by a non-commercial pose model is still non-commercial.

---

## 2. Free compute — training AND serving at $0

Both halves have a genuine free lane (doctrine D7, free-tier-first):

**Training (the hard half):**
- **Kaggle** — **30 GPU-hours/week free**, Tesla **T4 (16 GB)** or **P100 (16 GB)**,
  12h/session, `torch`+`diffusers` preloaded.
  [Kaggle GPU quota](https://www.kaggle.com/general/108481)
- **Google Colab free** — ~15–30h/week T4 (16 GB), less predictable (idle disconnects).
- SD1.5-based VTON fine-tune **fits 16 GB** with LoRA + gradient checkpointing +
  batch 1–2. It's tight but real — T4 is explicitly "ideal for fine-tuning SD-class
  models." Full from-scratch training would want more; **fine-tune, don't pretrain.**
  [Free GPU 2026 guide](https://www.gmicloud.ai/en/blog/where-can-i-get-free-gpu-cloud-trials-in-2026-a-complete-guide)

**Serving (the easy half):**
- **HF ZeroGPU Spaces** — free A100 slices; GYF already runs the `gyf-gpu` Space this
  way for body/skin. Leffa **inference needs ~12 GB VRAM** → fits comfortably. Add a
  `virtual_tryon` endpoint + a `RemoteLeffaTryOnRenderer(GradioSpaceClient)` adapter
  behind the existing `TryOnRenderer` port. Same pattern as `RemoteEncoder`.

**Net: $0 training + $0 serving.** The only cost is engineering time.

**Honest ceiling:** Kaggle 30h/week means training runs in *chunks* (checkpoint →
resume next window). Fine for iterating a fine-tune; you're not training GPT here.
`# ponytail: free-tier training = chunked runs; rent a Modal/RunPod burst only if a
run must finish in one sitting.`

---

## 3. The data — and why it's the moat

**What a VTON model trains on:** *paired* examples — `(in-shop garment image, the same
garment worn by a person)` + derived agnostic-mask + parse + pose. Reference scale:
VITON-HD ships **11,647** training pairs (upper body); DressCode **48,392** (full body,
tops/bottoms/dresses).
[VITON-HD/DressCode format](https://arxiv.org/html/2511.18775)

**GYF already has the raw material:** the catalog averages **7.17 images/item** — for
most SKUs that includes both a **flat/ghost-mannequin shot** and **on-model shots**.
That *is* the paired signal VITON-HD sells; GYF gets it free from the affiliate feed.
The build is a **pairing + preprocessing pipeline**, not a data-collection project.

**Why this is a moat (not just cost-saving):**
1. **Distribution match.** VITON-HD/DressCode are generic studio catalogs everyone
   trains on. GYF's checkpoint learns **GYF's actual inventory** — its brands, its
   garment mix, and **region-specific dress** (sarees, kurtas — things VITON-HD has
   *zero* of). A model that renders GYF's own catalog better than any generic model is
   a product advantage competitors can't copy without GYF's feed.
2. **Behavioural fine-tuning (the compounding part).** GYF logs which try-ons users
   **keep, share, and convert on**. That signal → a preference fine-tune that pushes
   renders toward what actually converts *for GYF's users*. This is the D4 flywheel:
   the model gets better the more the product is used, on data only GYF has.
3. **Feeds the B2B line.** The same clean, owned checkpoint + behavioural data is the
   distillable asset for the B2B model — impossible on rented or NC weights.

**This is the honest moat framing:** GYF won't out-research Meta on the *same* public
data. It wins by owning a model tuned to *its own* catalog + *its own* conversion
signal — a data position, not an algorithm secret.

---

## 4. The phased build

**Phase 0 — Port (DONE ✅, commit `0c07002`).** `TryOnRenderer` port, `/tryon` router,
UI, events, `NullTryOnRenderer` baseline all restored. Any lane drops in behind it.

**Phase 1 — Ship on the rented lane (cheap bridge, optional).** `GYF_TRYON_PROVIDER=
fal-leffa` + a fal.ai key → renders today, commercial-clean, ~$0.10/render. fal free
credits ≈ 10–30 renders (a demo, not beta). *Use only to validate the UX end-to-end
while Phase 2 builds; skip if you'd rather wait for free.*

**Phase 2 — Data pipeline (the real work starts).**
`ml/pipelines/vton_pairs.py`: from the catalog, emit `(garment, on-model)` pairs;
generate agnostic-mask (parse) + DWPose + DensePose per pair; write a DressCode-format
dataset to storage. Gate every preprocessing model through the license check (§1.4).

**Phase 3 — Fine-tune Leffa on GYF pairs (Kaggle).**
LoRA fine-tune from SD1.5-inpaint base on the Phase-2 dataset, chunked across weekly
quota. Checkpoint to HF. Target: match rented-Leffa quality on GYF's *own* catalog.

**Phase 4 — Serve free on ZeroGPU.**
Add the Leffa endpoint to `spaces/gyf-gpu` + `RemoteLeffaTryOnRenderer` adapter. Flip
`GYF_TRYON_PROVIDER=zerogpu-leffa`. **Now free + commercial + serving.**

**Phase 5 — Eval gate → production lane (D5).**
Held-out GYF pairs → identity-preservation, garment-fidelity, artifact-rate scores →
`eval-reports/tryon-leffa-gyf-v1.json` → flip registry research→production. Only now
does it legally serve without a footnote.

**Phase 6 — Behavioural flywheel (the moat compounds).**
Log try-on keep/share/convert → periodic preference fine-tune → the model improves on
GYF's data forever, free.

---

## 5. Honest risks & ceilings

- **Quality will lag rented Leffa at first.** A fine-tune on a few thousand GYF pairs
  won't instantly beat Meta's full-scale training. It crosses over once enough clean
  pairs accumulate. Don't promise parity on day one.
- **Preprocessing licenses are the sneaky blocker** (§1.4) — one NC pose model taints
  everything. This is where most "free VTON" plans quietly fail the license gate.
- **Free training is chunked**, not one-shot — slower iteration. Acceptable; not fast.
- **Footwear is unsupported by every VTON model surveyed** — dress top+bottom, honestly
  skip shoes (the port's `rendered_slots` already says exactly what rendered).
- **Timeline is weeks, not a config flip.** Phases 2–5 are a real ML project. This doc
  is the plan; it is not something that renders tonight.

---

## 6. Recommendation

1. **Build Phase 2 first** — the paired-data pipeline is the gating asset and the moat;
   nothing else matters without it, and it's pure engineering (no GPU cost).
2. **Fine-tune (Phase 3) on Kaggle**, serve on ZeroGPU (Phase 4) → free + commercial.
3. **Skip the rented bridge** unless you need the UX validated this week — the free
   path is the destination, and fal's free credits don't cover a beta anyway.
4. **Extend the CI license gate to preprocessing models** before any of this ships.

The moat isn't the model — it's GYF's paired catalog + conversion data. Leffa's MIT
code is just the legal key that lets GYF turn that data into an owned, free, compounding
asset.
