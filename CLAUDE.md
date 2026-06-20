# CLAUDE.md — GYF (Get Your Fit)

> **Purpose.** This is the operating guide for any AI agent or developer working on GYF.
> It consolidates the full product vision, feature set, technology stack, and engineering
> rules into one structured reference. Read it before doing anything.
>
> **Sources of truth (read these for the deepest detail):**
> - [`docs/vision/ideas-complete.md`](./docs/vision/ideas-complete.md) — the canonical product/vision brief (merged superset of all `ideas*.md`).
> - [`docs/tech-stack.md`](./docs/tech-stack.md) — every technology, model, and architecture decision with rationale.
> - [`docs/research/deep-research-report.md`](./docs/research/deep-research-report.md) — cited state-of-the-art research backing each technical pillar.
>
> When these documents and this file disagree, **the source docs win** — update this file to match.

---

## 0. Repository Map

```
GetYourFit-New/
├── CLAUDE.md                          # this file — operating guide & entry point
├── docs/
│   ├── engineering-doctrine.md        # THE HIGHEST-IQ WAY — cross-cutting design law (how every pillar is built)
│   ├── roadmap.md                     # the SEQUENCE — dependency-correct build order (M0→M12→P2–P5)
│   ├── vision/
│   │   ├── ideas-complete.md          # canonical product/vision brief
│   │   └── drafts/                    # raw idea inputs (history)
│   │       ├── ideas.md
│   │       └── ideas.V2.md
│   ├── tech-stack.md                  # authoritative tech & architecture decisions
│   ├── implementation-plan.md         # phased build plan (P0–P5) with gates
│   └── research/
│       └── deep-research-report.md    # cited SOTA research per pillar
└── ECC/                               # ECC plugin: reusable skills/agents (see §7)
```

| Path | Role |
| --- | --- |
| `CLAUDE.md` | **This file.** Structured operating guide for agents/devs; entry point that summarizes everything and points to the source docs. |
| `docs/engineering-doctrine.md` | **The highest-IQ way — authoritative cross-cutting design law.** *How* every ML pillar is built so GYF is SOTA, commercially clean, never quality-compromised, and never dev-blocked: capability ports, two-lane (research/production) model lifecycle with a CI license gate, foundation+adapter, the data-flywheel moat, eval-gated promotion. Read alongside `tech-stack.md`. |
| `docs/vision/ideas-complete.md` | **Canonical product/vision brief** — the merged superset of all `ideas*.md`. Authoritative for *what* GYF is. |
| `docs/vision/drafts/ideas.md`, `…/ideas.V2.md` | Raw idea-draft inputs, folded into `ideas-complete.md` (kept for history). |
| `docs/tech-stack.md` | **Authoritative for *how*** — every technology, model, and architecture decision with rationale and alternatives. |
| `docs/implementation-plan.md` | **Phased build plan** (P0–P5) with workstreams, DoD, gates, risks, and next steps. |
| `docs/research/deep-research-report.md` | Cited state-of-the-art research backing each technical pillar (models, papers, alternatives, confidence levels, cost notes). |
| `ECC/` | ECC plugin folder — reusable skills/agents to leverage during development (see §7). |

> **Doc precedence (read in this order; on conflict, higher wins):**
> 1. `docs/vision/ideas-complete.md` — **what** GYF is (canonical product brief). `vision/drafts/*` are raw history.
> 2. `docs/engineering-doctrine.md` — **how** every pillar is built (binding design law: ports, license gate, foundation+adapter, real data, eval-gated).
> 3. `docs/tech-stack.md` — **which** model/tech per pillar + rationale. `docs/research/deep-research-report.md` — cited SOTA backing.
> 4. `docs/roadmap.md` — **the order** (dependency-correct build sequence M0→M12→P2–P5). `docs/implementation-plan.md` — phase detail + DoD. `docs/plans/*` — per-cycle execution specs.
> 5. `CLAUDE.md` (this file) — structured summary + operating rules. When it disagrees with a source doc, **the source doc wins — fix this file.** Keep all in lockstep (DRY: each fact lives in one doc; others reference it).

---

## 0.5 Current Status (2026-06-20)

**Done & verified:** P0 infra; P1-A perception & catalog; P1-B Cycle 1 manual onboarding (+ consent/erasure); P1-C Cycles 1–3 (cold-start outfit composition → online taste model + impression logging → NL styling-goal box); image serving + `/gallery`; **engineering doctrine adopted** + commercial-clean stack decided.

**The honest gap:** the **backend "brain" is strong; the product *surface* is not built** — `app/` is a **marketing landing page only** (no onboarding/recommendations/try-on UI). That UI is most of Stage 2 in `roadmap.md` and the bulk of remaining launch work.

**Next:** **M0** (model registry + CI license gate + import lint — `docs/plans/m0-license-gate.md`), then finish the brain (embeddings → photo body-type → skin-tone), then the product surface.

---

## 0.6 Development — environment & commands

> Toolchain: **Bun 1.1+** (JS workspaces), **uv** (Python/API, target **3.12**), **Docker** (local infra). Canonical interface is the **Makefile** — prefer it over ad-hoc commands.

```bash
make install     # JS workspaces + Python API deps (bun install; uv sync)
make up          # local infra: Postgres+pgvector, Redis, Redpanda (infra/docker-compose.yml)
make dev         # web (:3000) + API (:8000) together
make dev-api     # API only (uvicorn app.main:app --reload --port 8000)
make test        # all tests (API pytest + JS)
make lint        # ruff (Python) + JS lint
make fmt         # auto-format (Prettier + Ruff)
make ci          # full local gate: fmt-check + lint + typecheck + test  (run before pushing)
```

- **API surface (local):** `/health`, `/me`, `/metrics`, `/docs` (Swagger), `/gallery` (visual tester).
- **Live-DB verification** (real Postgres, no fakes — see Working Agreement): `bash scripts/e2e_workstream_a.sh` brings up Dockerized `pgvector/pgvector:pg16` on **:5433** (`GYF_DATABASE_URL=postgresql://postgres:postgres@localhost:5433/gyf`); tear down with `docker rm -f gyf-pg`.
- **ML model cache:** point `HF_HOME` at the repo-local `.hf-cache` (gitignored) — the default `~/.cache` may be unwritable.
- **Local-venv caveat:** a project-local `.venv` may be Python **3.9** (target is 3.12). The shared `packages/contracts` is 3.12-pinned and *not* pip-installed locally, so 3.9 runs need `PYTHONPATH` to include it and `eval_type_backport` installed for Pydantic to parse `X | None`. CI uses uv + 3.12 and needs neither. **Never use stubs/fakes to dodge a real run** (Working Agreement).

---

## 1. What GYF Is (the one thing to internalize)

**GYF is an AI-native personal stylist that learns what looks good on *you* and builds
complete, coordinated outfits you can trust — getting smarter with every person it dresses.**

It is **not** a search box over a clothing catalog. It is a **learning styling
intelligence**: it perceives clothes visually, models personal taste, and generates finished
looks (top + bottom + footwear) with a clear reason behind each.

- **The market sells items. GYF delivers outfits, confidence, and taste.**
- **AI-first from day one** — intelligence is the foundation, not a feature bolted on later.
- **Trust is the product** — every recommendation is explainable with honest confidence.

### The problem
A full closet yet "nothing to wear"; apps show items but never *how to wear them together*;
constant doubt (*does this match? right for the occasion? does it suit me?*); daily decision
fatigue. A personal stylist has always been a luxury — **GYF makes that intelligence
universal: free, instant, personal.**

### Why AI-first
Styling is a **perception + preference problem**: style is *visual* (must be seen, not
tagged), taste is *personal and learned* (from behavior, continuously), and good styling
*compounds* (better the more people it dresses). A rules engine can only approximate these.

### Mission
1. **Replace anxiety with confidence.**
2. **Truly understand *you*** (taste, body, budget, occasion).
3. **Be trustworthy, not just impressive** (explainable + honest confidence).
4. **Compound intelligence** — measurably better the more it's used, for the individual and everyone.

---

## 2. Complete Feature Set

### Identity & accounts
- Secure sign-up, login, sessions; profile, preferences, full account control (incl. data deletion); private, per-user data.

### Cold start & onboarding
- **Zero-friction cold start:** from the very first visit — before any history — GYF suggests what looks good and which clothes suit the user.
- **Two onboarding paths, never rigid:**
  - **Photo-based:** auto-deduce skin tone and body type from a photo.
  - **Manual:** user states skin tone, body type, preferred styling, budget range, occasion.
- Preferences (especially occasion) are **always editable**.

### Intelligent personalization
- Learns style intent, colors, occasions, budget, body context; continuously-updating taste model.
- Deepens with **every** interaction, not just onboarding.
- **Matures "like a fine wine"** — results increasingly suit the user's personality, body type, skin tone, budget, and occasion; they visibly look better over time.

### AI recommendations (the heart)
- **Complete outfit generation** — top + bottom + footwear coordinated as one look.
- A clear **stylist explanation** for **every** outfit.
- **Diverse, ranked** sets (never five near-identical results).
- An honest **confidence** signal per recommendation.
- Graceful handling when a category/item is unavailable.
- **Natural-language styling goals:** a text box where the user types *"I want to look taller / broader / slimmer"*; GYF applies **color theory + body-type intelligence** to pick garments, cuts, and colors that achieve the effect.
- **Occasion-aware:** user selects the occasion (**casual, formal, wedding, festive, …**); recommendations are conditioned on it.
- **Region- & culture-aware garments:** respects regional dress (e.g. India includes sarees; the USA does not). Catalog, taxonomy, and styling logic are localized.

### Visual style understanding
- Perceives garments from images: vibe, color harmony, texture, silhouette, formality.
- Matches/coordinates by *how things actually look*, not just labels.

### Feedback & continuous learning
- Save, cart, "not interested" on any look — with easy reversal.
- Detects and resolves conflicting signals.
- Every interaction feeds the model that improves the next recommendation.

### Personal collections
- Saved-items shortlist; saved styling sessions; a **wardrobe** of what you own (styles around your real closet); history of past recommendations.

### See-it-on-you (virtual try-on) — the complete designed look, on *you*
- **Not product flat-lays.** The user uploads a photo and sees the **complete outfit the stylist
  designed for them** rendered **on their own body**, with the **reason it suits them** + honest
  confidence — GYF as a mirror, not a catalog.
- **How** (authoritative detail in `tech-stack.md` §4.5 + `engineering-doctrine.md`): a swappable
  `TryOnRenderer` port; **use a licensed model at inference** for beta (no training data needed);
  **multi-garment photoreal** (top+bottom+footwear, footwear weakest) phased in; **own-it-later**
  on real **brand on-model photos** (no synthetic). Consented, ephemeral, erasable.

### Social & inspiration (LTK-inspired — [shopltk.com](https://www.shopltk.com/))
- A dedicated **Socials page** where posts live.
- **Interactive posts:** shareable, downloadable, reactable.
- **Style sharing & following:** users upload each other's styles; a user can follow someone's style and dress like them — but **re-rendered for the follower's own skin tone and preferences**, never blindly copied.

### Profile & gamification
- Professional profile page showing outfits made and liked.
- **Badges/perks** (e.g. *Fashion Mogger*, *Trendsetter*) earned through likes, shares, comments.

### Discovery & commerce
- Explore the catalog beyond direct recommendations.
- **Buy via redirect to the parent retailer's product page.**
- **Affiliate monetization** on surfaced articles.

### Trust & transparency
- Honest, user- and operator-facing reporting of what's live, what's experimental, and how confident the system is.

### Quality protection
- Continuous evaluation so recommendation quality **provably improves** rather than silently degrading.

---

## 3. Business Model & Moat

- **B2C product, B2B data engine.** GYF is a B2C consumer product; in parallel, its data is distilled into a separate model sold as a **B2B service** — a second revenue line.
- **Affiliate revenue** on articles surfaced and purchases driven.
- **A real moat:** unique, differentiating, **not copyable** — the compounding learning system, proprietary taste/behavioral data, and the distilled B2B model are central.

---

## 4. Data & Datasets (efficient, low-cost)

> **GYF trains on REAL data, not synthetic** (product direction, 2026-06-20). Three owned
> streams: **user-uploaded photos** (body-type/skin-tone, consented), the **brand/aggregator
> catalog** (garment images + attributes + on-model photos), and **first-party behaviour**.

- **Real user photos** — the body-type & skin-tone modules learn from consented uploads (real,
  diverse bodies/tones → fairness from reality, not simulation). Ephemeral + erasable.
- **Catalog** via brand/aggregator **product feeds** — garments, attributes, and **on-model
  photos** (the clean, real paired-data source for owning try-on later); free and current.
- **First-party behavioral data** (saves, skips, carts, reacts, shares, follows, try-ons) is the
  compounding proprietary asset and the source of the B2B model.
- **Open datasets** (DeepFashion(2), Fashionpedia, Polyvore, …) are used **only to bootstrap/
  pretrain** perception/compatibility offline — never served, never a substitute for real data.
- **Cost discipline:** prefer open *weights* + the real data we're given; label only what behavior
  can't supply; cache embeddings; spend scales with proven value.

> Full citations and alternatives: `research/deep-research-report.md` (Pillar 7).

---

## 5. Technology Stack (summary — details in `tech-stack.md`)

> Architecture: a modular monorepo splitting the **product surface** (web + API) from the
> **ML platform** (perception, taste, ranking, generation), communicating via versioned
> contracts and an event backbone so models evolve independently of the UI.

| Layer | Primary choice | Notes |
| --- | --- | --- |
| Frontend | **Next.js (App Router) + React 19 + TypeScript**, Tailwind + shadcn/ui, Framer Motion, tRPC | Production/professional UI from day one; accessible (WCAG 2.2); inspiration-first. |
| Backend | **Python 3.12 + FastAPI** (async); Next.js Route Handlers (BFF); gRPC + events | Same language as ML; typed contracts. |
| Data | **PostgreSQL 16** (free: Supabase/Neon) + **pgvector** → Qdrant → Milvus; Redis; **Kafka/Redpanda**; S3-compatible storage | Behavioral events are the learning backbone. |
| Auth | OIDC, JWT + refresh, WebAuthn passkeys 🔜 | Per-user private data; full deletion. |
| Serving | **NVIDIA Triton** (vision/diffusion), **vLLM** (LLM reasoning) 🔜 | GPU inference. |
| Infra | Docker + Kubernetes, GitHub Actions, Terraform, MLflow, OpenTelemetry + Prometheus + Grafana + Sentry | Free-tier first (see §7). |

### The ML platform (GYF's core differentiation)
**Perceive → Model user → Control → Compose & rank → Visualize → Learn.**

1. **Visual style understanding:** `Marqo-FashionSigLIP` (fashion-tuned embeddings, +57% MRR; open/free). Color harmony scored in **CIELAB/CAM16**.
2. **User modeling from a photo — TWO separate modules:**
   - **Body-type module** — monocular **SAM 3D Body (3DB) → MHR** (Apache-2.0, SMPL-free) + **Anny** calibration → measurements → body-type taxonomy. *(well-supported; SMPL/SMPL-X rejected as non-commercial-gated — see `docs/plans/p1b-cycle2-photo-body-type.md`)*
   - **Skin-tone module (separate, custom, fairness-gated) ⚠️** — face/skin segmentation → illumination-robust **CIELAB** tone → undertone palette; **must pass full-spectrum fairness eval** (e.g. Monk Skin Tone) before shipping; manual fallback always available. *(low-confidence; never block the product on it)*
3. **Controllable styling:** intent parser (light LLM/NLU) maps free text → visual-effect goal (`elongate`/`slim`/`broaden`); a **color-theory + body-type effects engine** turns goals into garment-attribute constraints that re-weight the ranker and feed explanations. Occasion + region/culture are first-class conditioning features.
4. **Personal taste & recommendation:** launch with **two-tower retrieval + transformer ranker**; content-based **cold start**; scale to **generative recommendation with Semantic IDs (TIGER/HSTU)**. Every rec ships a reason + calibrated confidence.
5. **Outfit composition & compatibility:** transformer-over-the-outfit-set (+ hypergraph GNN) compatibility scorer; constrained, **diverse (DPP/MMR)** ranked outfits honoring budget/occasion/body/tone/wardrobe.
6. **Generative virtual try-on (behind a `TryOnRenderer` port):** render the **complete designed outfit on the user's photo**. **Beta = use a licensed/hosted model at inference** (no training data needed; most open try-on weights are non-commercial). **Multi-garment** (top+bottom+footwear at once, footwear weakest) is the SOTA target — **MuGa-VTON / OmniDiT / DiT-VTON** — phased in. **Own-it-later** by training a permissive (MIT/Apache) architecture on **brand on-model photos** (real paired data; no synthetic).
7. **Continuous learning & quality:** event-sourced feedback → feature store → retraining; **offline metrics for candidate selection only**, promotion gated by **online A/B + interleaving + counterfactual/IPS**; drift monitoring, shadow deploys, auto-rollback. Never silently regress.

### Social, commerce, B2B
- Ranked social feed on the same taste/embedding stack; style-following re-rendered to the follower's tone; badge engine; "shop the look" → retailer redirect + affiliate attribution; moderation via VLM/policy classifiers.
- **B2B engine:** event lake → privacy-preserving aggregation (DP + k-anonymity 🔜) → trend/taste/demand features → distilled models served via a versioned partner API, strictly separated from PII.

---

## 6. Phased Rollout (matches the product arc)

| Phase | Ships |
| --- | --- |
| **1 — Intelligent stylist (launch)** | Onboarding (photo/manual, separate body + skin-tone modules), cold start, explained outfits, occasion + NL styling goals, region-aware garments, feedback loop, basic try-on (IDM-VTON), social posts, affiliate redirect. |
| **2 — Personal taste engine** | Wardrobe-aware styling, deeper personalization, context (weather/event/mood), badges; Semantic-ID generative recsys (beta). |
| **3 — Shopping companion** | Multi-retailer recommendations, smarter buying, richer commerce. |
| **4 — Visualization layer** | High-fidelity multi-garment on-body try-on (MuGa-VTON). |
| **5 — Ambient stylist + B2B** | Compounding collective intelligence (HSTU scale), B2B data product. |

---

## 7. Engineering & Operating Principles (non-negotiable)

### 7.0 The Engineering Doctrine (the highest-IQ way) — full text: `docs/engineering-doctrine.md`
**Thesis:** *models are commodities; the moat is real data + abstraction + evaluation.* Own the data and the contracts; rent the models; gate the licenses by machine; promote only what evaluation proves. Then the latest, cleanest, and best are the same choice.

**Five invariants (never traded, including for speed):** (1) quality never silently regresses (eval-gated); (2) nothing non-commercial reaches the serving path (CI license gate); (3) every user-facing output carries calibrated confidence + a human reason; (4) personal data is the user's (consent + erasure); (5) a working baseline always sits behind every capability port.

**Eight doctrines:** D1 capability ports (app code never imports a model) · D2 two-lane (research/production) lifecycle + CI license gate · D3 clean foundation + our-data adapter · D4 **real-data flywheel, no synthetic** (user photos + brand catalog + behaviour) · D5 eval-gated promotion (offline selects, online promotes) · D6 honest intelligence (confidence/reason/abstain) · D7 free-tier-first serving · D8 privacy & erasure by construction.

**Commercial-clean stack (SMPL & most try-on weights are non-commercial — avoid):** body-type = SAM 3D Body→MHR+Anny · perception = SigLIP 2 / Marqo-FashionSigLIP-2 · recsys = HSTU/OneRec (train on our events) · intent = Qwen 3.x · serving = vLLM/SGLang · try-on = licensed model at inference (beta) → own on brand on-model photos.

### 7.1 Standing principles
1. **AI-first.** Visual understanding + learned taste is the foundation.
2. **Always explainable.** Human-readable reason + honest confidence; never a black box.
3. **Learn continuously.** Real behavior is the most valuable asset — capture it cleanly.
4. **Personal and private.** Deep personalization; each user's data protected and theirs.
5. **Outfits, not items.** Always think in complete, coordinated looks.
6. **Quality must provably rise.** Evaluate continuously; never silently regress.
7. **Trust is the product.** Impressiveness without trust is failure.
8. **Inspiration-first frontend.** Frontend relies on backend endpoints; **production/professional standards from the start** — QoL features, high-end design patterns, high interactiveness and intuitiveness.
9. **Beta-ready, scale-ready.** Build for a handful of beta users, then scale — **no compromises, no hardcoded limitations**; keep future scaling in mind from day one.
10. **State-of-the-art, free, and latest.** Cutting-edge tech that is free and current, accounting for efficiency, optimization, and security.
11. **Best practices throughout.** Strong programming principles and design patterns.
12. **Genuine and usable.** Everything real, functional, genuinely usable — **no mockups masquerading as features**.
13. **Plan before build.** Detailed plan first; **nothing is implemented before the plan exists.**
14. **Research before choosing.** Research the full landscape before adopting any technology/technique; implement the best researched option.
15. **Free-tier first, cost-disciplined.** Use free tiers/options until scale forces a paid move (or there's genuinely no free path). Spend only when scale demands it.
16. **Leverage ECC skills.** Use relevant skills from the `ECC` folder whenever they apply.

### Free-tier deployment path (cost-disciplined)
- **$0 beta:** web on **Vercel / Cloudflare Workers**; DB+vectors on **Supabase / Neon** (free pgvector); GPU inference on **Hugging Face Spaces + ZeroGPU**.
- **Bridge to scale:** **Modal** ($30/mo credit) / **RunPod** for try-on bursts.
- **At scale:** dedicated GPU + Qdrant/Milvus, only when usage forces it.
- *Avoid for GPU:* Fly.io, Railway. (Quotas change — verify at signup.)

### Which ECC skills to use when
- **Planning:** `ecc:plan`, `ecc:plan-prd` (always plan before building).
- **Research:** `ecc:deep-research` before adopting a new technology.
- **Code review:** `react-reviewer`, `python-reviewer`, `typescript-reviewer`, `security-reviewer`.
- **ML:** `mle-reviewer`, `eval-harness`.
- **Frontend quality/a11y:** `accessibility`, `a11y-architect`, `frontend-design-direction`.
- **Architecture:** `architect`, `code-architect`.

---

## 8. Working Agreement for Agents

- **Read the source docs first** (`ideas-complete.md`, `tech-stack.md`, `research/deep-research-report.md`) before proposing or building anything.
- **Follow the engineering doctrine** (`docs/engineering-doctrine.md`) — it is binding for every ML pillar: consume capabilities through a **port** (never import a model in app code), keep a **research vs production lane** with a **CI license gate** so nothing non-commercial is served, prefer **clean foundation + our-data adapter** over non-commercial task weights, and **promote only through evaluation**. The five invariants are non-negotiable.
- **Plan before code.** Surface a plan; do not implement until it's agreed.
- **No mockups.** Ship genuinely functional work.
- **Default to free/open** tools and models; flag when a paid step is unavoidable.
- **Keep docs in lockstep.** When `ideas*.md` change, fold them into `ideas-complete.md`; reflect product changes in `tech-stack.md`; update this file's summaries. The source docs are authoritative.
- **Flag the known risks:** fair/robust **skin-tone** estimation (separate ⚠️ module) and the **offline→online metric gap** in recommendation (gate releases with online + counterfactual eval).
</content>
