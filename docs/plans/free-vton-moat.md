# Free-Forever, GYF-Trained Virtual Try-On — the Moat Plan

> **Status: ACTIVE, subordinate to
> [`active-execution-contract.md`](./active-execution-contract.md)** (owner amendment
> 2026-07-14: try-on is free). This is the F8/F9 build detail; the contract's order and gates
> win on any conflict. Work here starts only when the contract reaches F8.

> **Question answered:** how does GYF get virtual try-on that is (1) **$0 forever**,
> (2) **commercially clean**, and (3) **a real moat** because it trains on GYF's own
> data? This doc is the researched answer + the phased build. Written 2026-07-10.
> Sources cited inline; verified against primary repos, not marketing badges.

---

## 0. The corrected hard truth (research update 2026-07-16)

The original premise is no longer true. **FASHN VTON v1.5 now publishes inference code and
downloadable weights under Apache-2.0.** It is a commercially permissive external checkpoint and
must be evaluated, not ignored. That does not automatically prove every bundled parser/pose
artifact, training input, output right, privacy property or GYF quality gate; exact hashes and the
full dependency graph still pass the D2 license/provenance gate.

| Model | Code license | Weights (what you'd actually serve) | Commercial? |
|---|---|---|---|
| **FASHN VTON v1.5** | **Apache-2.0** | **Apache-2.0 published weights** | ✅ candidate; dependency/data/output due diligence still required |
| **Leffa** (Meta, CVPR 2025) | **MIT** ✅ | trained on VITON-HD / DressCode | ❌ tainted |
| CatVTON (ICLR 2025) | CC-BY-NC-SA 4.0 | non-commercial | ❌ |
| IDM-VTON | code varies | SDXL + VITON-HD | ❌ |
| StableVITON | code varies | SD1.5 + VITON-HD | ❌ |
| OOTDiffusion | CC-BY-NC-SA | VITON-HD / DressCode | ❌ |

Leffa remains useful because its MIT training architecture gives GYF a route to weights trained on
rights-cleared GYF data. FASHN is the first external serving candidate and benchmark because its
released weights are permissive (owner amendment 2026-07-16). GYF trains the owned challenger in
parallel once the rights/data trigger is met so the external checkpoint never becomes permanent
dependency.

The pre-PMF plan is therefore **do not open VTON**. Preserve the durable job/consent/quota spine,
benchmark FASHN and the rights-clean GYF candidate on one frozen scorecard in F9, and invest in
training only after rights-cleared pairs and a stable failure cluster justify it.

Sources: [Leffa GitHub (MIT)](https://github.com/franciszzj/Leffa) ·
[FASHN VTON v1.5 (Apache-2.0)](https://github.com/fashn-AI/fashn-vton-1.5) ·
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

**Serving (only after F9):** benchmark Modal T4/L4 and RunPod Flex behind the existing
`TryOnRenderer`; choose the lowest measured cost per successful render that passes latency,
payability and privacy gates. HF ZeroGPU is a research/grant lane, not a production dependency:
hosting requires a paid account and India-issued card support is an operational risk. Free credits
are revocable capacity, not an SLO or a permanent cost model.

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

**Phase 1 — FASHN external incumbent candidate (owner amendment 2026-07-16).** Pin exact source,
weights and dependency hashes; verify licenses and output/data terms; package behind the existing
port; benchmark T4/L4/Flex cost and latency; keep closed until F9. Hosted fal/FASHN adapters are
research-only unless their Tier-1 photo-processing terms pass the same gate.

**Phase 2 — Data pipeline (frozen until the post-PMF trigger).**
`ml/pipelines/vton_pairs.py`: from the catalog, emit `(garment, on-model)` pairs;
generate agnostic-mask (parse) + DWPose + DensePose per pair; write a DressCode-format
dataset to storage. Gate every preprocessing model through the license check (§1.4); catalogue on-model photo
training rights are verified in contract F4 before any pair enters training.

**Phase 3 — Fine-tune a rights-clean GYF candidate (after the trigger).**
LoRA fine-tune from SD1.5-inpaint base on the Phase-2 dataset, chunked across weekly
quota. Checkpoint to HF. Target: match rented-Leffa quality on GYF's *own* catalog.

**Phase 4 — Serve scale-to-zero behind the existing port.**
Package the winning owned checkpoint behind `TryOnRenderer`; deploy only the measured T4/L4/Flex
lane. No provider name becomes part of the product contract.

**Phase 5 — Eval gate → production lane (D5).**
Use at least 100 identity/item-disjoint cases and three blinded reviewers. A candidate needs ≥90%
usable outputs, ≤5% critical garment-fidelity errors, ≤5% severe identity/body artifacts, zero
critical safety/privacy failures, p95 queue+render ≤60 seconds, ≤₹5 per successful render and a
monthly projection within the contract ceiling. Roll out 1%→5%→25%; stop on any privacy incident,
>2% system errors or budget breach.

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

1. **Do not invest pre-PMF.** Keep try-on closed and preserve the shipped durable spine.
2. Package FASHN v1.5 as the permissive external incumbent candidate in F8/F9; public Leffa
   weights remain research-only.
3. Start GYF training only after ≥2,000 rights-cleared pairs and a stable ≥10% benchmark failure
   cluster; behavioural tuning additionally requires ≥10,000 consented joined outcomes.
4. Extend the CI license/provenance gate to every preprocessing artifact, then promote only a
   statistically superior, rights-clean owned candidate.

The moat isn't the model — it's GYF's paired catalog + conversion data. Leffa's MIT
code is just the legal key that lets GYF turn that data into an owned, free, compounding
asset.
