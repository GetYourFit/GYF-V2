"""The skin-tone fairness gate (⚠ P1-B Cycle 3's defining deliverable).

Runs the **real** skin-tone pipeline across a balanced, full-MST-spectrum image
set and reports, **per Monk Skin Tone band**, how far the estimate lands from the
labelled truth — then the worst gap between any two bands. That cross-band gap is
the fairness metric the M1 promotion gate (``GATES['skin_tone']``) checks: the
module may only be surfaced in production once the gap is within one bucket, so it
is provably not worse for darker (or lighter) skin. Until then it runs in shadow.

The aggregation (:func:`summarize`) is pure and unit-tested; the CLI wires it to
the real estimator over a manifest of labelled photos and writes a canonical
:class:`~gyf_contracts.eval_report.EvalReport` JSON under ``eval-reports/``.

    python -m usermodel.skintone.fairness_eval <manifest.json> [report_id]

``manifest.json`` is ``[{"path": "a.jpg", "true_mst": "mst7"}, ...]`` — a small
consented or public fairness set (e.g. MST-E / FairFace-derived), **never** served
user data (D8). The labelled photos are not committed; the manifest points at them.
"""

from __future__ import annotations

import json
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

from gyf_contracts.eval_report import DEFAULT_REPORTS_DIR, EvalReport
from gyf_contracts.usermodel import UNKNOWN_SKIN_TONE

DEFAULT_DATASET = "mst-fairness-set"


def _mst_index(bucket: str) -> int | None:
    """`mst1`..`mst10` → 1..10; anything else (incl. `unknown`) → None."""
    if not bucket.startswith("mst"):
        return None
    try:
        return int(bucket[3:])
    except ValueError:
        return None


def summarize(
    pairs: list[tuple[str, str]],
    *,
    model_version: str,
    report_id: str,
    dataset: str = DEFAULT_DATASET,
    notes: str = "",
) -> EvalReport:
    """Aggregate (true_mst, predicted_mst) pairs into a fairness EvalReport.

    Per band: mean absolute bucket error over its samples (abstentions count as the
    full 10-bucket error, so a module that stays silent on dark skin cannot "pass"
    by abstaining). ``max_band_gap`` is the largest difference in per-band mean
    error between any two bands that have samples — the gate metric.
    """
    errors_by_band: dict[int, list[float]] = defaultdict(list)
    for true_bucket, pred_bucket in pairs:
        true_idx = _mst_index(true_bucket)
        if true_idx is None:
            continue  # an unlabelled sample can't score fairness
        pred_idx = _mst_index(pred_bucket)
        # Abstain / unknown is the worst honest outcome: full-scale error.
        error = 9.0 if pred_idx is None else float(abs(true_idx - pred_idx))
        errors_by_band[true_idx].append(error)

    per_band = {band: sum(errs) / len(errs) for band, errs in errors_by_band.items() if errs}
    num_samples = sum(len(errs) for errs in errors_by_band.values())
    overall = (
        sum(e for errs in errors_by_band.values() for e in errs) / num_samples
        if num_samples
        else 0.0
    )
    max_band_gap = (max(per_band.values()) - min(per_band.values())) if per_band else 0.0

    metrics: dict[str, float] = {
        "mean_abs_bucket_error": overall,
        "max_band_gap": max_band_gap,
    }
    for band, err in sorted(per_band.items()):
        metrics[f"band_mae_mst{band}"] = err

    return EvalReport(
        report_id=report_id,
        capability="skin_tone",
        model_version=model_version,
        metrics=metrics,
        num_samples=num_samples,
        dataset=dataset,
        created_at=datetime.now(timezone.utc).isoformat(),
        notes=notes or "Per-band MST fairness; abstain scored as full-scale error.",
    )


def _run_manifest(manifest_path: Path) -> tuple[list[tuple[str, str]], str]:
    """Run the real estimator over a labelled manifest → (pairs, model_version)."""
    from PIL import Image

    from .estimate import estimate_skin_tone
    from .estimator import DEFAULT_MODEL_VERSION, FaceParsingSkinToneEstimator

    entries = json.loads(manifest_path.read_text(encoding="utf-8"))
    estimator = FaceParsingSkinToneEstimator()
    base = manifest_path.parent
    pairs: list[tuple[str, str]] = []
    for entry in entries:
        image_path = (base / entry["path"]).resolve()
        with Image.open(image_path) as image:
            est = estimate_skin_tone(image.convert("RGB"), estimator)
        pairs.append((entry["true_mst"], est.skin_tone or UNKNOWN_SKIN_TONE))
    return pairs, DEFAULT_MODEL_VERSION


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print(__doc__)
        return 2
    manifest_path = Path(argv[1])
    report_id = argv[2] if len(argv) > 2 else "skintone-cielab-mst-v1"

    pairs, model_version = _run_manifest(manifest_path)
    report = summarize(pairs, model_version=model_version, report_id=report_id)

    out_dir = Path(DEFAULT_REPORTS_DIR)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{report_id}.json"
    out_path.write_text(json.dumps(report.to_dict(), indent=2) + "\n", encoding="utf-8")

    print(f"wrote {out_path}")
    print(f"  samples:            {report.num_samples}")
    print(f"  mean_abs_bucket_err: {report.metrics['mean_abs_bucket_error']:.3f}")
    print(f"  max_band_gap:       {report.metrics['max_band_gap']:.3f}  (gate ≤ 1.0)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
