"""Fairness evaluation for the optional photo body/tone assistants.

This harness consumes a *labelled, consented* panel manifest.  It is deliberately
not a way to promote a model from a convenient public or synthetic set: manifests
must identify their consent, licence, label protocol and panel status.  The checked-in
panel is an empty, clearly-marked placeholder so every run remains a HOLD until the
captain supplies an approved diverse panel.

Run a precomputed prediction manifest (useful for reproducible/offline evaluation)::

    python -m usermodel.photo_fairness_eval panel.json --capability skin_tone

Set ``GYF_PHOTO_FAIRNESS_PANEL`` to select a panel without putting a sensitive path
on the command line.  A manifest contains ``panel`` metadata and ``samples``.  Each
sample needs ``label``, ``prediction``, ``confidence`` and ``subgroups``; an abstain
is represented by ``prediction: "unknown"``.  ``subgroups`` must include ``band`` for
skin tone, and should include all approved audit slices (for example lighting and
body presentation).  No images or personal data are written to the report.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from gyf_contracts.eval_report import EvalReport

PLACEHOLDER_PANEL = (
    Path(__file__).resolve().parents[1] / "eval-panels" / "photo-assistance-placeholder.json"
)
_VALID_CAPABILITIES = {"skin_tone", "body_estimator"}


def _is_abstain(value: object) -> bool:
    return value is None or str(value).strip().lower() in {"", "unknown", "abstain", "none"}


def _mst_index(value: object) -> int | None:
    try:
        index = int(str(value).lower().removeprefix("mst"))
    except ValueError:
        return None
    return index if 1 <= index <= 10 else None


def _error(capability: str, label: object, prediction: object) -> float:
    if _is_abstain(prediction):
        # Match the existing MST scale: silence cannot erase disparate error.
        return 9.0 if capability == "skin_tone" else 1.0
    if capability != "skin_tone":
        return float(str(prediction) != str(label))
    true_mst, predicted_mst = _mst_index(label), _mst_index(prediction)
    if true_mst is None or predicted_mst is None:
        raise ValueError("skin-tone labels and predictions must be mst1 through mst10 or unknown")
    return float(abs(true_mst - predicted_mst))


def _max_error(capability: str) -> float:
    return 9.0 if capability == "skin_tone" else 1.0


def _correctness(capability: str, error: float) -> float:
    return max(0.0, 1.0 - error / _max_error(capability))


def _ece(observations: list[tuple[float, float]], bins: int = 10) -> float:
    """Expected calibration error, including abstentions as confidence zero."""
    if not observations:
        return 0.0
    bucketed: dict[int, list[tuple[float, float]]] = defaultdict(list)
    for confidence, correct in observations:
        bucketed[min(bins - 1, int(max(0.0, min(1.0, confidence)) * bins))].append(
            (max(0.0, min(1.0, confidence)), correct)
        )
    return sum(
        len(bucket)
        / len(observations)
        * abs(
            sum(confidence for confidence, _ in bucket) / len(bucket)
            - sum(correct for _, correct in bucket) / len(bucket)
        )
        for bucket in bucketed.values()
    )


def _protected_attestation() -> dict[str, str]:
    """Read values injected only by protected evaluation/CI configuration.

    These values intentionally are not committed alongside a panel. An author can
    create a manifest, but cannot make it eligible without the independently held
    exact digest and attestation identifier.
    """
    return {
        "digest": os.environ.get("GYF_PHOTO_FAIRNESS_PANEL_DIGEST", ""),
        "attestation_id": os.environ.get("GYF_PHOTO_FAIRNESS_PANEL_ATTESTATION_ID", ""),
    }


def summarize(
    samples: list[dict[str, Any]],
    *,
    capability: str,
    model_version: str,
    report_id: str,
    panel: dict[str, Any],
    protected_attestation: dict[str, str] | None = None,
) -> EvalReport:
    """Return error, calibration and abstention metrics by every declared subgroup.

    Abstentions are errors for accuracy/fairness calculations.  This prevents a
    candidate from appearing fair merely by declining the difficult subgroup.
    """
    if capability not in _VALID_CAPABILITIES:
        raise ValueError(f"unsupported capability {capability!r}")
    by_slice: dict[str, dict[str, list[tuple[float, float, float]]]] = defaultdict(
        lambda: defaultdict(list)
    )
    all_rows: list[tuple[float, float, float]] = []  # error, confidence, abstained
    for row in samples:
        label = row.get("label")
        if _is_abstain(label):
            continue
        prediction = row.get("prediction")
        abstained = float(_is_abstain(prediction))
        error = _error(capability, label, prediction)
        confidence = 0.0 if abstained else float(row.get("confidence", 0.0))
        values = (error, confidence, abstained)
        all_rows.append(values)
        subgroups = row.get("subgroups")
        if not isinstance(subgroups, dict) or not subgroups:
            raise ValueError("each labelled sample needs non-empty subgroups")
        for dimension, group in subgroups.items():
            if _is_abstain(group):
                raise ValueError("subgroup values must be non-empty")
            by_slice[str(dimension)][str(group)].append(values)

    def metrics_for(rows: list[tuple[float, float, float]]) -> tuple[float, float, float]:
        count = len(rows)
        if not count:
            return 0.0, 0.0, 0.0
        error = sum(row[0] for row in rows) / count
        abstention = sum(row[2] for row in rows) / count
        calibration = _ece([(row[1], _correctness(capability, row[0])) for row in rows])
        return error, calibration, abstention

    metrics: dict[str, float] = {}
    overall_error, overall_ece, overall_abstention = metrics_for(all_rows)
    metrics.update(error_rate=overall_error, ece=overall_ece, abstention_rate=overall_abstention)
    all_group_errors: list[float] = []
    for dimension, groups in sorted(by_slice.items()):
        for group, rows in sorted(groups.items()):
            error, calibration, abstention = metrics_for(rows)
            key = f"subgroup.{dimension}.{group}"
            metrics[f"{key}.error_rate"] = error
            metrics[f"{key}.ece"] = calibration
            metrics[f"{key}.abstention_rate"] = abstention
            if dimension == "band":
                all_group_errors.append(error)
    # `band` is mandatory: without it a report cannot make the required
    # cross-band comparison and must not manufacture a passing zero gap.
    if all_rows and not all_group_errors:
        raise ValueError("panel samples must declare the required 'band' subgroup")
    # The skin-tone DoD calls this max_band_gap. It is also emitted for body
    # panels against their captain-approved `band` audit slice. An empty placeholder
    # gets 0 only because panel evidence independently and fail-closed blocks it.
    metrics["max_band_gap"] = (
        max(all_group_errors) - min(all_group_errors) if all_group_errors else 0.0
    )

    required = {
        "panel_id",
        "consent_basis",
        "data_license",
        "collection_provenance",
        "label_protocol",
        "status",
        "attestation_id",
        "cohort_justification",
    }
    missing = sorted(key for key in required if not panel.get(key))
    panel_status = str(panel.get("status", "placeholder"))
    panel_hash = hashlib.sha256(
        json.dumps(
            {"panel": panel, "samples": samples}, sort_keys=True, separators=(",", ":")
        ).encode("utf-8")
    ).hexdigest()
    protected = (
        protected_attestation if protected_attestation is not None else _protected_attestation()
    )
    justification = panel.get("cohort_justification")
    ineligibility: list[str] = []
    if missing:
        ineligibility.append(f"missing panel metadata: {', '.join(missing)}")
    if panel_status != "approved":
        ineligibility.append("panel is not captain-approved")
    if not all_rows:
        ineligibility.append("panel has no scored samples")
    if protected.get("digest") != panel_hash or not protected.get("digest"):
        ineligibility.append("panel digest does not match protected exact-digest attestation")
    if protected.get("attestation_id") != panel.get("attestation_id") or not protected.get(
        "attestation_id"
    ):
        ineligibility.append("panel attestation id does not match protected attestation")
    if not isinstance(justification, dict):
        ineligibility.append("cohort lacks preregistered power/statistical justification")
    else:
        method = justification.get("method")
        minimum_total = justification.get("minimum_total")
        minimum_per_band = justification.get("minimum_per_band")
        if method not in {
            "preregistered_power_analysis",
            "equivalent_statistical_justification",
        } or not justification.get("reference"):
            ineligibility.append("cohort lacks preregistered power/statistical justification")
        if not isinstance(minimum_total, int) or minimum_total < 3:
            ineligibility.append(
                "cohort minimum_total must be power-justified and greater than two"
            )
        elif len(all_rows) < minimum_total:
            ineligibility.append("panel does not meet its preregistered minimum_total")
        if not isinstance(minimum_per_band, int) or minimum_per_band < 1:
            ineligibility.append("cohort minimum_per_band must be a positive justified integer")
        elif any(len(rows) < minimum_per_band for rows in by_slice.get("band", {}).values()):
            ineligibility.append("panel does not meet its preregistered minimum_per_band")
    evidence = {
        "panel_status": panel_status,
        "panel_hash": panel_hash,
        "attestation_id": panel.get("attestation_id", ""),
        "panel_complete": not missing and bool(all_rows),
        "promotion_eligible_panel": not ineligibility,
        "missing_panel_metadata": missing,
        "subgroup_dimensions": sorted(by_slice),
        "ineligibility_reasons": ineligibility,
    }
    return EvalReport(
        report_id=report_id,
        capability=capability,
        model_version=model_version,
        metrics=metrics,
        num_samples=len(all_rows),
        dataset=str(panel.get("panel_id", "unidentified-photo-panel")),
        created_at=datetime.now(timezone.utc).isoformat(),
        notes=(
            "Photo-assistance subgroup error, ECE calibration and abstention evaluation. "
            "Abstentions count as errors. "
            + ("Panel metadata incomplete; this report cannot promote a model." if missing else "")
        ),
        evidence=evidence,
    )


def _load(path: Path) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if (
        not isinstance(raw, dict)
        or not isinstance(raw.get("panel"), dict)
        or not isinstance(raw.get("samples"), list)
    ):
        raise ValueError("panel manifest must contain object `panel` and list `samples`")
    return raw["panel"], raw["samples"]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Evaluate labelled photo-assistance fairness panel"
    )
    parser.add_argument(
        "panel",
        nargs="?",
        type=Path,
        default=Path(os.environ.get("GYF_PHOTO_FAIRNESS_PANEL", PLACEHOLDER_PANEL)),
    )
    parser.add_argument("--capability", required=True, choices=sorted(_VALID_CAPABILITIES))
    parser.add_argument("--model-version", required=True)
    parser.add_argument("--report-id", required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    panel, samples = _load(args.panel)
    report = summarize(
        samples,
        capability=args.capability,
        model_version=args.model_version,
        report_id=args.report_id,
        panel=panel,
    )
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report.to_dict(), indent=2) + "\n", encoding="utf-8")
    print(
        f"wrote {args.out}; panel_status={report.evidence['panel_status']}; samples={report.num_samples}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
