"""Encoder bake-off — compare embedding candidates against the incumbent (M2).

The doctrine says models are commodities and evaluation is the moat: we never assume a newer
encoder is better, we *measure* it on the same data and promote only a proven winner. This module
evaluates every candidate encoder with the same image->image retrieval protocol as the shipped
encoder (:func:`evaluate_retrieval`), emits one canonical :class:`EvalReport` per candidate, and
ranks them against a named incumbent using the M1 regression gate
(:func:`gyf_contracts.eval_report.is_improvement`).

Pure orchestration: it takes already-constructed :class:`~perception.model.Encoder` objects, so it
unit-tests with fakes (no weights) and runs the real bake-off with :class:`SiglipEncoder`s
unchanged.
"""

from __future__ import annotations

from dataclasses import dataclass

from gyf_contracts.eval_report import EvalReport, is_improvement

from perception.model import Encoder

from .retrieval_eval import evaluate_retrieval


def compare_encoders(
    encoders: dict[str, "Encoder"],
    images: list,
    groups: list,
    *,
    dataset: str,
    ks: tuple[int, ...] = (1, 5, 10),
) -> dict[str, EvalReport]:
    """Evaluate each named encoder on the same retrieval set; return one report per encoder.

    ``encoders`` maps a model version (e.g. ``"google-siglip2-base-v1"``) to an encoder. Every
    encoder embeds the *same* images and is scored against the *same* group labels, so the reports
    are directly comparable. ``report_id`` is ``encoder-<version>``, matching the registry
    convention so a winner's report drops straight into ``eval-reports/``.
    """
    reports: dict[str, EvalReport] = {}
    for version, encoder in encoders.items():
        embeddings = encoder.encode_images(images)
        raw = evaluate_retrieval(embeddings, groups, model_version=version, ks=ks)
        reports[version] = raw.to_eval_report(
            report_id=f"encoder-{version}",
            dataset=dataset,
            notes="Bake-off candidate (M2). Promote only if it beats the incumbent.",
        )
        # Release this encoder's weights before loading the next so candidates are not all
        # co-resident (peak memory = one model, not the whole field). Fakes have no `unload`.
        unload = getattr(encoder, "unload", None)
        if callable(unload):
            unload()
    return reports


@dataclass(frozen=True)
class Ranked:
    """A candidate's standing in the bake-off, relative to the incumbent."""

    model_version: str
    report: EvalReport
    beats_incumbent: bool
    reasons: list[str]  # why it does/doesn't beat the incumbent (empty when it wins)


def rank_candidates(reports: dict[str, EvalReport], *, incumbent: str) -> list[Ranked]:
    """Rank reports best-first on the capability's gate metric, with a beats-incumbent verdict.

    The incumbent itself is included (it trivially does not "beat" itself: ``beats_incumbent``
    False). A candidate wins only if :func:`is_improvement` holds — i.e. it does not regress the
    incumbent on the gate metric. Sorting is by that metric descending for a readable leaderboard.
    """
    if incumbent not in reports:
        raise ValueError(f"incumbent '{incumbent}' not among reports {list(reports)}")
    base = reports[incumbent]
    from gyf_contracts.eval_report import GATES

    metric = GATES[base.capability].metric
    ranked = []
    for version, report in reports.items():
        if version == incumbent:
            ranked.append(Ranked(version, report, beats_incumbent=False, reasons=["is incumbent"]))
            continue
        better, reasons = is_improvement(report, base)
        ranked.append(Ranked(version, report, beats_incumbent=better, reasons=reasons))
    return sorted(ranked, key=lambda r: r.report.metrics.get(metric, float("-inf")), reverse=True)
