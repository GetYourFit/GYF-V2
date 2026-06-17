# GYF — Phased Implementation Plan

> **What this document is.** The detailed, phased build plan for GYF. It turns the vision
> ([`vision/ideas-complete.md`](./vision/ideas-complete.md)), the stack
> ([`tech-stack.md`](./tech-stack.md)), and the research
> ([`research/deep-research-report.md`](./research/deep-research-report.md)) into an
> executable sequence of milestones, workstreams, and acceptance criteria.
>
> **Operating rules (from the brief).** Plan before build; research before choosing a
> technology; free-tier-first and cost-disciplined; no mockups (everything genuinely
> functional); quality must provably rise; leverage ECC skills. Each phase ends with a
> **gate** — it does not start the next phase until the gate's exit criteria are met.
>
> **How to use it.** Phases are sequential; workstreams within a phase run in parallel.
> "DoD" = Definition of Done. ⚠️ marks known-risk items (skin-tone fairness, offline→online
> metric gap) that get extra evaluation.

---

## 0. Phase Map

| Phase | Theme | Primary outcome | Gate |
| --- | --- | --- | --- |
| **P0** | Foundations | Repo, CI/CD, infra skeleton, contracts, data spine | Hello-world deploys green; event flows end-to-end |
| **P1** | Intelligent Stylist (launch) | Onboarding → explained outfits → feedback loop; basic try-on; social posts; affiliate redirect | Beta users get personalized, explained outfits; eval harness green |
| **P2** | Personal Taste Engine | Wardrobe-aware, context-aware, deeper personalization; generative recsys beta; badges | Taste model beats P1 baseline online |
| **P3** | Shopping Companion | Multi-retailer recs, smarter buying, richer commerce | Multi-retailer purchase funnel live |
| **P4** | Visualization Layer | High-fidelity multi-garment on-body try-on | Multi-garment try-on meets quality bar |
| **P5** | Ambient Stylist + B2B | Compounding collective intelligence; B2B data product | B2B API live; collective signal lifts per-user metrics |

---

## P0 — Foundations *(weeks 1–3)*

**Goal.** A thin, fully-deployed vertical slice and the data spine, so every later feature
plugs into a working system. No product features yet — just the rails.

### Workstreams
1. **Repo & standards.** Monorepo layout (`app/` web, `services/` API, `ml/` platform,
   `packages/` shared, `infra/`). Linting/formatting, commit conventions, PR templates,
   CODEOWNERS. *(ECC: `architect`, `code-architect`.)*
2. **CI/CD.** GitHub Actions: typecheck, lint, test, build, preview deploy. Trunk-based with
   short-lived branches. Required checks before merge.
3. **Infra skeleton (free-tier).** Web on Vercel/Cloudflare; Postgres+pgvector on
   Supabase/Neon; Redis; object storage; Kafka/Redpanda (or managed free tier) for events;
   secrets vault. IaC in `infra/` (Terraform).
4. **Contracts & data spine.** Core schema (users, profiles, items, outfits, interactions);
   event schema (save/skip/cart/react/share/follow/try-on); tRPC/OpenAPI scaffolding;
   auth scaffold (OIDC/JWT).
5. **Observability.** OpenTelemetry + metrics + Sentry from day one.

### DoD / Gate
- A signed-in user can hit a trivial endpoint through the BFF; an interaction event lands in
  the event log and is queryable in the lake.
- CI green; preview + production deploys automated; secrets never in repo (scanning on).
- Cost: **$0** on free tiers.

---

## P1 — The Intelligent Stylist *(launch; weeks 4–12)*

**Goal.** Deliver the core loop: **onboard → generate explained outfits → learn from
feedback**, plus first try-on, social posts, and affiliate redirect. This is the launchable
beta.

### Workstream A — Perception & catalog
- Ingest catalog via affiliate/retailer **product feeds**; normalize taxonomy (incl.
  **region/culture facet** — sarees, kurtas, etc.).
- Embed all items with **Marqo-FashionSigLIP**; store vectors (pgvector HNSW).
- Attribute/color extraction; **color harmony in CIELAB/CAM16**.
- Bootstrap training on open datasets (DeepFashion(2), Fashionpedia, Polyvore).
- **DoD:** every catalog item has embeddings + attributes; visual "similar items" works.

### Workstream B — User modeling (two separate modules)
- **Onboarding:** photo path + **always-available manual path**; occasion + budget + style
  intent capture; preferences editable.
- **Body-type module:** SMPL + measurement nets → body-type taxonomy.
- **⚠️ Skin-tone module (separate, fairness-gated):** CIELAB tone + undertone palette; must
  pass **full-spectrum fairness eval (Monk Skin Tone)** before shipping; manual fallback.
  *Ship behind a flag; do not block launch on it.*
- **DoD:** a new user completes onboarding either way; profile populated; fairness report
  produced for the skin-tone module.

### Workstream C — Recommendation & composition
- **Cold start:** content-based from onboarding + embeddings (works on first visit).
- **Taste model v1:** two-tower retrieval → transformer ranker over interactions.
- **Outfit composition:** transformer/GNN compatibility scorer; **diverse (DPP/MMR) ranked**
  complete outfits (top+bottom+footwear) honoring budget/occasion/body/tone/wardrobe.
- **Controllable styling:** NL goal box ("taller/slimmer/broader") → intent parser →
  color-theory/body-type effects engine → ranker constraints.
- **Explainability:** every outfit ships a reason + calibrated confidence.
- **DoD:** diverse, explained, occasion-appropriate outfits; NL goals visibly change results.

### Workstream D — Feedback & continuous learning
- Save/cart/"not interested" with easy reversal; conflicting-signal handling.
- Event → feature store → scheduled retraining loop.
- **Eval harness:** offline (NDCG/Recall/compat-AUC/ECE/diversity) for candidate selection;
  **⚠️ promotion gated by online A/B + interleaving + counterfactual/IPS** (offline alone
  never promotes). *(ECC: `eval-harness`, `mle-reviewer`.)*
- **DoD:** a model change can be evaluated and promoted/rejected through the harness.

### Workstream E — Try-on v1
- **IDM-VTON** single-look try-on; async job + progress; results cached; input/output safety
  filter. Serve on **HF ZeroGPU** (free) → Modal/RunPod for bursts.
- **DoD:** user uploads a photo and sees a realistic rendered look.

### Workstream F — Social, profile, commerce
- Socials page; posts shareable/downloadable/reactable; follow a style (re-rendered to the
  follower's tone). Profile (outfits made/liked); badge engine (Fashion Mogger, Trendsetter).
- "Shop the look" → **redirect to parent retailer page**; affiliate attribution events.
- Moderation (VLM/policy classifiers) on uploads/posts.
- **DoD:** a user can post, react, follow, earn a badge, and click through to buy with
  affiliate tracking.

### Workstream G — Frontend (inspiration-first, professional from day one)
- Production-grade UI (Next.js + Tailwind/shadcn + motion); WCAG 2.2 AA; optimistic UI for
  feedback; Core Web Vitals budget. *(ECC: `accessibility`, `frontend-design-direction`,
  `react-reviewer`.)*
- **DoD:** the full P1 loop is usable, polished, accessible, and fast.

### Phase Gate (P1 → P2)
- Beta cohort receives **personalized, explained, diverse** outfits with honest confidence.
- Try-on works; social + commerce + affiliate functional end-to-end.
- Eval harness operational; no silent regressions; skin-tone fairness report passed or
  feature flagged off.
- Still on free tiers except metered GPU bursts.

---

## P2 — The Personal Taste Engine *(weeks 13–22)*

**Goal.** Make picks feel uncannily *"you"* — wardrobe-aware, context-aware, maturing over
time — and pilot the generative recommender.

### Workstreams
1. **Wardrobe.** Users add owned items; styling composes around the real closet.
2. **Context.** Condition on weather/event/mood; richer occasion handling.
3. **Generative recsys (beta).** Semantic IDs (RQ-VAE) + sequence model (**TIGER**-style);
   shadow-test vs the two-tower+ranker baseline. *(ECC: `mle-reviewer`, `deep-research` for
   any new technique.)*
4. **Collective intelligence v1.** Cross-user patterns feed per-user ranking.
5. **Gamification depth.** More badges/perks; leaderboards.

### Gate (P2 → P3)
- Generative or improved taste model **beats P1 baseline online** (interleaving/A-B).
- Wardrobe-aware recs measurably increase engagement; "maturing taste" demonstrable.

---

## P3 — The Shopping Companion *(weeks 23–32)*

**Goal.** GYF shops *with* you across brands/retailers.

### Workstreams
1. **Multi-retailer integration.** More affiliate/product feeds; price/availability sync;
   dedupe across sources.
2. **Smart buying.** Recommend the highest-leverage items to *complete* the wardrobe within
   budget; gap analysis.
3. **Commerce depth.** Richer cart/purchase-intent funnel; reconciliation of affiliate
   conversions.
4. **Scale prep.** Move vectors to **Qdrant** as catalog/user growth demands; feature store
   hardening (Feast).

### Gate (P3 → P4)
- Multi-retailer recommendations + purchase funnel live; affiliate revenue attributed and
  reconciled. Scale headroom verified (load tests, no hardcoded limits).

---

## P4 — The Visualization Layer *(weeks 33–44)*

**Goal.** See any look realistically on yourself — **multi-garment** (top + bottom +
apparel together), high fidelity.

### Workstreams
1. **Multi-garment try-on.** Upgrade to **MuGa-VTON** (diffusion transformer); CatVTON as
   efficiency option; evaluate **Leffa/Voost**. *(ECC: `deep-research` to re-check SOTA at
   build time — this area moves fast.)*
2. **Serving optimization.** Distilled/few-step diffusion; latency + cost targets; queueing.
3. **Quality bar.** FID/LPIPS + human eval; identity/garment preservation thresholds.

### Gate (P4 → P5)
- Multi-garment, photo-realistic try-on meets the quality bar at acceptable latency/cost.

---

## P5 — The Ambient Stylist + B2B *(weeks 45+)*

**Goal.** Compounding collective intelligence and the B2B data product.

### Workstreams
1. **Scale the generative recommender.** Toward **HSTU**-scale; full collective→personal loop.
2. **B2B engine.** Event lake → **privacy-preserving** aggregation (DP + k-anonymity) →
   trend/taste/demand features → distilled models → **versioned partner API**, strictly PII-
   separated. *(ECC: `security-reviewer`, `database-reviewer`.)*
3. **Reliability & cost at scale.** Dedicated GPU, autoscaling, Milvus if billion-scale,
   SLOs.

### Gate
- B2B API live with at least one consumer; collective signal demonstrably lifts per-user
  metrics; platform meets reliability/cost SLOs.

---

## Cross-Cutting Workstreams (every phase)

- **Security & privacy.** OWASP Top 10 review, per-user data isolation, deletion, secret
  scanning, dependency audits. *(ECC: `security-reviewer`.)*
- **Quality protection.** Eval harness gates every model release; drift monitoring; shadow
  deploys; auto-rollback. **Offline never promotes alone.**
- **Cost discipline.** Free-tier first; graduate to paid only when scale forces it; track
  spend per workstream.
- **Docs in lockstep.** Update `ideas-complete.md` / `tech-stack.md` / this plan as reality
  changes; keep `CLAUDE.md` summaries current.
- **Research before adopting.** Run `ecc:deep-research` before any new technology/technique;
  record the decision and alternatives.

---

## Known Risks & Mitigations

| Risk | Mitigation |
| --- | --- |
| ⚠️ **Skin-tone fairness/robustness** | Separate module; full-spectrum eval gate; manual fallback; never blocks launch. |
| ⚠️ **Offline→online metric gap** | Promote only via online A/B + interleaving + counterfactual/IPS. |
| **Try-on cost/latency** | Distilled diffusion, free GPU quotas → metered bursts → dedicated only at scale. |
| **Cold-start quality** | Content-based bootstrap from onboarding + embeddings, validated before launch. |
| **Catalog/data licensing** | Use affiliate/retailer feeds + open datasets; track provenance. |
| **Vendor free-tier changes** | Abstract providers; keep IaC portable; verify quotas regularly. |

---

## Immediate Next Steps (start of P0)

1. Confirm monorepo tool (Turborepo/Nx) and package manager; scaffold `app/`, `services/`,
   `ml/`, `infra/`, `packages/`.
2. Stand up CI (typecheck/lint/test/build/preview) with required checks.
3. Provision free-tier infra (Supabase/Neon + pgvector, object storage, event stream) via
   Terraform; wire secrets vault.
4. Define core + event schemas and the tRPC/OpenAPI contract; auth scaffold.
5. Prove the vertical slice + event spine (P0 gate).

> **Run `ecc:plan` / `ecc:plan-prd` per phase** to expand each workstream into concrete tasks
> before building, and the relevant reviewer skills on every PR.
</content>
