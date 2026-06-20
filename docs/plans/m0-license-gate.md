# M0 — Model Registry + CI License Gate + Import Lint

> **Status:** planned, execution-ready. The first **Stage 0** control in `roadmap.md`;
> implements `engineering-doctrine.md` **D1 (ports) + D2 (two-lane license gate)**.
> **Why first:** the license/eval gates must exist *before* any model flows through them —
> otherwise we retrofit safety later (expensive) or ship a non-commercial weight (illegal).
> Small, self-contained, zero product risk.

## Goal (DoD)
A machine refuses to let a **non-commercial** model reach the serving path, and refuses to
serve a model **without an eval report** (the D5 hook lands in M1). Concretely:
- Every model GYF can load is described by a **model card** with a `license` + `lane` +
  `commercial_ok` + `train_data_license`.
- A single **`is_servable()`** policy decides production-eligibility.
- A **CI check** fails the build if any model wired to serving isn't servable.
- A **lint rule** stops application code from importing model packages directly (must go via a
  capability port — D1).

## Design (smallest thing that is real, not a toy)
The repo has **no MLflow registry yet** and models are loaded lazily in-process (e.g.
`SiglipEncoder`). So the registry is a **declarative manifest in the repo** now, with the same
schema MLflow tags will use later — the policy function is identical either way.

## Files
1. **`packages/contracts/gyf_contracts/model_policy.py`** (new — shared by api + ml)
   - `class Lane(str, Enum)`: `RESEARCH`, `PRODUCTION`.
   - `@dataclass(frozen=True) ModelCard`: `name, capability, provider, license, lane,
     commercial_ok, train_data_license, train_data_commercial_ok, eval_report, model_uri,
     notes`.
   - `def is_servable(card, *, require_eval=True) -> tuple[bool, list[str]]`: returns
     `(ok, reasons)` — production-eligible iff `lane==PRODUCTION ∧ commercial_ok ∧
     train_data_commercial_ok ∧ (eval_report present or require_eval=False)`. Returns the
     **reasons** it failed (honest, debuggable — not a bare bool).
   - `def load_registry(path) -> list[ModelCard]` (parse the YAML manifest).
   - Pure, no deps beyond stdlib + PyYAML (already transitively available; else json).
2. **`models.registry.yaml`** (new, repo root) — the declarative registry. One entry per model
   GYF uses today, each tagged. Seeds: `marqo-fashionSigLIP` (perception, Apache, production),
   `sam-3d-body`/`mhr`/`anny` (body, commercial-clean, production once M3 lands → `research`
   until then), `qwen3` (intent, Apache, production), and any non-commercial north-stars tagged
   `lane: research` (e.g. `fitdit`, `idm-vton`) so the gate provably blocks them.
3. **`scripts/check_model_licenses.py`** (new) — CLI: load the registry, assert **every
   `lane: production` card `is_servable`**; print a table; **exit non-zero** on any violation.
   Also asserts no card is mis-tagged (production + `commercial_ok: false`).
4. **`.github/workflows/*`** — add a `model-license-gate` job running the script (+ the lint
   below) on every PR. Fails the build red on violation.
5. **Import lint (D1)** — a check that **application code may not import heavy model packages
   directly** (must go through a capability port). Implement as a small `scripts/check_ports.py`
   (grep-based denylist: `services/api/app/**` and `ml/**/service|adapter` may not
   `import torch|transformers|sam3d|mhr|...` outside the designated adapter modules), wired into
   the same CI job. Cheap, deterministic, honest.
6. **Tests** `services/api/tests/test_model_policy.py` — `is_servable` truth table
   (production+clean+eval → ok; production+NC → blocked with reason; research → not servable;
   missing eval → blocked when required); `load_registry` parses the manifest; a test that
   **asserts the live `models.registry.yaml` passes the gate** (so the registry can never drift
   into an illegal state without a red test).

## Acceptance
- `python scripts/check_model_licenses.py` exits 0 on the seeded registry, and exits non-zero
  if any production card is non-commercial or a research-only model is tagged production.
- A deliberately mis-tagged card (e.g. FitDiT set to `lane: production`) turns CI red.
- Application code importing `torch`/`transformers` outside an adapter turns CI red.
- All tests pass; ruff clean.

## Notes / guardrails
- **Forward-compatible:** when MLflow lands, `ModelCard` becomes the tag schema and
  `is_servable` is reused unchanged — the YAML manifest is just the pre-MLflow backing store.
- **`is_servable` returns reasons**, never a bare bool (D6 honesty applied to our own tooling).
- M1 (eval harness) flips `require_eval=True` meaningfully once eval reports are attachable;
  until then cards may carry a placeholder `eval_report: bootstrap` with a TODO, surfaced in the
  status view (M8.5).
- Local test cmd: `PYTHONPATH="packages/contracts:services/api" .venv/bin/python -m pytest
  services/api/tests/test_model_policy.py`.
