# GYF (Get Your Fit) — Technology Stack & Techniques

> **Status:** researched reference, not execution authority. Current selections and phase order live only in `docs/plans/active-execution-contract.md`; older provider/model picks here remain candidates until its gates pass.

> **What this document is.** The canonical, well-researched reference for *how* GYF is
> built: every technology, model, technique, and architectural decision, with the
> reasoning and the cutting-edge research behind each choice. It is the engineering
> companion to [`ideas-complete.md`](./vision/ideas-complete.md) (the product/vision brief).
> Read that first for *what* and *why* GYF is; read this for *how*. Every model and tooling
> choice is backed by [`research/deep-research-report.md`](./research/deep-research-report.md),
> which carries the full citations, alternatives, and confidence levels.
>
> **Guiding principles** (from the founding brief): AI-first from day one; state-of-the-art,
> free/open, and current; efficient, optimized, secure; beta-ready but scale-ready with no
> hardcoded limits; everything genuinely usable (no mockups); **plan before build, research
> before choosing a technology**. Every choice below names a primary pick *and* the
> researched alternatives so the decision is auditable.
>
> **Status legend.** ✅ Launch (Phase 1) · 🔜 Near-term (Phase 2–3) · 🧪 Research/Phase 4+.

---

## 0. Architecture at a Glance

GYF is a **modular monorepo** with a clear split between the product surface (web app +
API) and the **ML platform** (perception, taste, ranking, generation). The two communicate
only through versioned service contracts, so models can evolve independently of the UI.

```
┌──────────────────────────────────────────────────────────────────────┐
│  CLIENT  ── Next.js (App Router) PWA · React Server Components         │
└───────────────┬──────────────────────────────────────────────────────┘
                │  tRPC / typed REST + WebSocket (live reactions)
┌───────────────▼──────────────────────────────────────────────────────┐
│  EDGE / BFF  ── Next.js Route Handlers · auth · rate-limit · caching   │
└───────────────┬──────────────────────────────────────────────────────┘
                │  gRPC / async events (queue)
┌───────────────▼───────────────┐   ┌──────────────────────────────────┐
│  CORE API (Python/FastAPI)     │   │  ML PLATFORM (Python)            │
│  • accounts, profiles, social  │   │  • Perception (fashion VLM)      │
│  • catalog, commerce, affiliate│◄─►│  • Taste model / embeddings      │
│  • feedback ingestion          │   │  • Outfit compatibility + ranker │
│  • B2B export pipeline         │   │  • Generative try-on (diffusion) │
└───────┬───────────────┬────────┘   └───────────┬──────────────────────┘
        │               │                        │
   ┌────▼────┐   ┌───────▼───────┐        ┌───────▼────────┐
   │ Postgres│   │ Vector store  │        │ GPU inference  │
   │ +pgvector│  │ (Qdrant/Milvus)│       │ (Triton/vLLM)  │
   └─────────┘   └───────────────┘        └────────────────┘
        │
   ┌────▼─────────────────────────────────────────────────┐
   │ Object storage (S3-compatible) · Kafka/Redpanda events │
   │ Feature store · Offline lake · Eval & experimentation  │
   └────────────────────────────────────────────────────────┘
```

**Why this shape.** Styling is a *perception + preference* problem, so the ML platform is
a first-class system, not a side service. A typed BFF keeps the inspiration-first frontend
fast and safe; an event backbone makes "every interaction improves the next recommendation"
a structural property rather than an afterthought.

---

## 1. Frontend

| Concern | Choice | Why |
| --- | --- | --- |
| Framework | **Next.js (App Router) + React 19, TypeScript (strict)** | RSC + streaming for fast, inspiration-led feeds; one stack for web + PWA; huge ecosystem; free. |
| Styling/UI | **Tailwind CSS + shadcn/ui + Radix primitives** | Production-grade, accessible (WCAG 2.2) components without lock-in; fast to reach "professional from day one." |
| Motion | **Framer Motion / Motion One** | High interactiveness and polish the brief demands for posts and try-on reveals. |
| State/data | **TanStack Query + Zustand**, **tRPC** for typed API | End-to-end type safety; optimistic UI for save/cart/react. |
| Media | **next/image + AVIF/WebP**, blurhash placeholders, CDN | Image-heavy product; perceived performance is the experience. |
| Realtime | **WebSocket / Server-Sent Events** | Live reactions, shares, badge events on the Socials page. |
| Mobile path | **PWA first → React Native/Expo** 🔜 | Reuse logic; native camera for try-on capture later. |

**Accessibility & quality** are enforced via the ECC `a11y-architect` / `accessibility`
skill and `react-reviewer` on every PR. Core Web Vitals tracked in CI.

---

## 2. Backend & API

| Concern | Choice | Why |
| --- | --- | --- |
| Core services | **Python 3.12 + FastAPI** (async) | Same language as ML → no serialization friction between product and models; first-class async; Pydantic v2 contracts. |
| Edge/BFF | **Next.js Route Handlers** | Co-locate auth, caching, rate-limiting with the client. |
| Inter-service | **gRPC** (sync) + **events** (async) | Low-latency model calls + decoupled learning pipeline. |
| Auth | **Auth.js / Clerk-style OIDC, JWT + refresh, WebAuthn passkeys** 🔜 | Secure sessions, per-user private data, full account control incl. deletion (brief requirement). |
| Background work | **Celery / Arq + Redis**, **Temporal** 🔜 for try-on & B2B pipelines | Durable, retryable long-running GPU jobs and exports. |
| API style | **tRPC (web) + versioned REST/OpenAPI (partners)** | Internal DX + clean external contract for affiliates/B2B. |

---

## 3. Data Layer

| Store | Tech | Role |
| --- | --- | --- |
| Primary OLTP | **PostgreSQL 16** (free: **Supabase** / **Neon**) | Users, profiles, catalog, outfits, social graph, orders/affiliate events. Supabase free tier (500 MB, pgvector bundled) or Neon (3 GiB/branch, scale-to-zero) cover beta at $0. |
| Vectors | **pgvector (HNSW)** at launch → **Qdrant** at scale; **Milvus** at billion-scale 🧪 | Embedding search for items, outfits, and users. `pgvector` itself is $0; move off it beyond ~50–100M vectors. |
| Cache/queues | **Redis** | Sessions, hot feeds, rate limits, lightweight queues. |
| Events | **Kafka / Redpanda** | The behavioral backbone — every save/skip/react/share is an event. |
| Object store | **S3-compatible (R2/MinIO)** | User photos, garment imagery, generated try-ons. |
| Analytics/lake | **DuckDB/Parquet → ClickHouse** 🔜 | Offline training data, eval, and the B2B distillation source. |
| Feature store | **Feast** 🔜 | Consistent online/offline features for ranking. |

**Vector-store rationale (researched).** With HNSW, `pgvector` matches or beats dedicated
vector DBs up to ~1M vectors and keeps everything in one transactional store — ideal for
beta. Beyond ~50–100M vectors, throughput/latency push us to a purpose-built engine;
**Qdrant** is the best default for filtered production search and self-hosting, with
**Milvus** reserved for billion-vector horizontal scale. ([pgvector vs Qdrant](https://www.tigerdata.com/blog/pgvector-vs-qdrant),
[Milvus vs Qdrant 2026](https://www.kunalganglani.com/blog/milvus-vs-qdrant))

---

## 4. The ML Platform — GYF's Core Differentiation

This is where GYF is *not copyable*. Four pillars: **Perceive → Model taste → Compose &
rank → Visualize**, all fed by a continuous-learning loop.

### 4.1 Visual Style Understanding (Perception)

**Goal.** "See" garments like a stylist: vibe, color harmony, texture, silhouette,
formality — directly from imagery, not tags.

- **Primary embedding model: `Marqo-FashionSigLIP`** (ViT-B-16-SigLIP fine-tuned for
  fashion with Generalised Contrastive Learning). It reports up to **+57% MRR/recall** over
  prior fashion-CLIP models and is open and free — exactly the SOTA-but-free mandate. Used
  for item↔text↔item retrieval, "shop the look," and as the visual backbone for taste and
  compatibility. ([Marqo-FashionSigLIP card](https://huggingface.co/Marqo/marqo-fashionSigLIP),
  [Marqo blog](https://www.marqo.ai/blog/search-model-for-fashion))
- **Alternatives considered:** vanilla OpenCLIP / `FashionCLIP 2.0` (weaker on fashion
  retrieval); SigLIP 2 / DINOv2 as general visual backbones (kept as 🧪 candidates for
  texture/silhouette heads).
- **Attribute & structure extraction:** segmentation + attribute heads (category, color via
  perceptual Lab color space, pattern, formality, neckline, fit) trained on the embedding
  features. Color harmony scored in **CIELAB / CAM16** rather than RGB for human-faithful
  matching.
- **Why VLM-first:** the brief insists style "must be seen, not tagged." Embeddings give a
  continuous visual space where coordination = geometric harmony, enabling explanations.

### 4.2 User Modeling from a Photo — Two Separate Modules

**Goal.** From a single uploaded photo, deduce body type **and** skin tone (or accept manual
input) to personalize fit and color — privately. These are **two distinct modules** because
the body-shape literature does *not* solve skin tone; they have different models, training
data, and evaluation regimes.

#### 4.2a Body-Type Module (well-supported)
- Monocular single-image 3D body-shape estimation → semantic measurements
  (chest/waist/shoulder, height ratios) → body-type taxonomy. **Commercial-clean,
  SMPL-free stack** (decided 2026-06-20): **SAM 3D Body (3DB)** as the estimator
  (SOTA, in-the-wild robust) outputting **MHR (Momentum Human Rig, Apache-2.0)** —
  *not* SMPL; **Fast SAM 3D Body** for real-time inference; **Anny** (NAVER,
  Apache-2.0, WHO-calibrated, all-ages) for offline measurement-threshold calibration
  and fairness coverage. **Why not SMPL:** SMPL/SMPL-X/SHAPY/NLF are non-commercial
  (Meshcapade/MPI-gated) and unusable in a monetizing product; the academic line is
  retained only as reference. ([SAM 3D Body, arXiv 2602.15989](https://arxiv.org/abs/2602.15989),
  [MHR](https://github.com/facebookresearch/MHR), [Anny](https://github.com/naver/anny))
- **Pose/landmarks:** MediaPipe / RTMPose for fast, on-device-capable keypoints (also feeds
  try-on warping).
- **Licensing gate:** accept the SAM License before enabling in production; MHR + Anny
  (Apache-2.0) are the guaranteed fallback. Build & verify freely; gate the prod flag.
- *Confidence: well-supported by current research.*

#### 4.2b Skin-Tone Module (separate, custom, fairness-gated) — ⚠️ low-confidence area
A **dedicated, independent** module — flagged in the deep-research report as the lowest-
confidence pillar, so it is engineered and evaluated on its own track:
- **Pipeline:** face/skin segmentation → illumination-robust tone estimation in **CIELAB** →
  perceptual undertone palette (warm/cool/neutral) used for color recommendation.
- **Why separate:** the pose/shape (body-mesh) literature provides no tone solution; naïve
  RGB/lighting estimators are biased. This module needs its own data and lighting
  normalization.
- **Fairness gate (mandatory):** explicit evaluation across the **full tone spectrum** (e.g.
  Monk Skin Tone scale) before it can ship; it is the first thing to fall back to manual
  entry if confidence is low.
- *Confidence: low — treat as an open engineering problem with its own eval; never block the
  product on it (manual path always available).*

**Privacy (both modules):** photos processed for *derived attributes only*; raw images are
user-owned, encrypted, deletable, and never required (manual path always available).
On-device inference preferred where feasible.

### 4.3 Personal Taste Modeling & Recommendation

**Goal.** A living, per-user representation of taste that anticipates what they'll love and
sharpens with every signal — *"matures like a fine wine."*

- **Launch architecture (✅):** **two-tower retrieval** (user tower + item tower over fashion
  embeddings) for candidate generation, followed by a **sequential transformer ranker**
  (SASRec/Transformers4Rec-style) over the user's interaction history. Robust, well
  understood, cheap to serve.
- **Cold start (✅):** content-based bootstrap from the very first visit — onboarding signals
  (manual or photo-derived) + fashion embeddings give immediate, sensible recommendations
  before any history exists, satisfying the "zero-friction cold start" requirement.
- **Next-gen direction (🔜/🧪): generative recommendation with Semantic IDs.** Quantize each
  item's content embedding (RQ-VAE) into **Semantic IDs**, then model user history as a
  token sequence and *generate* the next item — the **TIGER** approach, scaled with
  **HSTU** (Hierarchical Sequential Transduction Unit), which shows NLP-like scaling laws
  for recommendation. This is the path to a compounding stylist that improves for everyone.
  ([TIGER / Generative Retrieval](https://papers.neurips.cc/paper_files/paper/2023/file/20dcab0f14046a5c6b02b61da9f13229-Paper-Conference.pdf),
  [Semantic IDs Practitioner's Handbook](https://arxiv.org/pdf/2507.22224))
- **Collective intelligence:** patterns learned across all users (which combinations get
  saved/shared) feed back into per-user ranking — the moat compounds with scale.
- **Explainability (✅, non-negotiable):** every recommendation ships a human-readable
  stylist reason + an honest **confidence** score (calibrated; conformal-prediction
  intervals 🔜). Reasons derive from the attribute/color-harmony layer, not post-hoc
  rationalization.

### 4.4 Outfit Composition & Compatibility

**Goal.** Deliver *outfits* (top + bottom + footwear/apparel) coordinated as one look, not
single items.

- **Compatibility model:** learn pairwise/set compatibility in the fashion-embedding space
  (graph/transformer over the outfit set), trained on curated outfits + observed
  co-engagement. Produces a single "this set works" score plus per-pair harmony.
- **Composition:** constrained generation — pick a diverse, *ranked* set of complete outfits
  (never five near-identical results) honoring budget, occasion, body type, skin tone, and
  the user's real wardrobe; gracefully degrade when a category is unavailable.
- **Diversity:** Determinantal Point Process (DPP) / MMR re-ranking to guarantee variety.
- **Wardrobe-aware styling (🔜):** style around items the user already owns.

### 4.45 Controllable Styling — NL Goals, Occasion & Region

**Goal.** Honor explicit user intent at recommendation time (per `vision/ideas-complete.md`): a free-text
goal box ("I want to look taller / broader / slimmer"), an occasion selector, and
region/culture-aware garments — all steering the recommender, not bolted on after.

- **Natural-language styling goals.** A small instruction-tuned **intent parser** (lightweight
  open LLM / NLU, served via vLLM 🔜) maps free text → a structured *visual-effect goal*
  (e.g. `elongate`, `broaden_shoulders`, `slim`). A **styling-effects engine** then translates
  goals into concrete garment-attribute constraints using **color theory + body-type
  intelligence** — e.g. vertical lines / monochrome / high waist → *taller*; dark, matte,
  structured sides → *slimmer*; structured shoulders / horizontal detail → *broader*. These
  constraints re-weight the outfit ranker (§4.3–4.4), and the chosen rationale flows straight
  into the explanation layer ("dark vertical lines elongate your silhouette").
- **Occasion conditioning.** Occasion is a first-class conditioning feature with a taxonomy
  (**casual, formal, wedding, festive, …**, extensible) used in both retrieval and ranking;
  always user-editable (per the brief's "never rigid").
- **Region- & culture-aware garments.** Garment taxonomy and catalog are **localized**: region
  metadata + a culturally-aware garment ontology (e.g. India → sarees, kurtas; not surfaced
  where irrelevant). Fashion embeddings already capture visual style; a region/culture facet
  filters and re-weights candidates so recommendations respect local dress norms.

*Confidence: Medium — composes well-understood NLU + constrained ranking; the color-theory →
attribute mapping is a curated, testable rule+ML layer.*

### 4.5 Generative Virtual Try-On — "see the look we designed, on *you*"

**Goal.** Not a product flat-lay. The user uploads a photo; GYF renders the **complete,
coordinated outfit the stylist chose for them** (top + bottom + footwear, selected for their
skin tone / body type / occasion) **on their own body**, shown *with the explanation of why
it suits them* + an honest confidence. This is the fusion of the stylist (§4.4) and the
renderer — the moment GYF stops being a catalog and becomes a mirror.

**Behind the `TryOnRenderer` port** (engineering-doctrine D1) so the model is swappable.

- **Use, don't train (beta).** *Using* try-on (user photo + catalog garment → rendered result)
  needs **no training data** — it's inference. Only *building* a model needs paired data. So
  beta **rents/licenses a try-on model at inference**, no dataset, no GPU training. The garment
  comes from the brand feed (licensed), the photo from the user (consented) — both clean to use;
  the only gate is the **model's license** (engineering-doctrine D2).
- **Licensing reality (researched 2026-06-20):** most open try-on *weights* are
  **non-commercial** (IDM-VTON, CatVTON, **FitDiT** → Tencent for commercial). **Leffa** is
  MIT *code* but its weights derive from research-only datasets (VITON-HD/DressCode). ⟹ for a
  monetizing product, **pay for a commercial try-on license / hosted API at inference**, or
  later train an MIT/Apache architecture on **clean real paired data** (see below).
- **Multi-garment is the hard, cutting-edge case.** Easy/cheap models dress *one* garment;
  putting top+bottom+**footwear** on one person at once is the SOTA frontier
  (**MuGa-VTON / OmniDiT / DiT-VTON "try-all"**). **Footwear is the weakest area** across all
  models — flag and phase it.
- **Own-it-later (scale).** When per-render cost justifies owning the model, train/fine-tune a
  permissive (MIT/Apache) architecture on the **clean real paired data we legitimately have:
  brand "on-model" photos** (a model wearing the exact item, supplied in the feed) + accumulated
  real try-on results. **No synthetic data** (per product direction).
- **Phasing (never blocks):**
  1. *Now/beta* — stylist composes the complete look; show it as one coordinated **"look"** with
     the why-it-suits-you reason; render the **hero pieces** (top+bottom) on the user's photo via
     a **licensed** model, footwear shown alongside.
  2. *Later* — full **multi-garment photoreal** render (whole outfit incl. footwear, on their body).
  - *Honest fallback (D6):* if a photo renders poorly, show the look on a **body matched to their
    measurements** rather than ship an uncanny result — trust over flash.
- **Serving:** distilled/few-step diffusion (LCM/Turbo-style) off the API box (HF ZeroGPU →
  Modal/RunPod); async job + progress; results cached; **safety filter on inputs/outputs**;
  body photos handled under `photo_storage` consent, ephemeral + erasable (D8).

### 4.6 Continuous Learning & Quality Protection

- **Event-sourced feedback** (save/cart/skip/react/share/follow) → feature store → scheduled
  + online retraining. Conflicting-signal detection and easy reversal per the brief.
- **Evaluation harness (✅):** offline (Recall@K, NDCG, compatibility AUC, try-on FID/LPIPS,
  calibration/ECE, plus diversity/novelty) for *candidate selection only* — offline metrics
  are known to under-predict online results. Promotion is gated by **online A/B +
  interleaving + counterfactual / off-policy (IPS) evaluation** for fast, sample-efficient
  assessment. A model ships only if quality provably rises. Uses the ECC `eval-harness` /
  `mle-reviewer` skills. See research report Pillar 6 for citations.
- **Guardrails:** drift monitoring, shadow deployments, automatic rollback. "Never silently
  regress" is enforced in CI gates, not by hope.

### 4.7 Training Data — Open Datasets & Low-Cost Acquisition

Bootstrap entirely on open datasets; the proprietary moat is first-party behavioral data.

| Need | Open dataset(s) |
| --- | --- |
| Item recognition / attributes / parsing | **DeepFashion, DeepFashion2, Fashionpedia** |
| Outfit compatibility / recommendation | **Polyvore Outfits** (53K outfits / 204K imgs), **Polyvore-disjoint**, **IQON3000** (~670K items) |
| Virtual try-on | **VITON-HD, DressCode** |
| Multimodal / language-guided | **Fashion-Gen** (stylist captions), **FashionIQ** (relative captions) |

- **Catalog** via affiliate-network / retailer **product feeds** — free, current, the same
  partners that monetize purchases.
- **First-party behavioral data** (saves, skips, carts, reacts, shares, follows, try-ons) is
  the compounding proprietary asset and the source of the B2B model.
- **Synthetic / self-generated** data from the try-on/generative stack balances rare body
  types, skin tones, and occasions (fairness — feeds the §4.2b skin-tone gate).
- Label only what behavior can't supply; cache embeddings; avoid re-computation. (Details +
  citations: research report Pillar 7.)

---

## 5. Social, Commerce & Monetization

| Capability | Tech / Technique |
| --- | --- |
| Socials feed | Ranked feed over the same taste/embedding stack; posts are shareable, downloadable, reactable (brief). Server-rendered for SEO + speed. |
| Style following | Follow a creator's style, then **re-render to the follower's own skin tone & preferences** (taste model + try-on), never a blind copy. |
| Profile & gamification | Outfits made / liked; badge engine (*Fashion Mogger*, *Trendsetter*) on likes/shares/comments — event-driven rules, leaderboards in Redis. |
| Commerce | "Shop the look" → **redirect to the parent retailer product page**; deep links + price/availability sync. |
| Affiliate | Affiliate-link attribution (UTM + partner APIs), click/conversion tracking as first-class events; reconciliation pipeline. |
| Moderation | VLM + policy classifiers on user uploads/posts; abuse and safety filters. |

---

## 6. B2B Data Engine

The B2C app's behavioral + visual data is **distilled** into a separately sellable model
(per the brief). Pipeline: event lake → privacy-preserving aggregation/anonymization →
trend, taste-cluster, and demand-signal features → distilled models / dashboards served via
a versioned partner API. Strict separation from PII; differential-privacy + k-anonymity
techniques 🔜; contractual + technical access controls.

---

## 7. Infrastructure, MLOps & Security

| Area | Choice |
| --- | --- |
| Containers/orchestration | **Docker + Kubernetes** (managed); GPU node pools for inference. |
| Model serving | **NVIDIA Triton** (diffusion/vision), **vLLM** (any LLM-based reasoning/explanation) 🔜. |
| CI/CD | **GitHub Actions**; trunk-based; preview deploys; model registry (**MLflow**). |
| IaC & config | **Terraform**; secrets in a vault; 12-factor config. |
| Observability | **OpenTelemetry + Prometheus + Grafana**; **Sentry**; ML-specific drift/quality dashboards. |
| Experimentation | Feature flags + A/B framework wired to the eval harness. |
| Security | TLS everywhere, encryption at rest, least-privilege IAM, per-user data isolation, **OWASP Top 10** review (ECC `security-reviewer`), dependency/secret scanning, PII tokenization, GDPR-style deletion. |
| Cost/efficiency | Step-down diffusion, embedding caches, autoscaling GPU, CDN for media — "efficiency, optimization, security" mandate. |

**Free-tier-first deployment path (cost-disciplined, per the brief).**
- **$0 beta:** web on **Vercel** (Hobby free; project `gyf-v2-app`, Git auto-deploy of `app/`) · DB+vectors on
  **Supabase** or **Neon** free pgvector · GPU inference (diffusion/embeddings) on **Hugging
  Face Spaces + ZeroGPU** (free shared GPU pool, ~5 min/day; PRO $9/mo → 40 min + priority).
- **Bridge to scale:** **Modal** ($30/mo free credit, 10 concurrent GPUs) or **RunPod** for
  try-on bursts.
- **At scale:** dedicated GPU nodes + **Qdrant/Milvus**, introduced only when usage forces it.
- **Avoid for GPU:** Fly.io (dropped GPU + free tier), Railway (free credit ≈ a few hours).
- *Quotas/pricing change frequently — verify at signup. Citations: research report Pillar 8.*

**Engineering process (from the brief).** Plan before build (`/plan`); research before
adopting any technique (this doc); TDD and code review via ECC reviewer skills; everything
genuinely functional — no mockups. Leverage relevant **ECC** skills throughout
(`react-reviewer`, `python-reviewer`, `mle-reviewer`, `security-reviewer`, `eval-harness`,
`accessibility`, `architect`).

---

## 8. Phased Rollout (mapped to the product arc)

| Phase | Ships | Key stack additions |
| --- | --- | --- |
| **1 — Intelligent stylist** | Onboarding (photo/manual, separate body + skin-tone modules), cold start, explained outfits, occasion + NL styling goals, region-aware garments, feedback loop, basic try-on (IDM-VTON), social posts, affiliate redirect | Next.js, FastAPI, Postgres+pgvector (Supabase/Neon free), Marqo-FashionSigLIP, two-tower + transformer ranker, intent parser + styling-effects engine, eval harness; HF ZeroGPU serving |
| **2 — Personal taste engine** | Wardrobe-aware styling, deeper personalization, context (weather/occasion), badges | Feast feature store, Qdrant, Semantic-ID generative recsys (beta), Temporal |
| **3 — Shopping companion** | Multi-retailer recommendations, smarter buying, richer commerce | Partner/affiliate APIs, ClickHouse, demand signals |
| **4 — Visualization layer** | High-fidelity multi-garment, on-body try-on | MuGa-VTON / DiT try-on, distilled diffusion serving |
| **5 — Ambient stylist + B2B** | Compounding collective intelligence, B2B data product | HSTU-scale generative recsys, privacy-preserving B2B pipeline |

---

## 9. Decision Summary (primary → alternatives)

| Layer | Primary | Alternatives weighed |
| --- | --- | --- |
| Frontend | Next.js + React + Tailwind/shadcn | Remix, SvelteKit, Nuxt |
| Backend | FastAPI (Python) | Node/NestJS, Go |
| OLTP | PostgreSQL | MySQL, CockroachDB |
| Vectors | pgvector → Qdrant → Milvus | Weaviate, Pinecone, Faiss |
| Events | Kafka/Redpanda | NATS, Pulsar |
| Fashion embeddings | Marqo-FashionSigLIP | OpenCLIP, FashionCLIP 2.0, SigLIP 2, DINOv2 |
| Recsys | Two-tower + transformer → TIGER/HSTU | DLRM, classic CF, pure LLM-recsys |
| Try-on | Licensed/hosted model at inference (beta) → own MIT/Apache arch on brand on-model photos (multi-garment, complete look on user) | IDM-VTON/CatVTON/FitDiT (all non-commercial), MuGa-VTON/OmniDiT/DiT-VTON (multi-garment targets) |
| Body type | SAM 3D Body (3DB) → MHR + Anny calibration (Apache-2.0, SMPL-free) | SMPL/SMPL-X/SHAPY/NLF (non-commercial-gated), MediaPipe-ratios-only, manual-only |
| Skin tone (separate module ⚠️) | Custom CIELAB tone + fairness gate | RGB heuristics (biased), manual-only |
| Controllable styling | Intent parser + color-theory/body-type effects engine | Free-text-only with no structure |
| Serving | Triton + vLLM | TorchServe, BentoML, KServe |

---

## Sources (key research & tooling)

- IDM-VTON — [project](https://idm-vton.github.io/) · [arXiv 2403.05139](https://arxiv.org/abs/2403.05139)
- MuGa-VTON — [arXiv 2508.08488](https://arxiv.org/pdf/2508.08488) · CatVTON / Leffa / Voost via [Awesome-Try-On-Models](https://github.com/Zheng-Chong/Awesome-Try-On-Models)
- Marqo-FashionSigLIP / FashionCLIP — [model card](https://huggingface.co/Marqo/marqo-fashionSigLIP) · [Marqo blog](https://www.marqo.ai/blog/search-model-for-fashion)
- Generative recsys / Semantic IDs — [TIGER (NeurIPS 2023)](https://papers.neurips.cc/paper_files/paper/2023/file/20dcab0f14046a5c6b02b61da9f13229-Paper-Conference.pdf) · [Semantic IDs Handbook (arXiv 2507.22224)](https://arxiv.org/pdf/2507.22224)
- Body shape/measurement (commercial-clean, SMPL-free) — [SAM 3D Body (arXiv 2602.15989)](https://arxiv.org/abs/2602.15989) · [Fast SAM 3D Body (arXiv 2603.15603)](https://arxiv.org/pdf/2603.15603) · [MHR (Apache-2.0)](https://github.com/facebookresearch/MHR) · [Anny (Apache-2.0)](https://github.com/naver/anny). Reference only (non-commercial): [Keep It SMPL](https://www.researchgate.net/publication/308190183_Keep_It_SMPL_Automatic_Estimation_of_3D_Human_Pose_and_Shape_from_a_Single_Image) · [Body Measurement Estimation (arXiv 2210.05667)](https://arxiv.org/pdf/2210.05667)
- Vector DBs — [pgvector vs Qdrant](https://www.tigerdata.com/blog/pgvector-vs-qdrant) · [Milvus vs Qdrant 2026](https://www.kunalganglani.com/blog/milvus-vs-qdrant)

> **Maintenance.** When a better/free SOTA technique appears, update the relevant section
> *and* the Decision Summary, and note the swap. Keep this file in lockstep with
> `ideas-complete.md`: product changes there should be reflected in stack choices here.
</content>
</invoke>
