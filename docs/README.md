# GYF documentation map

Status: **INDEX**. This file connects every maintained project document. It creates no execution
authority; [`plans/active-execution-contract.md`](./plans/active-execution-contract.md) is the only
source of execution order and gates.

## Authority chain

1. [`vision/ideas-complete.md`](./vision/ideas-complete.md) — product mission, users and complete capability intent.
2. [`engineering-doctrine.md`](./engineering-doctrine.md) — binding security, privacy, model, evaluation and cost invariants.
3. [`plans/active-execution-contract.md`](./plans/active-execution-contract.md) — sole F0–F13 order, current truth and promotion gates.
4. [`plans/gyf-launch-refactor-plan.md`](./plans/gyf-launch-refactor-plan.md) — subordinate implementation packets and Expo parity/cutover board.
5. [`tech-stack.md`](./tech-stack.md) and research — options and evidence; never authority to promote.

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
| Social creation, following and recreation | Vision; feedback v2/v4–v6 | Expo parity and F11 journeys |
| Free owned virtual try-on | [`plans/free-vton-moat.md`](./plans/free-vton-moat.md) | F8 durable spine, F9 promotion, cost/privacy kill switches |
| Consented learning moat | [`plans/ml-data-flywheel.md`](./plans/ml-data-flywheel.md) | F3, F5–F7, F12 |
| Premium, unique, accessible Expo UI | Feedback v2–v6; launch/refactor plan | Expo vertical slices, accessibility/device proof, F11 |
| Production CI/CD, preview and rollback | Deploy runbooks; doctrine | Every slice, F10, F11 |
| Hosting + GPU below ₹3,000/month | [`plans/scale-3k-inr.md`](./plans/scale-3k-inr.md) | F2.5, F8–F12; measured provider scorecard |
| Lean repository; remove fake/stale/duplicate work | Feedback v2/v5/v6; doctrine | Replace-then-delete and F13 protected deletion |

## Maintained evidence and runbooks

- Research: [`research/deep-research-report.md`](./research/deep-research-report.md),
  [`research/encoder-eval-alignment-2026-07-13.md`](./research/encoder-eval-alignment-2026-07-13.md),
  [`research/signup-first-outfit-study.md`](./research/signup-first-outfit-study.md) with
  [`research/signup-first-outfit-study.csv`](./research/signup-first-outfit-study.csv), and the
  photo study linked above.
- Deployment: [`deploy/free-deploy-checklist.md`](./deploy/free-deploy-checklist.md) and
  [`deploy/gpu-lane.md`](./deploy/gpu-lane.md).
- Historical user evidence: [`feedbacks/gyf-feedback-v1.md`](./feedbacks/gyf-feedback-v1.md),
  [`feedbacks/gyf-feedback-v2.md`](./feedbacks/gyf-feedback-v2.md),
  [`feedbacks/gyf-feedback-v3-design.md`](./feedbacks/gyf-feedback-v3-design.md),
  [`feedbacks/gyf-feedback-v4.md`](./feedbacks/gyf-feedback-v4.md),
  [`feedbacks/gyf-feedback-v5.md`](./feedbacks/gyf-feedback-v5.md),
  [`feedbacks/gyf-feedback-v6.md`](./feedbacks/gyf-feedback-v6.md),
  [`feedbacks/gyf-agent-eval-2026-07-10.md`](./feedbacks/gyf-agent-eval-2026-07-10.md), and
  [`feedbacks/gyf-v6-response-audit.md`](./feedbacks/gyf-v6-response-audit.md). These preserve
  observations; their old fixes/provider advice is not current authority.

Every maintained document is listed here. `scripts/check_doc_alignment.py` fails when a project
document is orphaned, a local Markdown link breaks, or a competing plan lacks a subordinate or
historical status.
