# GYF active execution contract

Status: **ACTIVE** · owner-authorised 2026-07-14 (amended same day, twice: try-on subscription, then try-on free lane) · application baseline `eb800965beeb5835c35bd8b8a269589f407e58f9`

This is the single source of truth for execution order. Product intent remains in `docs/vision/ideas-complete.md`; non-negotiable engineering rules remain in `docs/engineering-doctrine.md`; the July master plan and older plans are evidence only.

## Binding decisions

- GYF delivers meaningful, explainable outfit decisions from real catalogue facts, user control and consented learning.
- Every surface is free, **including virtual try-on** (owner amendment 2026-07-14, second same-day amendment — supersedes the morning subscription decision). Try-on runs on GYF-trained, GYF-owned weights (owner decision 2026-07-14): fine-tune the MIT Leffa architecture on GYF's own catalogue pairs, serve on ZeroGPU or a rented scale-to-zero GPU — detail in [`free-vton-moat.md`](./free-vton-moat.md). GPU cost stays controlled by transparent per-user quotas and the global kill switch; quality is never a price lever and there is only one quality lane. [`tryon-subscription-monetization.md`](./tryon-subscription-monetization.md) is parked evidence; it reactivates only if F12's reconciled cost exceeds the owner-approved ceiling.
- Payment work is **cancelled again** (nothing was built; the Razorpay/`BillingProvider` spine stays unbuilt). Paid ranking, paid recommendations and any paywall remain cancelled; a billing rail returns only through a future owner amendment.
- Preserve the deterministic recommendation path when optional ML or GPU services fail.
- Promote a model after commercial permission, privacy and security checks pass. Owner amendment 2026-07-14: incumbent-preservation, quality-parity and migration-parity requirements are relaxed — a licensed, secure replacement may ship directly; rollback stays available via the port.
- Learned challengers train on GYF's own data and iterate until they measurably beat the production incumbent on the frozen evaluation, then the shadow and cohort gates; promotion happens only on that measured win, and the deterministic incumbent always remains the fallback.
- Provider, migration and ₹2,000 budget proposals in older plans are hypotheses until measured; no provider is selected merely by a planning estimate.
- Replace-then-delete (owner amendment 2026-07-14): when a gated replacement ships, the implementation it replaces is deleted in the same slice, after that phase gate passes. Everything else obsolete or duplicate is deleted only in F13, after behaviour is protected or explicitly rejected. Do not replace deleted code with speculative abstractions.
- Budget ceiling (owner amendment 2026-07-14, evening): total hosting + GPU spend stays **under ₹3,000/month**, India-effective services preferred; the researched serving/performance spec is [`scale-3k-inr.md`](./scale-3k-inr.md). Rewrite-when-better: existing code may be rewritten where the replacement is measurably better (debuggability, maintainability, security, speed) — with before/after evidence, never by assertion.

## Reproducible baseline

`eb800965beeb5835c35bd8b8a269589f407e58f9` is the exact application-code comparison baseline. This owner-authorised contract is execution authority; the commit that records F0 documentation does not change that application baseline. Working-tree application changes are not baseline evidence.

Recorded 2026-07-14 evidence: 55 frontend tests passed in 14 files; 346 API tests passed with 4 skipped; 83 ML tests had previously passed; frontend typecheck, lint and production build passed. These historical results do not replace a fresh phase verification.

Every application phase runs:

```bash
make fmt-check
make lint
make typecheck
make doctrine
make test
bun run build
```

Every skip and failure must be reported. A phase cannot promote with an unexplained data/identity/object mismatch, cross-user access, missing export/deletion/restore evidence, unlicensed dependency, false user-facing claim, critical journey/accessibility/slice regression, unbounded retry/concurrency/GPU spend, cost above the owner-approved ceiling, or no tested fallback and rollback.

## Execution order

1. **F0 — Contract and baseline.** Documentation only. Complete when this file and document statuses agree.
2. **F1 — Destructive correctness**, completed in order:
   - **F1a:** preserve omitted profile fields on partial updates at the shared API/domain boundary.
   - **F1b:** make filters, confidence labels and sensitive-upload capability checks truthful.
   - **F1c:** add password recovery and an exact deployed authenticated-session integration check.
   - **F1 gate:** all three slices and the full verification set pass. **F2 cannot begin before this gate.**
3. **F2 — Privacy and isolation.** Consent, export, deletion, session revocation, private storage and least-privilege database ownership/RLS.
4. **F2.5 — Performance floor** (owner amendment 2026-07-14): kill the cold-GPU search path (query-embedding cache + nightly warm + scale-to-zero miss lane), move the API to always-on Singapore, and prove the SLOs in [`scale-3k-inr.md`](./scale-3k-inr.md) §2 with before/after measurements from an Indian vantage. No other reordering; F3 follows.
4. **F3 — Learning-event truth.** Real exposures/outcomes, deterministic IDs, consent/deletion and exact delayed-outcome joins before training.
5. **F4 — Catalogue truth.** Rights, price/currency, availability, freshness, removal reconciliation and purchasable outputs.
6. **F5 — Free recommendation incumbent.** Keep SigLIP 2/pgvector/rules/MMR; add anchored refinement and multi-interest context only when evaluation proves value.
7. **F6 — Small learned challenger.** Minimum pairwise/logistic ranker through offline, shadow, cohort and rollback gates.
8. **F7 — Colour and photo assistance.** Manual truth plus evaluated, correctable assistance with separate consent and deletion.
9. **F8 — Durable free try-on.** Reuse `TryOnRenderer`; private Postgres jobs, bounded retries, cancellation, TTL deletion, per-user quotas and the global cost kill switch. Build the owned lane per [`free-vton-moat.md`](./free-vton-moat.md): catalogue pairing/preprocessing pipeline with every preprocessing model through the license gate, LoRA fine-tune of the MIT Leffa architecture on GYF pairs (Kaggle free quota, or a rented GPU burst inside the owner ceiling), then ZeroGPU or rented scale-to-zero serving behind the port. No billing spine. **Owned weights are the only production lane** (owner decision 2026-07-14): the rented-provider bridge is dropped; the fal/FASHN adapters stay research-lane and are deleted when the owned checkpoint promotes (replace-then-delete) or in F13, whichever comes first. Rights to train on catalogue on-model photos are verified as part of F4 (catalogue rights) before any pair enters training.
10. **F9 — Try-on model evaluation.** One frozen consented scorecard for every commercially eligible provider/model, the GYF-trained checkpoint included; quality and security are not price levers. **Try-on opens to users only here** — free and quota-bounded — when a lane passes this gate, never before. The GYF lane keeps retraining on GYF pairs and behavioural signal until it beats the best eligible alternative on that scorecard; losing adapters are deleted per replace-then-delete.
11. **F10 — Infrastructure proof/migration.** Select and promote providers only after auth, data, restore, cold-start, cost and rollback parity; migration shims stay temporary.
12. **F11 — Closed free beta.** Prove mission-critical journeys for two weeks under realistic reliability, accessibility, privacy, catalogue, ML and cost conditions.
13. **F12 — Evidence-led improvement.** Retrain/version/evaluate only when clean data is sufficient; expand free try-on quotas only from reconciled cost.
14. **F13 — Deletion last.** With behaviour protected, remove the parked Flutter client, duplicate Saved/Collections and losing Canvas/Explore surface, stale scaffolds/assets/docs, unused Kafka/Redpanda/VTON paths, migration shims and cancelled payment planning. Run the full gate after each deletion group.

A failed candidate is rolled back or skipped; it never silently degrades production or blocks an independent slice.

## Current handoff: F2 (F1 gate closed 2026-07-14 — F1a `6f78bed`, F1b, F1c all shipped)

F1c delivered `/forgot-password` + `/reset-password` on Supabase Auth (regressions in
`password-recovery.test.tsx`) and the exact deployed check `scripts/verify_deployed_auth.sh`,
which passed verbatim against the deployed stack (anonymous /me refused; deployed sign-in;
authenticated /me identity round-trip). The deployed password-update mutation was proven live
(old password rejected, new accepted). One residual manual leg: the recovery **email link**
click-through on the deployed site awaits owner confirmation; the deployed auth config was
corrected first (site_url was a dead `gyf-web.onrender.com`; now `https://gyf-v2-app.vercel.app`
with the live domain allowlisted), without which every recovery link would have landed on a dead
host.

F2 — Privacy and isolation: consent, export, deletion, session revocation, private storage and
least-privilege database ownership/RLS. Audit what already exists (consent + erasure shipped in
P1-B; RLS partially built per the 2026-07-12 risk review) and close only the true gaps, each with
a regression; no rebuild of proven surfaces. F2 must not touch payment, migration, model
replacement or deletion.
