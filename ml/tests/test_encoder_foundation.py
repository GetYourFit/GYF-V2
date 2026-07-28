"""No-weight regression tests for the encoder foundation harness."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pytest

from eval.encoder_foundation import (
    cosine_topk_parity,
    retrieval_truth,
    validate_embeddings,
)


FIXTURE = Path(__file__).parent / "fixtures" / "encoder_foundation.json"


def test_fixture_pins_incumbent_contract() -> None:
    data = json.loads(FIXTURE.read_text())
    assert data["model_version"] == "google-siglip2-base-v1"
    assert data["dimension"] == 768
    assert data["gates"]["india_uncached_p95_seconds"] == 3.0
    assert {item for query in data["queries"] for item in query["relevant_ids"]} <= set(
        data["eligible_catalogue_ids"]
    )


def test_validate_embeddings_rejects_bad_shape_norm_and_nan() -> None:
    good = np.zeros((2, 4), dtype=np.float32)
    good[:, 0] = 1.0
    validate_embeddings(good, dim=4)
    with pytest.raises(AssertionError):
        validate_embeddings(np.zeros((2, 3), dtype=np.float32), dim=4)
    with pytest.raises(AssertionError):
        validate_embeddings(np.ones((2, 4), dtype=np.float32), dim=4)
    bad = good.copy()
    bad[0, 0] = np.nan
    with pytest.raises(AssertionError):
        validate_embeddings(bad, dim=4)


def test_cosine_topk_parity_is_one_for_identical_vectors() -> None:
    vectors = np.eye(4, dtype=np.float32)
    assert cosine_topk_parity(vectors, vectors, k=2) == 1.0


def test_retrieval_truth_rejects_unknown_ids() -> None:
    retrieval_truth(["item-a", "item-b"], {"item-a", "item-b"})
    with pytest.raises(AssertionError):
        retrieval_truth(["item-a", "unavailable"], {"item-a"})
