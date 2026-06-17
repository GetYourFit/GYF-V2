# GYF — Deep Research Report: State of the Art Across All Technical Pillars

*Generated: 2026-06-17 | Sources: 30+ | Confidence: High (pillars 1, 3, 5, 7, 8), Medium (pillars 2, 4, 6)*

> Companion to [`ideas-complete.md`](../vision/ideas-complete.md) (vision) and
> [`tech-stack.md`](../tech-stack.md) (stack decisions). This report grounds each
> engineering pillar in current papers, open models, and free/low-cost tooling, with
> recommended approaches, alternatives, and cost notes. Every claim is cited; where only
> one source supports a claim or it is inference, it is flagged.

---

## Executive Summary

GYF can be built **end-to-end on open models and free tiers** through beta, with paid
infrastructure introduced only when scale demands it. The fashion-AI field has matured
decisively toward **transformer/diffusion architectures**: fashion-specific embedding
models (Marqo-FashionSigLIP) for perception, **generative recommenders with Semantic IDs**
(TIGER/HSTU) for taste, **diffusion-transformer multi-garment try-on** (MuGa-VTON, Leffa,
CatVTON) for visualization, and **graph/transformer outfit-compatibility** models for
coordination. Rich open datasets (DeepFashion(2), Polyvore, Fashionpedia, VITON-HD,
DressCode, FashionIQ) cover every training need, so the dominant proprietary asset becomes
**first-party behavioral data**. For deployment, **Hugging Face ZeroGPU + Supabase/Neon
(free pgvector)** form a genuinely $0 beta stack; serverless GPU (Modal $30/mo credit,
RunPod) bridges to scale. The main *open* risks: illumination-robust **skin-tone fairness**
and **offline→online metric gap** in recommendation — both addressable with disciplined
evaluation.

---

## Pillar 1 — Visual Style Understanding / Fashion Image Embeddings

**Recommendation: `Marqo-FashionSigLIP` as the visual backbone.** A ViT-B-16-SigLIP model
fine-tuned for fashion with Generalised Contrastive Learning (trained on category, style,
color, material, keywords, fine detail — not just captions). Reports **up to +57% MRR and
recall** on text-to-image retrieval and +11% on category-to-product vs prior fashion-CLIP
models; open weights, free ([Marqo card](https://huggingface.co/Marqo/marqo-fashionSigLIP),
[Marqo blog](https://www.marqo.ai/blog/search-model-for-fashion),
[MarkTechPost](https://www.marktechpost.com/2024/08/17/marqo-releases-marqo-fashionclip-and-marqo-fashionsiglip-a-family-of-embedding-models-for-e-commerce-and-retail/)).

**Why.** Style "must be seen, not tagged" (per the brief). A fashion-tuned multimodal
embedding gives a continuous visual space where coordination, retrieval, "shop the look,"
and the visual feature base for taste/compatibility all share one representation.

**Alternatives weighed.**
- `Marqo-FashionCLIP` — same family, lighter; viable if SigLIP serving cost matters.
- Vanilla OpenCLIP / `FashionCLIP 2.0` — outperformed by Marqo models on fashion retrieval.
- `SigLIP 2`, `DINOv2` — strong *general* visual backbones; keep as research candidates for
  dedicated texture/silhouette heads.

**Technique notes.** Layer attribute heads (category, pattern, formality, neckline, fit) on
the embeddings; score **color harmony in CIELAB/CAM16**, not RGB, for human-faithful matching.

*Confidence: High — multiple corroborating sources, public benchmarks.*

---

## Pillar 2 — User Modeling from One Photo: TWO Separate Modules

**Recommendation: treat body-type and skin-tone as two distinct modules** — different models,
training data, and evaluation regimes — because the body-shape literature does *not* solve
skin tone. Bundling them hides the fact that one is well-supported and the other is an open,
fairness-critical problem.

### 2a. Body-Type Module (well-supported)

- **Body shape/type:** the **SMPL** statistical body model is the field standard — a
  low-dimensional, differentiable 3D mesh underpinning most monocular pose/shape pipelines
  ([Keep It SMPL](https://www.researchgate.net/publication/308190183_Keep_It_SMPL_Automatic_Estimation_of_3D_Human_Pose_and_Shape_from_a_Single_Image)).
  Predict **semantic measurements** (chest/waist/shoulder, height ratios) from a single
  frontal silhouette/image (BMnet-style, with adversarial augmentation), then map to a
  body-type taxonomy ([Body Measurement Estimation, arXiv 2210.05667](https://arxiv.org/pdf/2210.05667)).
- **Pose/landmarks:** MediaPipe / RTMPose for fast, on-device-capable keypoints (feeds both
  body estimation and try-on warping).
- *Confidence: High — well-sourced, mature literature.*

### 2b. Skin-Tone Module (separate, custom, fairness-gated) — ⚠️ low-confidence

A **dedicated, independent** module on its own engineering and evaluation track:
- *Caveat — the body-shape literature does not solve tone* (confirmed across the
  SMPL/measurement sources), so this cannot ride on the body pipeline.
- **Pipeline:** face/skin segmentation → illumination-robust tone estimation in **CIELAB** →
  perceptual undertone palette (warm/cool/neutral) for color recommendation.
- **Fairness gate (mandatory):** explicitly evaluate across the **full tone spectrum** (e.g.,
  Monk Skin Tone scale) to avoid the well-documented bias of RGB/lighting-naive estimators;
  must pass before shipping, and falls back to manual entry when confidence is low.
- *(Inference: best-practice recommendation, not a single cited model.)*
- *Confidence: Low — robust + fair skin-tone is an open engineering problem requiring custom
  work and careful evaluation; never block the product on it.*

**Privacy (both modules).** Derive attributes only; raw photos are user-owned, encrypted,
deletable; manual entry path always available; prefer on-device inference.

---

## Pillar 3 — Personal Taste Modeling & Recommendation

**Recommendation: two-tower retrieval + transformer ranker at launch → generative
recommendation with Semantic IDs (TIGER/HSTU) as the scaling path.**

- **Launch (✅):** **two-tower** (user × item over fashion embeddings) candidate generation
  + a **sequential transformer ranker** (SASRec / Transformers4Rec-style) over interaction
  history. Robust, cheap, well understood.
- **Cold start (✅):** content-based bootstrap from onboarding signals + fashion embeddings →
  sensible recommendations on the first visit, before any history exists.
- **Next-gen (🔜):** **Semantic IDs** — quantize each item's content embedding (RQ-VAE) into
  ordered tokens, model user history as a token sequence, and *generate* the next item. This
  is the **TIGER** approach ([NeurIPS 2023](https://papers.neurips.cc/paper_files/paper/2023/file/20dcab0f14046a5c6b02b61da9f13229-Paper-Conference.pdf),
  [Semantic IDs Practitioner's Handbook, arXiv 2507.22224](https://arxiv.org/pdf/2507.22224)),
  scaled with **HSTU** (Hierarchical Sequential Transduction Unit), which shows **NLP-like
  scaling laws** for recommendation up to 1.5T params
  ([Generative Recommendation survey context](https://www.emergentmind.com/topics/transformer-index-for-generative-recommenders-tiger)).
  Open frameworks exist (e.g., **MiniOneRec**, [arXiv 2510.24431](https://arxiv.org/pdf/2510.24431)).

**Why this path.** Two-tower is the safe, low-cost beta; generative+Semantic-ID is how GYF
becomes a *compounding* stylist whose collective signal sharpens per-user ranking. Semantic
IDs also share knowledge across visually/semantically similar items — implicit taste modeling.

**Alternatives weighed.** Classic collaborative filtering / DLRM (weaker on cold start and
visual signal); pure LLM-as-recommender (decoding pitfalls — see [SimGR, arXiv 2602.07847](https://arxiv.org/pdf/2602.07847)).

**Explainability (non-negotiable):** every rec ships a human-readable reason + calibrated
**confidence** (conformal intervals 🔜), derived from the attribute/color-harmony layer.

*Confidence: High — strong, recent, converging literature.*

---

## Pillar 4 — Outfit Composition & Compatibility

**Recommendation: transformer-over-the-outfit-set compatibility scorer, optionally fused
with a graph (hyper/GNN) layer for category structure and personalization.**

- **Transformer approach:** represent an outfit as a sequence of item embeddings with a
  prepended **"outfit token"**; multi-head self-attention captures all pairwise and
  higher-order relationships; the outfit-token vector → compatibility score
  ([Transformer-based GNNs for Outfit Generation, arXiv 2304.08098](https://arxiv.org/abs/2304.08098)).
- **Graph approach:** **NGNN** (each outfit a subgraph, nodes = categories) and **hypergraph
  neural networks** score set compatibility via attention; **ViT embeddings + hypergraph**
  improve accuracy ([Outfit Compatibility using GNN, arXiv 2404.18040](https://arxiv.org/abs/2404.18040)).
- **Personalized + compatibility-oriented:** **Hybrid-Hierarchical Fashion Graph Attention
  Network** combines compatibility with personalization over user–outfit–item graphs
  ([arXiv 2508.11105](https://arxiv.org/pdf/2508.11105)); see also the multimodal framework
  in [arXiv 2511.07573](https://arxiv.org/pdf/2511.07573).

**Composition technique.** Constrained generation of complete, **diverse, ranked** outfits
(top + bottom + footwear/apparel) honoring budget, occasion, body type, skin tone, and the
user's real wardrobe; use **DPP/MMR** re-ranking to guarantee variety (never five
near-identical looks); graceful degradation when a category is unavailable.

*Confidence: Medium-High — established techniques; exact best model is dataset-dependent.*

---

## Pillar 5 — Photorealistic Multi-Garment Virtual Try-On

**Recommendation: start with IDM-VTON, scale to a diffusion-transformer multi-garment model
(MuGa-VTON), keep CatVTON as the efficiency option.**

- **Baseline (✅): IDM-VTON** — diffusion try-on fusing high-level garment semantics into
  cross-attention and low-level detail via a parallel UNet; strong identity/detail
  preservation in the wild (ECCV 2024). Best quality-per-cost starting point
  ([project](https://idm-vton.github.io/), [arXiv 2403.05139](https://arxiv.org/abs/2403.05139),
  [HF model](https://huggingface.co/yisol/IDM-VTON)).
- **Efficiency: CatVTON** ("concatenation is all you need," ICLR 2025) — lightweight
  diffusion try-on, **SSIM ≈ 0.871, LPIPS ≈ 0.082**; cheaper inference.
- **Multi-garment target (🔜): MuGa-VTON** — multi-garment try-on via **diffusion
  transformers** with prompt customization, preserving garment + identity — the closest match
  to GYF's "top + bottom + apparel in one render" requirement
  ([arXiv 2508.08488](https://arxiv.org/pdf/2508.08488)). Also track **Leffa** (CVPR 2025,
  flow-field attention control) and **Voost** (unified try-on/try-off DiT,
  [arXiv 2508.04825](https://arxiv.org/pdf/2508.04825)); curated index:
  [Awesome-Try-On-Models](https://github.com/Zheng-Chong/Awesome-Try-On-Models).

**Serving.** Distilled/few-step diffusion (LCM/Turbo-style) on GPU; async job with progress;
results cached in object storage; safety filtering on inputs/outputs.

**Why diffusion-DiT.** The field has converged on diffusion *transformers* as the photorealism
leader for single- and multi-garment try-on — directly meeting the brief's "really photo
realistic" bar.

*Confidence: High — very active, well-benchmarked area.*

---

## Pillar 6 — Continuous Learning, Evaluation & Quality Protection

**Recommendation: event-sourced behavioral pipeline + a layered eval harness that gates every
model release; never trust offline metrics alone.**

- **Offline metrics:** Precision/Recall, MAP, **NDCG**, compatibility AUC; try-on **FID/LPIPS**;
  calibration (**ECE**); plus **diversity & novelty** metrics
  ([Shaped.ai: offline vs online](https://www.shaped.ai/blog/evaluating-recommender-models-offline-vs-online-evaluation)).
- **The gap is real:** offline metrics often *don't* predict online performance
  ([arXiv 2011.07931](https://arxiv.org/pdf/2011.07931)) — so offline is for candidate
  selection only.
- **Online:** A/B tests, plus **interleaving + counterfactual / off-policy evaluation (IPS)**
  for rapid, sample-efficient assessment
  ([Airbnb interleaving+counterfactual, arXiv 2508.00751](https://arxiv.org/html/2508.00751v1),
  [Counterfactual eval, eugeneyan](https://eugeneyan.com/writing/counterfactual-evaluation/)).
- **Drift:** the offline→online mapping drifts continuously with traffic/time-of-day — monitor
  in production with shadow deployments and automatic rollback. A model ships **only if quality
  provably rises** (brief's "never silently regress"). Fairness/transparency tracked too
  ([arXiv 2406.11323](https://arxiv.org/pdf/2406.11323)).

**Pipeline.** Every save/skip/cart/react/share/follow/try-on → event log (Kafka/Redpanda) →
feature store → scheduled + online retraining; conflicting-signal detection with easy reversal.

*Confidence: Medium-High — methods well-established; specifics tuned per metric/traffic.*

---

## Pillar 7 — Free/Open Fashion Datasets & Low-Cost Data Acquisition

**Recommendation: bootstrap entirely on open datasets; treat first-party behavior as the moat;
augment with synthetic data.** All names below are standard, citable open resources
([mmfashion data docs](https://mmfashion.readthedocs.io/en/latest/DATA_PREPARATION/),
[FashionStylist survey, arXiv 2604.09249](https://arxiv.org/html/2604.09249)).

| Need | Open dataset(s) | Notes |
| --- | --- | --- |
| Item recognition / attributes / parsing | **DeepFashion, DeepFashion2, Fashionpedia** | Standard for visual item representations; Fashionpedia = 48K free-license street photos. |
| Outfit compatibility / recommendation | **Polyvore Outfits** (53K outfits / 204K imgs), **Polyvore-disjoint** (32K), **IQON3000** (~670K items) | Train compatibility + composition. |
| Virtual try-on | **VITON-HD, DressCode** | Garment synthesis / appearance transfer. |
| Multimodal / language-guided | **Fashion-Gen** (stylist captions), **FashionIQ** (relative captions) | Text↔image retrieval, explanations. |

**Acquisition strategy & cost discipline.**
- **Catalog** via affiliate-network / retailer **product feeds** — free, current, the same
  partners that monetize purchases.
- **First-party behavioral data** (saves, skips, carts, reacts, shares, follows, try-ons) is
  the compounding proprietary asset and the source of the B2B model — no competitor has it.
- **Synthetic / self-generated** data from the try-on/generative stack to balance rare body
  types, skin tones, and occasions (fairness).
- Label only what behavior can't supply; cache embeddings; avoid re-computation.

*Confidence: High — datasets are well-known and openly available.*

---

## Pillar 8 — Free-Tier Deployment & Serving Infrastructure

**Recommendation (beta, ~$0):** Vercel/Cloudflare (web) + a free Postgres-with-pgvector
(**Supabase** or **Neon**) + **Hugging Face ZeroGPU** for diffusion/embedding inference;
graduate to serverless GPU (**Modal**, **RunPod**) then dedicated GPU as usage grows.

| Layer | Free / low-cost option | Limits & notes |
| --- | --- | --- |
| Web/edge | **Cloudflare Workers** free | 100K req/day, 10ms CPU/invocation — lightweight APIs only ([Render free-tier roundup](https://render.com/articles/platforms-with-a-real-free-tier-for-developers-in-2026)). |
| DB + vectors | **Supabase free** (500MB DB, 50K MAU, pgvector bundled) or **Neon free** (3 GiB/branch, scale-to-zero) | `pgvector` itself is $0; pay only Postgres infra ([Koyeb Postgres free tiers](https://www.koyeb.com/blog/top-postgresql-database-free-tiers-in-2026), [DigitalApplied vector DBs 2026](https://www.digitalapplied.com/blog/vector-databases-for-ai-agents-pinecone-qdrant-2026)). |
| GPU inference | **HF Spaces + ZeroGPU** | Free: shared RTX Pro 6000 Blackwell pool, ~5 min GPU/day; PRO $9/mo → 40 min + priority; overage $1 / 10 min ([ZeroGPU docs](https://huggingface.co/docs/hub/en/spaces-zerogpu), [eesel HF pricing](https://www.eesel.ai/blog/hugging-face-pricing)). Best true-free GPU path. |
| Serverless GPU (scale) | **Modal** ($30/mo free credit, 10 concurrent GPUs; H100 ≈ $3.95/hr), **RunPod** | Bridge to production ([RunPod serverless GPU guide](https://www.runpod.io/articles/guides/top-serverless-gpu-clouds), [Modal pricing](https://costbench.com/software/ai-gpu-cloud/modal/)). |
| Avoid for GPU | **Fly.io, Railway** | Fly.io dropped GPU ambitions & free tier; Railway free credit ≈ a few hrs ([ExpressTech Fly.io](https://expresstech.io/7-fly-io-alternatives-in-2026-real-pricing-after-the-free-tier-died/)). |
| Vector at scale | **Qdrant** (usage-based; self-host free) → **Milvus** (billion-scale) | Move off pgvector beyond ~50–100M vectors. |

**Cost path:** $0 beta (HF ZeroGPU + Supabase/Neon + Cloudflare/Vercel) → Modal/RunPod credits
for try-on bursts → dedicated GPU + Qdrant/Milvus only when scale forces it. Matches the
brief's "free-tier first, spend only when scale demands."

*Confidence: High — pricing/limits from multiple 2026 sources (verify quotas at signup; these
change frequently).*

---

## Key Takeaways

- **Everything needed for beta is open and free.** Open models (Marqo-FashionSigLIP, IDM-VTON,
  CatVTON) + open datasets (DeepFashion/Polyvore/VITON-HD/etc.) + free tiers (HF ZeroGPU,
  Supabase/Neon) = a genuine $0 launch stack.
- **The moat is behavioral data + a compounding generative recommender** (Semantic IDs / HSTU),
  not any single off-the-shelf model.
- **Multi-garment, photorealistic try-on is now achievable** with diffusion transformers
  (MuGa-VTON) — exactly GYF's hardest visual requirement.
- **Two genuine engineering risks to plan for:** (1) fair, illumination-robust **skin-tone**
  estimation (custom module + spectrum evaluation); (2) the **offline→online metric gap**
  (gate releases with interleaving + counterfactual eval, not offline numbers alone).
- **Cost discipline is structural:** start on free GPU quotas, graduate to serverless GPU
  credits, pay for dedicated infra only at scale.

---

## Sources

1. [Marqo-FashionSigLIP model card](https://huggingface.co/Marqo/marqo-fashionSigLIP) — fashion embedding SOTA, +57% MRR.
2. [Marqo blog: search model for fashion](https://www.marqo.ai/blog/search-model-for-fashion) — GCL training, benchmarks.
3. [MarkTechPost: Marqo Fashion models](https://www.marktechpost.com/2024/08/17/marqo-releases-marqo-fashionclip-and-marqo-fashionsiglip-a-family-of-embedding-models-for-e-commerce-and-retail/) — release overview.
4. [Keep It SMPL](https://www.researchgate.net/publication/308190183_Keep_It_SMPL_Automatic_Estimation_of_3D_Human_Pose_and_Shape_from_a_Single_Image) — monocular 3D body shape/pose.
5. [Body Measurement Estimation (arXiv 2210.05667)](https://arxiv.org/pdf/2210.05667) — single-image measurements.
6. [TIGER / Generative Retrieval (NeurIPS 2023)](https://papers.neurips.cc/paper_files/paper/2023/file/20dcab0f14046a5c6b02b61da9f13229-Paper-Conference.pdf) — Semantic IDs.
7. [Semantic IDs Practitioner's Handbook (arXiv 2507.22224)](https://arxiv.org/pdf/2507.22224) — production guidance.
8. [MiniOneRec (arXiv 2510.24431)](https://arxiv.org/pdf/2510.24431) — open generative-rec framework.
9. [TIGER topic overview](https://www.emergentmind.com/topics/transformer-index-for-generative-recommenders-tiger) — HSTU scaling laws.
10. [Transformer-based GNNs for Outfit Generation (arXiv 2304.08098)](https://arxiv.org/abs/2304.08098) — outfit-token transformer.
11. [Outfit Compatibility using GNN (arXiv 2404.18040)](https://arxiv.org/abs/2404.18040) — NGNN/hypergraph.
12. [Hybrid-Hierarchical Fashion Graph Attention (arXiv 2508.11105)](https://arxiv.org/pdf/2508.11105) — personalized compatibility.
13. [Multimodal fashion recommendation framework (arXiv 2511.07573)](https://arxiv.org/pdf/2511.07573).
14. [IDM-VTON project](https://idm-vton.github.io/) & [arXiv 2403.05139](https://arxiv.org/abs/2403.05139) — baseline try-on.
15. [MuGa-VTON (arXiv 2508.08488)](https://arxiv.org/pdf/2508.08488) — multi-garment DiT try-on.
16. [Voost (arXiv 2508.04825)](https://arxiv.org/pdf/2508.04825) — unified try-on/off DiT.
17. [Awesome-Try-On-Models](https://github.com/Zheng-Chong/Awesome-Try-On-Models) — curated index (CatVTON, Leffa, etc.).
18. [Shaped.ai: offline vs online eval](https://www.shaped.ai/blog/evaluating-recommender-models-offline-vs-online-evaluation).
19. [Do Offline Metrics Predict Online? (arXiv 2011.07931)](https://arxiv.org/pdf/2011.07931).
20. [Airbnb interleaving + counterfactual (arXiv 2508.00751)](https://arxiv.org/html/2508.00751v1).
21. [Counterfactual eval (eugeneyan)](https://eugeneyan.com/writing/counterfactual-evaluation/).
22. [Transparency, Privacy, Fairness in RecSys (arXiv 2406.11323)](https://arxiv.org/pdf/2406.11323).
23. [mmfashion data preparation](https://mmfashion.readthedocs.io/en/latest/DATA_PREPARATION/) — dataset specs.
24. [FashionStylist multimodal dataset (arXiv 2604.09249)](https://arxiv.org/html/2604.09249) — dataset landscape.
25. [Koyeb: top Postgres free tiers 2026](https://www.koyeb.com/blog/top-postgresql-database-free-tiers-in-2026) — Supabase/Neon limits.
26. [DigitalApplied: vector DBs 2026](https://www.digitalapplied.com/blog/vector-databases-for-ai-agents-pinecone-qdrant-2026).
27. [HF ZeroGPU docs](https://huggingface.co/docs/hub/en/spaces-zerogpu) — free GPU quotas.
28. [eesel: Hugging Face pricing 2026](https://www.eesel.ai/blog/hugging-face-pricing).
29. [RunPod: serverless GPU clouds 2026](https://www.runpod.io/articles/guides/top-serverless-gpu-clouds).
30. [Modal pricing 2026 (CostBench)](https://costbench.com/software/ai-gpu-cloud/modal/).
31. [ExpressTech: Fly.io alternatives / free-tier changes](https://expresstech.io/7-fly-io-alternatives-in-2026-real-pricing-after-the-free-tier-died/).
32. [Render: real free tiers 2026](https://render.com/articles/platforms-with-a-real-free-tier-for-developers-in-2026).

## Methodology

Ran the `ecc:deep-research` workflow using web search/fetch (firecrawl/exa MCP not configured;
`WebSearch` used as the equivalent). ~10 query variations across the 8 pillars, 30+ unique
sources analyzed, prioritizing arXiv/official docs/reputable 2025–2026 sources. Offline→online
metric gap and skin-tone fairness flagged as the lowest-confidence / highest-risk areas.
Pricing and free-tier quotas change frequently — verify at signup.
</content>
