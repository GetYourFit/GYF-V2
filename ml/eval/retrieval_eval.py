"""Perception retrieval evaluation.

Given item embeddings and a grouping label per item (e.g. the same product across
views, or a curated "visually similar" group from an open dataset such as
DeepFashion2 / Polyvore), evaluate image->image retrieval: for each item as a
query, items sharing its group are relevant. Reports MRR and Recall@K — the
offline signal that gates perception model candidates (promotion still requires
online eval, plan §4).
"""

from __future__ import annotations

import json
from collections.abc import Sequence
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np

from .metrics import mean_reciprocal_rank, recall_at_k


@dataclass(frozen=True)
class RetrievalReport:
    model_version: str
    num_queries: int
    mrr: float
    recall_at: dict[int, float] = field(default_factory=dict)

    def to_dict(self) -> dict[str, object]:
        return {
            "model_version": self.model_version,
            "num_queries": self.num_queries,
            "mrr": round(self.mrr, 4),
            "recall_at": {str(k): round(v, 4) for k, v in self.recall_at.items()},
        }


def evaluate_retrieval(
    embeddings: np.ndarray,
    groups: Sequence[object],
    *,
    model_version: str,
    ks: Sequence[int] = (1, 5, 10),
) -> RetrievalReport:
    """Leave-one-out image->image retrieval evaluation.

    ``embeddings`` is (N, dim) and assumed L2-normalized so a dot product is cosine
    similarity. Each item queries all others; relevant = same group label.
    """
    if embeddings.ndim != 2 or embeddings.shape[0] != len(groups):
        raise ValueError("embeddings must be (N, dim) aligned with groups")

    labels = np.asarray(groups, dtype=object)
    sims = embeddings @ embeddings.T
    np.fill_diagonal(sims, -np.inf)  # exclude self

    relevance_rows = []
    total_relevant = []
    for i in range(len(labels)):
        order = np.argsort(-sims[i])
        order = order[np.isfinite(sims[i][order])]  # drop the self position
        rel = (labels[order] == labels[i]).astype(np.int8)
        relevance_rows.append(rel)
        total_relevant.append(int(rel.sum()))

    relevance = np.array(relevance_rows)
    totals = np.array(total_relevant)
    return RetrievalReport(
        model_version=model_version,
        num_queries=len(labels),
        mrr=mean_reciprocal_rank(relevance),
        recall_at={k: recall_at_k(relevance, k, totals) for k in ks},
    )


def write_report(report: RetrievalReport, path: str | Path) -> Path:
    """Persist a report as JSON (versioned eval artifact)."""
    out = Path(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report.to_dict(), indent=2), encoding="utf-8")
    return out
