"""Eval harness tests — ranking metrics + perception retrieval evaluation."""

from __future__ import annotations

import numpy as np

from eval.metrics import recall_at_k, reciprocal_rank
from eval.retrieval_eval import evaluate_retrieval, write_report
from perception.model import l2_normalize


def test_reciprocal_rank():
    assert reciprocal_rank(np.array([1, 0, 0])) == 1.0
    assert reciprocal_rank(np.array([0, 0, 1])) == 1 / 3
    assert reciprocal_rank(np.array([0, 0, 0])) == 0.0


def test_recall_at_k_skips_queries_without_relevants():
    relevance = np.array([[1, 0, 1, 0], [0, 0, 0, 0]])
    totals = np.array([2, 0])
    assert recall_at_k(relevance, k=2, total_relevant=totals) == 0.5  # only first query counts


def test_perfect_clustering_scores_top():
    # Two tight clusters in 4-d: retrieval should rank same-group items first.
    base = np.array([[1, 0, 0, 0], [0.99, 0.05, 0, 0], [0, 0, 1, 0], [0, 0, 0.98, 0.1]])
    emb = l2_normalize(base.astype(np.float32))
    report = evaluate_retrieval(emb, ["a", "a", "b", "b"], model_version="v1")
    assert report.num_queries == 4
    assert report.mrr == 1.0  # nearest neighbour is always same-group
    assert report.recall_at[1] == 1.0


def test_report_roundtrip(tmp_path):
    emb = l2_normalize(np.eye(4, dtype=np.float32))
    report = evaluate_retrieval(emb, ["a", "b", "c", "d"], model_version="v1", ks=(1, 2))
    path = write_report(report, tmp_path / "report.json")
    assert path.exists()
    assert report.to_dict()["model_version"] == "v1"


def test_to_eval_report_clears_encoder_gate():
    from gyf_contracts.eval_report import meets_gate

    base = np.array([[1, 0, 0, 0], [0.99, 0.05, 0, 0], [0, 0, 1, 0], [0, 0, 0.98, 0.1]])
    emb = l2_normalize(base.astype(np.float32))
    report = evaluate_retrieval(emb, ["a", "a", "b", "b"], model_version="v1").to_eval_report(
        report_id="encoder-v1", dataset="unit"
    )
    assert report.capability == "encoder"
    assert report.metrics["mrr"] == 1.0
    assert "recall_at_1" in report.metrics  # recall_at flattened into the shared schema
    assert meets_gate(report)[0]


def test_shape_mismatch_raises():
    import pytest

    with pytest.raises(ValueError):
        evaluate_retrieval(np.zeros((3, 4)), ["a", "b"], model_version="v1")
