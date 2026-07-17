# GYF agent instructions

Read [`CLAUDE.md`](./CLAUDE.md) before working. The authority chain is:

1. [`docs/vision/ideas-complete.md`](./docs/vision/ideas-complete.md) — product intent.
2. [`docs/engineering-doctrine.md`](./docs/engineering-doctrine.md) — engineering invariants.
3. [`docs/plans/active-execution-contract.md`](./docs/plans/active-execution-contract.md) — sole
   execution order, current slice and phase gates.
4. [`docs/plans/gyf-launch-refactor-plan.md`](./docs/plans/gyf-launch-refactor-plan.md) — subordinate
   hard-launch tickets and vision/feedback traceability.

Older plans, progress logs and feedback responses are evidence, never execution authority.

## Binding owner decisions

- All user surfaces are free. Payment, paywalls and paid ranking are cancelled.
- FASHN VTON v1.5 is the first external try-on candidate after F9 gates. Prepare the rights-clean
  owned lane; train only after ≥2,000 authorised pairs and a stable ≥10% FASHN failure cluster.
- The production gate is F2.5. Local work may continue in contract order, but no phase may claim
  production promotion without its evidence gate.
- Keep the single paid Virginia Render Starter as production. Keep the Oregon service suspended
  only as a time-bounded rollback until its rollback gate closes; do not plan or provision
  Singapore. Any later topology experiment requires measured failure and a separate owner decision.
- Every non-conflicting requirement in the canonical vision and `docs/feedbacks/*.md` is hard-launch
  scope. Execute the traceability matrix sequentially; security, privacy, licensing, accessibility
  and truthful claims resolve conflicts.
- A licensed, secure replacement may ship when its gate passes and deletes what it replaces in the
  same slice. Other obsolete/duplicate material waits for protected F13 deletion.
- Hosting plus GPU remains below ₹3,000/month during the beta envelope. Growth requires the
  contract's explicit spend step-up decision; never claim that this ceiling supports one million
  users.
- Hard-launch defaults: India, 18+; owner/founder is launch commander and privacy/security incident
  owner until delegated; `gyf1ltd@gmail.com` is the support/grievance channel. Use the launch plan's
  frozen activation/D7/D30 thresholds and approved 2×-coverage-for-three-months spend step-up rule.

## Working rule

Stay inside the current slice. Reuse existing code, prefer deletion, and make the smallest
root-cause change. Do not add infrastructure, abstractions or models without a measured requirement.

Before commit/push, run the slice checks plus:

```bash
make fmt-check
make lint
make typecheck
make doctrine
make test
bun run build
```

Report every warning, skip and failure. Never include unrelated working-tree changes.
