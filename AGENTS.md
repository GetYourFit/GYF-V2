# GYF agent instructions

Read [`CLAUDE.md`](./CLAUDE.md) for repository conventions. Product intent lives in
[`docs/vision/ideas-complete.md`](./docs/vision/ideas-complete.md), and engineering invariants
live in [`docs/engineering-doctrine.md`](./docs/engineering-doctrine.md).

[`docs/plans/active-execution-contract.md`](./docs/plans/active-execution-contract.md) is the
sole authority for execution order, phase gates and the current slice. Older roadmaps and plans
are evidence only when they conflict with it.

## Binding owner decisions

- Every surface is free, including virtual try-on (owner amendment 2026-07-14, superseding
  the same-day subscription decision; see `docs/plans/free-vton-moat.md`). The owned free lane
  (MIT Leffa architecture fine-tuned on GYF catalogue pairs, ZeroGPU or rented scale-to-zero
  serving) lands in F8 and opens to users only after F9 promotes a lane. Payment work is
  cancelled; no paywall anywhere.
- Owner (2026-07-14): incumbent-preservation and migration-parity caution are relaxed —
  replacements may ship once licensed and secure. Never trade security, privacy or reliability
  for cost.
- A gated replacement deletes what it replaces in the same slice; everything else obsolete
  or duplicate is deleted only in F13, after its behaviour is protected or rejected.
- The current slice is F1b only: make filter, confidence-label and sensitive-upload
  capability claims truthful, one regression per fixed claim. (F1a shipped, commit `6f78bed`.)

## Working rule

Stay inside the current slice, reuse existing code, and make the smallest root-cause change.
Run the slice checks and the contract's phase verification before committing or pushing; report
every skip or failure. Do not include unrelated working-tree changes in a commit.
