# GYF agent instructions

Read [`CLAUDE.md`](./CLAUDE.md) for repository conventions. Product intent lives in
[`docs/vision/ideas-complete.md`](./docs/vision/ideas-complete.md), and engineering invariants
live in [`docs/engineering-doctrine.md`](./docs/engineering-doctrine.md).

[`docs/plans/active-execution-contract.md`](./docs/plans/active-execution-contract.md) is the
sole authority for execution order, phase gates and the current slice. Older roadmaps and plans
are evidence only when they conflict with it.

## Binding owner decisions

- Every surface is free, including virtual try-on (owner amendment 2026-07-14, superseding
  the same-day subscription decision; see `docs/plans/free-vton-moat.md`). Owner amendment
  2026-07-16: FASHN VTON v1.5 is the first external serving candidate if its full license,
  privacy, quality, cost and operability gates pass, while GYF prepares a rights-clean owned lane
  and trains it only after ≥2,000 authorised pairs plus a stable ≥10% FASHN failure cluster exist,
  so production is not permanently provider/checkpoint-dependent. Try-on opens only
  after F9 promotes a lane. Payment work is cancelled; no paywall anywhere.
- Owner (2026-07-14): incumbent-preservation and migration-parity caution are relaxed —
  replacements may ship once licensed and secure. Never trade security, privacy or reliability
  for cost.
- A gated replacement deletes what it replaces in the same slice; everything else obsolete
  or duplicate is deleted only in F13, after its behaviour is protected or rejected.
- The current production gate is F2.5: external deployment/SLO promotion remains pending.
  By owner execution amendment 2026-07-15, local implementation may continue sequentially
  through the Expo replacement and later phases while that gate is pending; no phase may claim
  production promotion before its evidence gate passes. F1a/F1b shipped (`6f78bed`, `7087825`).
- Owner (2026-07-16): the paid Render Starter service already exists in Oregon. Do not create or
  plan a Singapore Render/Supabase migration. Keep the current topology while closing measured
  software/query causes; any later non-Singapore topology experiment needs evidence and a separate
  owner decision.
- Owner (2026-07-16, latest): every non-conflicting capability and quality requirement in
  `docs/vision/ideas-complete.md` and every `docs/feedbacks/*.md` file is hard-public-launch scope.
  Implement them sequentially as complete, gated vertical slices; do not defer them merely as
  post-launch ideas. Conflicting feedback must be resolved explicitly and tested, not silently
  cherry-picked.

## Working rule

Stay inside the current slice, reuse existing code, and make the smallest root-cause change.
Run the slice checks and the contract's phase verification before committing or pushing; report
every skip or failure. Do not include unrelated working-tree changes in a commit.
