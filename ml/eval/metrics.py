"""Ranking metrics for retrieval evaluation (pure numpy).

``relevance`` rows are per-query binary relevance ordered by descending model
score (position 0 = top-ranked). This decouples the metrics from how rankings
were produced, so the same functions serve perception, recsys, and compatibility.
"""

from __future__ import annotations

import numpy as np


def reciprocal_rank(relevance_row: np.ndarray) -> float:
    """1 / rank of the first relevant item (0.0 if none retrieved)."""
    hits = np.flatnonzero(relevance_row)
    return 1.0 / (hits[0] + 1) if hits.size else 0.0


def mean_reciprocal_rank(relevance: np.ndarray) -> float:
    return float(np.mean([reciprocal_rank(row) for row in relevance]))


def recall_at_k(relevance: np.ndarray, k: int, total_relevant: np.ndarray) -> float:
    """Mean over queries of (relevant in top-k / total relevant for that query).

    Queries with no relevant items are skipped (undefined recall).
    """
    scores = []
    for row, total in zip(relevance, total_relevant):
        if total > 0:
            scores.append(float(row[:k].sum()) / float(total))
    return float(np.mean(scores)) if scores else 0.0
