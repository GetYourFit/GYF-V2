# M1 · Evaluation harness foundation + promotion gate

> **Roadmap:** `docs/roadmap.md` STAGE 0 → M1. **Doctrine:** `engineering-doctrine.md` D5
> (eval-gated promotion), D1/D2 (ports + license gate, already shipped in M0).
> **Dep:** M0 (✅). **Status:** shipped ✅. Historical/evidence only under the active execution contract.

## Problem (the gap M1 closes)

M0 made the registry's `eval_report` field *required* for production models, but the gate only
checks it is **non-null**. The value is free text (`"p1a-retrieval-mrr-0.85"`) that resolves to
nothing — a model could be promoted with a fabricated report, a report for the wrong capability,
or one whose metrics are below the quality bar. The shipped retrieval report
(`ml/data/e2e/reports/…`) is disconnected from the registry entirely.

**M1 makes an eval report a resolvable, per-capability, gated artifact**: to promote a model to
the serving path it must carry a report that (1) exists on disk, (2) is for that model's
capability, and (3) meets that capability's quality gate. No passing report ⇒ no promotion.

## Design

Eval **contracts** live in `gyf_contracts` (stdlib-only, shared by api/ml/CI, like
`model_policy.py`); eval **computation** stays in `ml/eval`.

1. **`gyf_contracts/eval_report.py`** — the report schema + gates + promotion resolver:
   - `EvalReport` — `report_id`, `capability`, `model_version`, `metrics: dict[str,float]`,
     `num_samples`, `dataset`, `created_at`, `notes`; `to_dict`/`from_dict`.
   - `GateOp` (GTE / LTE) — higher-is-better metrics (MRR) vs lower-is-better (fairness gap,
     latency). `CapabilityGate(capability, metric, op, threshold)` with `evaluate(report)`.
   - `GATES` — per-capability quality floors. Seeded: `encoder` → `mrr ≥ 0.50` (incumbent
     marqo-fashionSigLIP scores 0.808, clearing the floor with margin; a real regression below
     it fails CI). Future capabilities (body_estimator fairness, try_on) register here as they land.
   - `meets_gate(report) → (bool, reasons)`; `is_improvement(candidate, incumbent)` for the
     M2-style "≥ current" regression check (separate from the absolute floor).
   - `load_report(path)`, `find_report(report_id, reports_dir)`,
     `resolve_promotion(card, reports_dir) → (bool, reasons)` = license gate (`is_servable`,
     `require_eval=False`) **+** report resolves **+** capability matches **+** `meets_gate`.
     This is the **M1 promotion gate**.

2. **`gyf_contracts/online_eval.py`** — typed *scaffolding* for when traffic exists (roadmap:
   "stubbed"). A/B assignment, interleaving, IPS estimator interfaces that raise
   `NotImplementedError("awaiting beta traffic")` so the shape is fixed now and offline→online
   promotion (the known risk) has a home.

3. **Canonical reports** in `eval-reports/<report_id>.json` (new, repo-root, the promotion
   record of truth). `ml/eval` gains a thin emitter so the harness *produces* `EvalReport`s.
   The registry's `eval_report` ids are pointed at real files here.

4. **`scripts/check_promotion.py`** — CI gate (D5): every production model must pass
   `resolve_promotion`. Wired into the `doctrine` job alongside the D2 license + D1 port checks.

5. **Tests** — `services/api/tests/test_eval_report.py` (schema, gate ops, promotion blocked when
   report missing / wrong capability / below floor / unparseable; allowed when passing) +
   `scripts/check_promotion.py` proven to fail on a sub-threshold report. ml tests extended for
   the emitter.

## DoD

- A production model whose `eval_report` is missing, mismatched, or sub-threshold **fails CI**
  (`check_promotion.py` red); a clean+passing one passes. Proven by both unit tests and a live
  registry test.
- The shipped marqo encoder resolves to a real canonical report that meets the `encoder` gate.
- Online-eval scaffolding exists with typed interfaces (not yet implemented).
- `make ci` green.
</content>
</invoke>
