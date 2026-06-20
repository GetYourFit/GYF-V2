"""Model licensing & lane policy — the machine-enforced commercial-clean gate.

Implements engineering-doctrine D2 (two-lane lifecycle + license gate): every model GYF can
load is described by a :class:`ModelCard`; :func:`is_servable` is the single predicate deciding
production-eligibility, and it returns the *reasons* it fails (D6 honesty applied to our own
tooling) so a violation is debuggable, never a bare ``False``.

The registry is a declarative JSON manifest in the repo today (``models.registry.json``); when
MLflow lands, :class:`ModelCard` becomes the tag schema and this predicate is reused unchanged.

Shared by ``gyf-api`` and ``gyf-ml`` via ``gyf_contracts``. Stdlib-only (no PyYAML/torch) so it
imports anywhere, including the CI gate.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from enum import Enum
from pathlib import Path

DEFAULT_REGISTRY = "models.registry.json"


class Lane(str, Enum):
    """Where a model may run. Only ``PRODUCTION`` models may touch the serving path."""

    RESEARCH = "research"  # any license, OFFLINE only (benchmarking, north-star comparison)
    PRODUCTION = "production"  # commercial-clean only — the served lane


@dataclass(frozen=True)
class ModelCard:
    """License/provenance metadata for one model behind a capability port.

    ``commercial_ok`` is about the model's *own* license; ``train_data_commercial_ok`` is about
    the *training data's* license — the gate that catches the "MIT code, non-commercial weights"
    trap (e.g. Leffa). Both must be true to serve.
    """

    name: str
    capability: str  # the port it plugs into: "encoder", "body_estimator", "try_on", ...
    provider: str
    license: str
    lane: Lane
    commercial_ok: bool
    train_data_commercial_ok: bool
    train_data_license: str = "unknown"
    eval_report: str | None = None  # id/path of a passing eval report; None = unevaluated
    model_uri: str | None = None
    notes: str = ""


def is_servable(card: ModelCard, *, require_eval: bool = True) -> tuple[bool, list[str]]:
    """Whether a model may run in the serving path, plus the reasons it may not.

    Production-eligible iff it is in the production lane, its model *and* training-data licenses
    are commercial-OK, and (when ``require_eval``) it carries a passing eval report.
    """
    reasons: list[str] = []
    if card.lane is not Lane.PRODUCTION:
        reasons.append(f"lane is '{card.lane.value}', not production")
    if not card.commercial_ok:
        reasons.append(f"model license '{card.license}' is not commercial-OK")
    if not card.train_data_commercial_ok:
        reasons.append(
            f"training-data license '{card.train_data_license}' is not commercial-OK"
        )
    if require_eval and not card.eval_report:
        reasons.append("no eval report attached (engineering-doctrine D5)")
    return (not reasons, reasons)


def _coerce_card(d: dict) -> ModelCard:
    # train-data commercial flag defaults to the model flag when unspecified, but a model can
    # be commercial while its *training data* is not (the real trap) — so it is its own field.
    return ModelCard(
        name=d["name"],
        capability=d["capability"],
        provider=d.get("provider", "unknown"),
        license=d["license"],
        lane=Lane(d["lane"]),
        commercial_ok=bool(d["commercial_ok"]),
        train_data_commercial_ok=bool(
            d.get("train_data_commercial_ok", d["commercial_ok"])
        ),
        train_data_license=d.get("train_data_license", "unknown"),
        eval_report=d.get("eval_report"),
        model_uri=d.get("model_uri"),
        notes=d.get("notes", ""),
    )


def load_registry(path: str | Path = DEFAULT_REGISTRY) -> list[ModelCard]:
    """Parse the model registry manifest into cards. Accepts ``{"models": [...]}`` or a bare list."""
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    entries = data["models"] if isinstance(data, dict) else data
    return [_coerce_card(d) for d in entries]
