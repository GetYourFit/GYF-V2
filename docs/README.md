# GYF documentation map

Status: **INDEX**. This file connects every maintained project document. It creates no execution
authority; [`plans/active-execution-contract.md`](./plans/active-execution-contract.md) is the only
source of execution order and gates.

## Authority chain

1. [`vision/ideas-complete.md`](./vision/ideas-complete.md) — product mission, users and complete capability intent.
2. [`engineering-doctrine.md`](./engineering-doctrine.md) — binding security, privacy, model, evaluation and cost invariants.
3. [`plans/active-execution-contract.md`](./plans/active-execution-contract.md) — sole F0–F13 order, current truth and promotion gates.
4. [`plans/gyf-launch-refactor-plan.md`](./plans/gyf-launch-refactor-plan.md) — subordinate implementation packets and Expo parity/cutover board.
5. [`plans/expo-industrial-frontend-design.md`](./plans/expo-industrial-frontend-design.md) and
   [`plans/expo-industrial-frontend-implementation.md`](./plans/expo-industrial-frontend-implementation.md) —
   subordinate Expo design proposals; active-contract slices and gates remain authoritative.
6. [`superpowers/specs/2026-07-18-cosmos-editorial-expo-design.md`](./superpowers/specs/2026-07-18-cosmos-editorial-expo-design.md)
   and [`superpowers/plans/2026-07-18-cosmos-editorial-expo-implementation.md`](./superpowers/plans/2026-07-18-cosmos-editorial-expo-implementation.md) —
   approved Cosmos Editorial specification and subordinate phased implementation plan.
7. [`superpowers/specs/2026-07-19-design-first-evidence-sequencing.md`](./superpowers/specs/2026-07-19-design-first-evidence-sequencing.md) —
   approved owner amendment design for completing automated design work before deferred physical Android acceptance.
8. [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) — evidence-only historical implementation map.
9. [`tech-stack.md`](./tech-stack.md) and research — options and evidence; never authority to promote.

## Retained owner-input sources

- [`../ScopeofIdea.md`](../ScopeofIdea.md) — non-authoritative owner design input, folded into the
  canonical vision and mapped to the active contract; retained as evidence until F13 review.
- [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) — non-executable historical proposal derived
  from that input; superseded by the active contract and retained until F13 review.
- [`superpowers/specs/2026-07-18-cosmos-editorial-expo-design.md`](./superpowers/specs/2026-07-18-cosmos-editorial-expo-design.md)
  and [`superpowers/plans/2026-07-18-cosmos-editorial-expo-implementation.md`](./superpowers/plans/2026-07-18-cosmos-editorial-expo-implementation.md)
  — approved design input and subordinate implementation detail for the current contract packet;
  they do not change its pointer, write set, or promotion gates.

## Requirement traceability

| Requirement | Product/evidence source | Execution owner and gate |
| --- | --- | --- |
| Free product; no paywall | Vision; owner amendment in active contract | F0 contract, all phases; billing remains absent |
| Secure identity, recovery and sessions | Vision; doctrine D8 | F1c, F2, F10, F11 |
| Consent, export, erasure and isolation | Vision; doctrine D8 | F2, F3, F8, F10–F11 |
| Manual onboarding remains truthful | Vision; feedback v2/v4/v5 | F1b, Expo onboarding parity |
| Photo/body/skin assistance is editable and fair | [`research/photo-evaluation-study.md`](./research/photo-evaluation-study.md); feedback v2/v4/v5 | F1b, F7; closed until fairness/privacy gates pass |
| Personal, explainable complete outfits | Vision; feedback v4–v6 | F3–F7; deterministic fallback and abstention always remain |
| Fast, deep, non-repeating catalogue | Feedback v5/v6; [`plans/scale-3k-inr.md`](./plans/scale-3k-inr.md) | F2.5 SLO, F4 truth, F5 retrieval evaluation |
| Real prices, availability, rights and attribution | Vision; doctrine D2 | F4 and F10 |
| Intelligent owned wardrobe | Vision; feedback v4/v5 | Expo parity, F5, F11 |
| Saved looks and collections | Vision | Expo parity; merge/delete duplicate surface only at F13 |
| Social creation, following, recreation, sharing/download and reactions | Vision; feedback v2/v4–v6 | Sequential hard-launch slice after the retained-core gate |
| UGC/generative safety and responsive moderation | Store policies; launch/refactor security floor | EXPO-09/10, F10–F11 report/block/triage/disable evidence |
| Free virtual try-on with owned-model independence | [`plans/free-vton-moat.md`](./plans/free-vton-moat.md) | F8 FASHN + owned challenger, F9 promotion, cost/privacy kill switches |
| Consented learning moat | [`plans/ml-data-flywheel.md`](./plans/ml-data-flywheel.md) | F3, F5–F7, F12 |
| Premium, curved, responsive, light/dark, animated Expo UI | Feedback v2–v6; launch/refactor plan | Expo vertical slices, visual/a11y/device proof, F11 |
| Production CI/CD, preview and rollback | Deploy runbooks; doctrine | Every slice, F10, F11 |
| Native store policy, signing and privacy declarations | Official Apple/Play requirements; launch/refactor plan | EXPO-11, F10–F11 staged release gate |
| Hosting + GPU below ₹3,000/month | [`plans/scale-3k-inr.md`](./plans/scale-3k-inr.md) | F2.5, F8–F12; measured provider scorecard |
| Lean repository; remove fake/stale/duplicate work | Feedback v2/v5/v6; doctrine | Replace-then-delete and F13 protected deletion |

## Maintained evidence and runbooks

- Expo Design Core: [`plans/expo-design-core-evidence-2026-07-18.md`](./plans/expo-design-core-evidence-2026-07-18.md) —
  current automated evidence and the outstanding physical Android hold.
- Research: [`research/deep-research-report.md`](./research/deep-research-report.md),
  [`research/encoder-eval-alignment-2026-07-13.md`](./research/encoder-eval-alignment-2026-07-13.md),
  [`research/signup-first-outfit-study.md`](./research/signup-first-outfit-study.md) with
  [`research/signup-first-outfit-study.csv`](./research/signup-first-outfit-study.csv), and the
  photo study linked above.
- Cuelinks commerce proof: [`evidence/cuelinks-shop-flow-readiness-2026-07-22.md`](./evidence/cuelinks-shop-flow-readiness-2026-07-22.md) —
  implementation evidence and external redirect proof for product-level Cuelinks shop handoff; it
  does not promote a launch gate.
- Cuelinks product ingestion seam: [`evidence/cuelinks-product-ingestion-2026-07-22.md`](./evidence/cuelinks-product-ingestion-2026-07-22.md) —
  fixture-backed Deeplink=Yes/No campaign/product-feed import evidence and the exact live-credential blocker.
- Deployment: [`deploy/free-deploy-checklist.md`](./deploy/free-deploy-checklist.md) (superseded
  historical preview runbook retained until F13) and [`deploy/gpu-lane.md`](./deploy/gpu-lane.md).
- Historical user evidence: [`feedbacks/gyf-feedback-v1.md`](./feedbacks/gyf-feedback-v1.md),
  [`feedbacks/gyf-feedback-v2.md`](./feedbacks/gyf-feedback-v2.md),
  [`feedbacks/gyf-feedback-v3-design.md`](./feedbacks/gyf-feedback-v3-design.md),
  [`feedbacks/gyf-feedback-v4.md`](./feedbacks/gyf-feedback-v4.md),
  [`feedbacks/gyf-feedback-v5.md`](./feedbacks/gyf-feedback-v5.md),
  [`feedbacks/gyf-feedback-v6.md`](./feedbacks/gyf-feedback-v6.md),
  [`feedbacks/gyf-feedback-v7.md`](./feedbacks/gyf-feedback-v7.md),
  [`feedbacks/gyf-agent-eval-2026-07-10.md`](./feedbacks/gyf-agent-eval-2026-07-10.md), and
  [`feedbacks/gyf-v6-response-audit.md`](./feedbacks/gyf-v6-response-audit.md). These preserve
  observations; their old fixes/provider advice is not current authority.

Every maintained document is listed here. `scripts/check_doc_alignment.py` fails when a project
document is orphaned, a local Markdown link breaks, or a competing plan lacks a subordinate or
historical status.
