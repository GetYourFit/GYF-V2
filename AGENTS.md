# GYF agent instructions

Read [`CLAUDE.md`](./CLAUDE.md) for repository conventions. Product intent lives in
[`docs/vision/ideas-complete.md`](./docs/vision/ideas-complete.md), and engineering invariants
live in [`docs/engineering-doctrine.md`](./docs/engineering-doctrine.md).

[`docs/plans/active-execution-contract.md`](./docs/plans/active-execution-contract.md) is the
sole authority for execution order, phase gates and the current slice. Older roadmaps and plans
are evidence only when they conflict with it.

## Binding owner decisions

- Virtual try-on is free. Do not implement payment, billing, subscriptions, entitlements,
  checkout or paid ranking.
- Preserve every incumbent until an evaluated replacement passes the contract's promotion and
  rollback gates. Never trade quality, security, privacy or reliability for cost.
- Delete obsolete and duplicate code only in F13, after its behaviour is protected or rejected.
- The current slice is F1a only: fix partial profile updates at the shared boundary and prove
  omitted values survive.

## Working rule

Stay inside the current slice, reuse existing code, and make the smallest root-cause change.
Run the slice checks and the contract's phase verification before committing or pushing; report
every skip or failure. Do not include unrelated working-tree changes in a commit.
