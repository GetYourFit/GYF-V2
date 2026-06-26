# GYF Launch Plan — Loop Engineering to a Production-Grade Stylist

> **Status:** proposed (2026-06-27). Supersedes nothing — it *operationalizes* `docs/roadmap.md`
> and `docs/engineering-doctrine.md` into an execution method and a launch-scoped sequence.
> **Source of truth still wins:** vision = `docs/vision/ideas-complete.md`; law = `docs/engineering-doctrine.md`;
> tech = `docs/tech-stack.md`; order = `docs/roadmap.md`. This doc is *how we drive them to launch*.

## 0. Decisions locked (2026-06-27, from `docs/feedbacks/gyf-feedback-v2.md`)

| Decision | Choice | Consequence |
| --- | --- | --- |
| Launch scope | **Core stylist loop, perfected** | Auth + onboarding (manual **and** photo) + explained outfit recs + feedback learning + real catalog + genuinely top-tier UI. **Try-on & social are fast-follow.** |
| Deploy target | **Kubernetes (scale-out)** | Docker images → Helm/K8s on a Linux cloud. Built for real traffic, autoscaling, zero-downtime, rollback. (Cost note in §8.) |
| Catalog data | **Both** | Expand the open fashion dataset now (free, immediate) **and** stand up a real affiliate/brand-feed ingestion pipeline in parallel. |
| Try-on | **Free/open weights, deferred** | ⚠️ Most free/open VTON weights are **non-commercial** → violates doctrine invariant #2. Build the `TryOnRenderer` port now; choose permissive weights / own-on-brand-photos when we ship it post-launch. |
| Dev vs deploy runtime | **Apple `container` for local dev (this Mac), Docker for Linux/K8s** | Same `Dockerfile`s serve both. Already ported (`infra/container-stack.sh`). |

## 1. What "loop engineering" means for GYF

Loop engineering = **never ship by assertion; ship by passing a gate.** Every unit of work is a
bounded loop: *specify a rubric → generate an implementation → evaluate against the rubric
(automated + visual + adversarial) → review → gate → promote or iterate.* This is exactly the
doctrine's **eval-gated promotion (D5)** and **milestone-done discipline**, made the default
operating rhythm at three nested tiers:

- **Macro loop — milestone → DoD gate.** A workstream is "done" only when its Definition of Done
  passes end-to-end (happy **and** failure paths), per `roadmap.md`. No advancing on a half-built milestone.
- **Meso loop — per-feature generate↔evaluate (GAN).** A *generator* implements to spec; an
  *evaluator* tests the running result against a rubric and feeds back; iterate until the score
  clears threshold. ECC harness: `ecc:gan-build` (functional), `ecc:gan-design` (UI/visual),
  `ecc:santa-loop` (two independent reviewers must both approve).
- **Micro loop — per-change TDD + reviewers + CI.** Write the test/contract first, implement,
  run the language reviewer (`python-reviewer`, `react-reviewer`, `typescript-reviewer`,
  `fastapi-reviewer`, `mle-reviewer`) and `security-reviewer`, pass `make ci`.

**Invariants that gate every loop (from the doctrine — never traded for speed):**
1. quality never silently regresses (eval-gated); 2. nothing non-commercial in the serving path
(CI license gate); 3. every user-facing output carries calibrated confidence + a human reason;
4. personal data is the user's (consent + erasure); 5. a working baseline sits behind every port.

## 2. Honest current state (to be sharpened by Loop 0)

- **Brain strong, surface weak.** Backend (perception, catalog, taste, retrieval, flywheel) is real
  and verified; the frontend is "bricks, not the product," many pages mediocre/non-functional.
- **Structure:** the git-tracked tree is reasonable (`app/ services/ ml/ packages/ docs/`), but the
  working dir is cluttered by **gitignored caches** (`.bun-cache`, `.hf-cache`, `.turbo`, `.uv-cache`,
  `scratchpad_bakeoff.log`, `.DS_Store`) and some genuinely dead code. Both are real cleanup work.
- **Deployment:** the live site has production errors and weak UI/UX.
- **Local infra:** ported to Apple `container` + verified (see `infra/container-stack.sh`).

## 3. Launch Definition of Done (the bar we gate against)

A real person can: sign up securely → onboard (manual **or** photo: skin tone + body type) →
receive **diverse, ranked, complete outfits** (top+bottom+footwear) each with a **reason +
calibrated confidence** → give feedback (save/skip/cart) → see recommendations **measurably
personalize** → on a **polished, fast, accessible, aesthetic** UI → backed by a **real, expanded
catalog** → running on **K8s under load** with **observability, security hardening, and rollback**,
and **no broken pages, no console errors, no security holes.**

## 4. Workstreams (each is a loop with its own rubric + gate)

- **W0 — Repo hygiene & structure map.** Purge tracked junk; tighten `.gitignore`; dead-code audit
  (`ecc:refactor-clean`, `knip`/`ts-prune`/`ruff`); generate a codemap (`ecc:update-codemaps`);
  bring docs into lockstep. *Gate:* clean `git status`, zero dead exports, a one-screen structure map.
- **W1 — Foundation hardening.** Typed config, structured logging, error taxonomy + graceful
  degradation, OpenTelemetry traces/metrics, request validation, health/readiness. *Gate:* no
  unhandled paths; `silent-failure-hunter` clean; tracing visible.
- **W2 — Data & catalog (real + expanded).** (a) Scale the open fashion dataset to a launch-sized,
  de-duped, attribute-rich catalog; (b) build an **affiliate/brand feed ingestion** pipeline
  (provider TBD — see §9) with buy-link + attribution; (c) perception backfill at scale; (d) **M2
  embedding promotion** through the bake-off gate. *Gate:* N≥ target items with embeddings + images
  + valid buy links; retrieval MRR/Recall ≥ baseline.
- **W3 — Photo onboarding (productionized).** Body-type (SAM 3D Body→MHR+Anny) + **skin-tone
  (fairness-gated ⚠️)** behind capability ports; consent + ephemeral + erasure. *Gate:* skin-tone
  passes the full-spectrum fairness eval **or** stays shadowed with manual fallback; never blocks product.
- **W4 — Recommendation quality.** Two-tower retrieval + transformer ranker, content cold-start,
  **DPP/MMR diversity**, calibrated confidence, NL styling-goal + occasion + region conditioning,
  human-readable reasons. *Gate:* offline metrics for selection + **online/counterfactual** harness
  wired; every rec ships reason + confidence; no near-duplicate result sets.
- **W5 — Frontend rebuilt to top-tier.** Design system + tokens, motion, the full core-loop flows
  (onboarding, rec surface, wardrobe, saved, feedback, profile), WCAG 2.2 a11y, Core Web Vitals
  budget, zero console errors. Driven by **`ecc:gan-design`** against an explicit aesthetic rubric
  + `frontend-design-direction` / `a11y-architect`. *Gate:* design rubric ≥ threshold, Lighthouse
  ≥ target, every page functional against real endpoints, no mockups. **Detailed spec + design
  language:** `docs/plans/frontend-rebuild.md` (clean black-and-white industrial, matching
  getyourfit.tech) — the page-by-page audit + rebuild plan W5 executes; reconcile with Loop 0.
- **W6 — Security (continuous, hard gate before deploy).** AuthN/Z, Supabase RLS, secret hygiene,
  input validation, rate limiting, SSRF/injection/OWASP Top 10, dependency CVEs, abuse/erasure
  paths. Run `ecc:security-review` + `security-reviewer` subagent + `ecc:security-scan` on the
  agent/hook surface. *Gate:* zero high/critical findings; "no walls that can be broken."
- **W7 — Kubernetes deployment.** Multi-stage production Docker images (distinct from the dev
  Dockerfiles), Helm charts, ingress + TLS, HPA autoscaling, secrets/config, managed Postgres+pgvector
  + Redis + object storage + a GPU lane for perception/onboarding, CI/CD with preview→prod promotion,
  blue-green / rolling + auto-rollback, dashboards + alerts. *Gate:* load test passes SLOs;
  zero-downtime deploy + rollback proven; no prod console/network errors.
- **W8 — Eval & quality harness (cross-cutting).** Offline (retrieval/compatibility), online
  (A/B + interleaving + IPS), and **visual/E2E** (`ecc:e2e-runner`) gates run in CI; drift +
  shadow + rollback. This is the connective tissue that makes every other loop gateable.

## 5. Dependency-correct sequence (the macro loop)

```
Loop 0  W0 hygiene + grounded audit (codebase, frontend pages, security baseline)
   │
   ▼
W1 foundation hardening ──► W8 eval harness scaffold (parallel, cross-cutting)
   │
   ├─► W2 data & catalog ─┐
   ├─► W3 photo onboarding ┤ (parallel; both feed W4)
   │                       ▼
   └─────────────────────► W4 recommendation quality
                               │  (contracts freeze here)
                               ▼
                           W5 frontend rebuild  ◄── runs against frozen contracts + W8 visual gate
                               │
                               ▼
                           W6 security hardening (continuous, **hard gate**)
                               │
                               ▼
                           W7 Kubernetes deploy ──► LAUNCH (load + rollback proven)
```

## 6. Loop mechanics — how each workstream runs

For every workstream we define and commit, before coding:
1. **Rubric** — measurable acceptance criteria (the gate).
2. **Generator** — the implementing agent/skill (e.g. `ecc:orch-add-feature`, `ecc:gan-generator`).
3. **Evaluator** — independent check (tests + `ecc:gan-evaluator` + reviewer subagent + E2E).
4. **Gate** — pass/iterate decision; **promote only on pass** (D5). Failures loop back, bounded.
5. **Artifacts** — eval report (`eval-reports/`), codemap delta, updated docs (lockstep), memory note.
6. **Exit** — DoD met on happy **and** failure paths; `make ci` green; reviewers approve.

## 7. Subagents & ECC skills per workstream

| Workstream | Primary agents / skills |
| --- | --- |
| W0 | `ecc:refactor-clean`, `ecc:update-codemaps`, `Explore`, `code-explorer` |
| W1 | `architect`, `fastapi-reviewer`, `silent-failure-hunter`, `ecc:error-handling` |
| W2 | `mle-reviewer`, `database-reviewer`, `ecc:recsys-pipeline-architect`, `ecc:deep-research` (feed providers) |
| W3 | `mle-reviewer`, `ecc:healthcare-eval-harness` patterns for fairness, `security-reviewer` (PII) |
| W4 | `mle-reviewer`, `ecc:recsys-pipeline-architect`, `eval-harness` |
| W5 | `ecc:gan-design`, `frontend-design-direction`, `a11y-architect`, `react-reviewer`, `web-perf` |
| W6 | `ecc:security-review`, `security-reviewer`, `ecc:security-scan`, `database-reviewer` (RLS) |
| W7 | `ecc:architect`, `ecc:kubernetes-patterns`, `ecc:deployment-patterns`, `vercel:deployment-expert` (if hybrid) |
| W8 | `ecc:eval-harness`, `ecc:e2e-runner`, `pr-test-analyzer` |

## 8. Risks & honest flags

- **Try-on license (invariant #2).** Free/open VTON weights are largely non-commercial. Deferred to
  post-launch; will use permissive weights or own-on-brand-photos. Tracked, not silently shipped.
- **K8s vs free-tier-first (principle #15).** You chose scale-out K8s; that has real monthly cost
  (cluster + GPU lane). I'll pick the **most cost-efficient** path that still meets "handle traffic"
  (e.g. a small managed cluster + scale-to-zero GPU) and surface the bill before provisioning.
- **Skin-tone fairness (⚠️).** Never blocks the product; ships only past the fairness gate, else stays
  shadowed behind the manual path.
- **Offline→online gap.** Recsys gated by online/counterfactual eval, not offline metrics alone.
- **Affiliate provider dependency.** Real buy-links need a provider/account (see §9).

## 9. Open clarifications (needed *before* the named workstream executes — not blocking the plan)

1. **K8s provider + monthly budget ceiling** (GKE/EKS/DO/Hetzner+k3s?) — gates **W7**.
2. **Affiliate/brand feed provider** (which network/retailer + do you have API access?) — gates **W2(b)**.
3. **Design language** — any reference brands/aesthetic you want GYF to evoke, or trust the
   `frontend-design-direction` proposal? — shapes **W5**.
4. **Catalog target size & region(s)** for launch (e.g. ~5–10k items, US + India per vision?) — shapes **W2**.

## 10. Immediate next step (Loop 0)

On approval: run the **grounded audit** (codebase dead-code map + frontend page-by-page state +
security baseline) via read-only subagents, execute **W0 hygiene**, and return a sharpened W1–W8
backlog with concrete file-level findings and per-loop rubrics. Everything verified before moving on.
