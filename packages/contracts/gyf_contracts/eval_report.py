"""Evaluation reports, per-capability gates, and the promotion gate (engineering-doctrine D5).

M0 made an ``eval_report`` *required* for any production model; M1 makes it *real*. A model may
reach the serving path only if it carries a report that (1) exists, (2) is for that model's
capability, and (3) meets that capability's quality gate. :func:`resolve_promotion` is the single
predicate that decides this — license gate (``model_policy.is_servable``) **plus** a resolvable,
passing eval report. Like :mod:`model_policy` it returns the *reasons* it fails (D6 honesty in our
own tooling), and is stdlib-only so it imports in the API, the ML lane, and the CI gate alike.

Offline metrics gate **candidate selection only**; promotion to live traffic still requires the
online checks scaffolded in :mod:`gyf_contracts.online_eval` (the known offline→online gap).
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from enum import Enum
from pathlib import Path

from .model_policy import ModelCard, is_servable

DEFAULT_REPORTS_DIR = "eval-reports"


@dataclass(frozen=True)
class EvalReport:
    """One offline evaluation of one model version against a dataset.

    ``metrics`` is capability-agnostic (e.g. ``{"mrr": 0.81, "recall_at_10": 0.51}``) so a single
    schema serves perception, recsys, compatibility, and fairness. ``report_id`` is the stable
    handle the registry's ``eval_report`` points at.
    """

    report_id: str
    capability: str  # must match the model card's capability ("encoder", "body_estimator", ...)
    model_version: str
    metrics: dict[str, float]
    num_samples: int
    dataset: str
    created_at: str  # ISO-8601
    notes: str = ""

    def to_dict(self) -> dict[str, object]:
        return {
            "report_id": self.report_id,
            "capability": self.capability,
            "model_version": self.model_version,
            "metrics": {k: round(float(v), 4) for k, v in self.metrics.items()},
            "num_samples": self.num_samples,
            "dataset": self.dataset,
            "created_at": self.created_at,
            "notes": self.notes,
        }

    @classmethod
    def from_dict(cls, d: dict) -> EvalReport:
        return cls(
            report_id=d["report_id"],
            capability=d["capability"],
            model_version=d["model_version"],
            metrics={k: float(v) for k, v in d["metrics"].items()},
            num_samples=int(d["num_samples"]),
            dataset=d["dataset"],
            created_at=d["created_at"],
            notes=d.get("notes", ""),
        )


class GateOp(str, Enum):
    """Direction of a gate: most metrics are higher-is-better; some (fairness gap, latency) lower."""

    GTE = "gte"  # metric must be >= threshold
    LTE = "lte"  # metric must be <= threshold

    def passes(self, value: float, threshold: float) -> bool:
        return value >= threshold if self is GateOp.GTE else value <= threshold


@dataclass(frozen=True)
class CapabilityGate:
    """The quality floor a capability's served model must clear on a named metric."""

    capability: str
    metric: str
    op: GateOp
    threshold: float
    rationale: str = ""

    def evaluate(self, report: EvalReport) -> tuple[bool, str]:
        if self.metric not in report.metrics:
            return False, f"report is missing gate metric '{self.metric}'"
        value = report.metrics[self.metric]
        if self.op.passes(value, self.threshold):
            return True, ""
        sign = ">=" if self.op is GateOp.GTE else "<="
        return False, f"{self.metric}={value:.4f} fails gate ({sign} {self.threshold})"


# Per-capability promotion floors. A capability without a gate here cannot be promoted (we never
# serve an unmeasured capability). Add an entry as each pillar's harness lands.
GATES: dict[str, CapabilityGate] = {
    "encoder": CapabilityGate(
        capability="encoder",
        metric="mrr",
        op=GateOp.GTE,
        threshold=0.50,
        rationale=(
            "Image->image leave-one-out MRR floor for perception. Incumbent marqo-fashionSigLIP "
            "scores ~0.81 (clears with margin); a regression below 0.50 fails CI."
        ),
    ),
}


def meets_gate(report: EvalReport) -> tuple[bool, list[str]]:
    """Whether a report clears its capability's gate, with reasons if not."""
    gate = GATES.get(report.capability)
    if gate is None:
        return False, [f"no gate defined for capability '{report.capability}'"]
    ok, reason = gate.evaluate(report)
    return (True, []) if ok else (False, [reason])


def is_improvement(candidate: EvalReport, incumbent: EvalReport) -> tuple[bool, list[str]]:
    """Regression check for swaps (e.g. M2 'MRR/Recall >= current').

    The candidate must not regress the incumbent on the capability's gate metric. Distinct from
    :func:`meets_gate`, which is an absolute floor rather than a comparison.
    """
    gate = GATES.get(candidate.capability)
    if gate is None:
        return False, [f"no gate defined for capability '{candidate.capability}'"]
    if candidate.capability != incumbent.capability:
        return False, ["capability mismatch between candidate and incumbent"]
    cand = candidate.metrics.get(gate.metric)
    inc = incumbent.metrics.get(gate.metric)
    if cand is None or inc is None:
        return False, [f"both reports must carry '{gate.metric}'"]
    better = gate.op.passes(cand, inc)  # >= incumbent for GTE, <= incumbent for LTE
    if better:
        return True, []
    return False, [f"{gate.metric} regressed: candidate={cand:.4f} vs incumbent={inc:.4f}"]


def load_report(path: str | Path) -> EvalReport:
    """Parse one report file."""
    return EvalReport.from_dict(json.loads(Path(path).read_text(encoding="utf-8")))


def find_report(report_id: str, reports_dir: str | Path = DEFAULT_REPORTS_DIR) -> EvalReport | None:
    """Resolve a registry ``eval_report`` id to its canonical ``<reports_dir>/<id>.json``."""
    path = Path(reports_dir) / f"{report_id}.json"
    if not path.exists():
        return None
    report = load_report(path)
    if report.report_id != report_id:
        raise ValueError(
            f"report id mismatch: {path} declares '{report.report_id}', expected '{report_id}'"
        )
    return report


def resolve_promotion(
    card: ModelCard, reports_dir: str | Path = DEFAULT_REPORTS_DIR
) -> tuple[bool, list[str]]:
    """The M1 promotion gate: may this model serve, license **and** evaluation considered?

    Combines the D2 license/lane gate with D5 evaluation: the card must be commercial-clean *and*
    its ``eval_report`` must resolve to a passing report for the same capability. Returns every
    reason it fails so CI output is actionable.
    """
    reasons: list[str] = []

    # License/lane (D2). We re-check eval presence here ourselves, so don't double-count it.
    ok_license, license_reasons = is_servable(card, require_eval=False)
    reasons.extend(license_reasons)

    if not card.eval_report:
        reasons.append("no eval report attached (engineering-doctrine D5)")
        return False, reasons

    report = find_report(card.eval_report, reports_dir)
    if report is None:
        reasons.append(f"eval report '{card.eval_report}' does not resolve under {reports_dir}/")
        return False, reasons

    if report.capability != card.capability:
        reasons.append(
            f"eval report is for capability '{report.capability}', not '{card.capability}'"
        )
    ok_gate, gate_reasons = meets_gate(report)
    reasons.extend(gate_reasons)

    return (not reasons, reasons)
