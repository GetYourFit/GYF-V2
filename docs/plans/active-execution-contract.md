# GYF active execution contract

Status: **ACTIVE** · owner-authorised 2026-07-14 (amended same day: try-on monetization) · application baseline `eb800965beeb5835c35bd8b8a269589f407e58f9`

This is the single source of truth for execution order. Product intent remains in `docs/vision/ideas-complete.md`; non-negotiable engineering rules remain in `docs/engineering-doctrine.md`; the July master plan and older plans are evidence only.

## Binding decisions

- GYF delivers meaningful, explainable outfit decisions from real catalogue facts, user control and consented learning.
- Recommendations, wardrobe, colour/photo assistance, Explore, social and every other surface are free. **Virtual try-on is behind a subscription** (owner amendment 2026-07-14) so GPU cost is recovered and margin reinvested — detail in [`tryon-subscription-monetization.md`](./tryon-subscription-monetization.md). GPU cost stays controlled by transparent quotas and a kill switch; quality is never a price lever and there is only one quality lane.
- Payment work is authorised **only** for the try-on subscription (Razorpay rail, `BillingProvider` port, server-side entitlements). Paid ranking, paid recommendations and any other paywall remain cancelled.
- Preserve the deterministic recommendation path when optional ML or GPU services fail.
- Promote a model after commercial permission, privacy and security checks pass. Owner amendment 2026-07-14: incumbent-preservation, quality-parity and migration-parity requirements are relaxed — a licensed, secure replacement may ship directly; rollback stays available via the port.
- Provider, migration and ₹2,000 budget proposals in older plans are hypotheses until measured; no provider is selected merely by a planning estimate.
- Delete obsolete and duplicate code only in F13, after behaviour is protected or explicitly rejected. Do not replace deleted code with speculative abstractions.

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
4. **F3 — Learning-event truth.** Real exposures/outcomes, deterministic IDs, consent/deletion and exact delayed-outcome joins before training.
5. **F4 — Catalogue truth.** Rights, price/currency, availability, freshness, removal reconciliation and purchasable outputs.
6. **F5 — Free recommendation incumbent.** Keep SigLIP 2/pgvector/rules/MMR; add anchored refinement and multi-interest context only when evaluation proves value.
7. **F6 — Small learned challenger.** Minimum pairwise/logistic ranker through offline, shadow, cohort and rollback gates.
8. **F7 — Colour and photo assistance.** Manual truth plus evaluated, correctable assistance with separate consent and deletion.
9. **F8 — Durable try-on behind subscription.** Reuse `TryOnRenderer`; private Postgres jobs, bounded retries, cancellation, TTL deletion, quotas and global cost kill switch — plus the billing spine per [`tryon-subscription-monetization.md`](./tryon-subscription-monetization.md): Razorpay Subscriptions behind a `BillingProvider` port, signature-verified idempotent webhooks, server-side entitlements/quota in the same transaction as usage, one free trial per account, cancellation/refund/erasure paths tested (Razorpay test mode end-to-end).
10. **F9 — Try-on model evaluation.** One frozen consented scorecard for every commercially eligible provider/model; quality and security are not price levers. **Charging goes live only here**: subscriptions open for purchase when a provider passes this gate, never before.
11. **F10 — Infrastructure proof/migration.** Select and promote providers only after auth, data, restore, cold-start, cost and rollback parity; migration shims stay temporary.
12. **F11 — Closed free beta.** Prove mission-critical journeys for two weeks under realistic reliability, accessibility, privacy, catalogue, ML and cost conditions.
13. **F12 — Evidence-led improvement.** Retrain/version/evaluate only when clean data is sufficient; expand free try-on quotas only from reconciled cost.
14. **F13 — Deletion last.** With behaviour protected, remove the parked Flutter client, duplicate Saved/Collections and losing Canvas/Explore surface, stale scaffolds/assets/docs, unused Kafka/Redpanda/VTON paths, migration shims and cancelled payment planning. Run the full gate after each deletion group.

A failed candidate is rolled back or skipped; it never silently degrades production or blocks an independent slice.

## Current handoff: F1a only

Trace every caller of the profile update endpoint and repository method. Add one regression proving avatar-only and partial styling updates preserve omitted values, then fix field-presence/merge semantics once at the shared boundary.

Exact slice verification:

```bash
cd services/api
uv run pytest -q tests/test_profile.py
uv run ruff check app/profile app/routers/profile.py tests/test_profile.py
```

Do not run a claimed deployed-auth journey in F1a; F1c must first define an exact runnable integration command. F1a must not touch payment, migration, model replacement or deletion.
