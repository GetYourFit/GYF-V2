"""M2 encoder bake-off harness — comparison + incumbent-relative ranking, with fakes (no weights)."""

from __future__ import annotations

import numpy as np

from eval.compare import compare_encoders, rank_candidates
from perception.model import l2_normalize


class _FakeEncoder:
    """Returns fixed, pre-normalized embeddings — lets us script who wins the bake-off."""

    dim = 4
    logit_scale = 100.0

    def __init__(self, embeddings: np.ndarray) -> None:
        self._emb = l2_normalize(embeddings.astype(np.float32))

    def encode_images(self, images: list) -> np.ndarray:
        return self._emb

    def encode_texts(self, texts: list) -> np.ndarray:  # pragma: no cover - unused here
        return self._emb


# Perfect clustering → MRR 1.0; scrambled → poor MRR.
_PERFECT = np.array([[1, 0, 0, 0], [0.99, 0.05, 0, 0], [0, 0, 1, 0], [0, 0, 0.98, 0.1]])
_POOR = np.array([[1, 0, 0, 0], [0, 0, 1, 0], [0, 1, 0, 0], [0, 0, 0, 1]])
_GROUPS = ["a", "a", "b", "b"]
_IMAGES = [None] * 4  # fakes ignore the pixels


def _reports():
    encoders = {
        "incumbent-v1": _FakeEncoder(_PERFECT),
        "candidate-weak": _FakeEncoder(_POOR),
    }
    return compare_encoders(encoders, _IMAGES, _GROUPS, dataset="unit")


def test_compare_emits_one_report_per_encoder():
    reports = _reports()
    assert set(reports) == {"incumbent-v1", "candidate-weak"}
    assert reports["incumbent-v1"].capability == "encoder"
    assert reports["incumbent-v1"].report_id == "encoder-incumbent-v1"
    assert reports["incumbent-v1"].metrics["mrr"] == 1.0


def test_weak_candidate_does_not_beat_incumbent():
    ranked = rank_candidates(_reports(), incumbent="incumbent-v1")
    by_version = {r.model_version: r for r in ranked}
    assert by_version["incumbent-v1"].beats_incumbent is False  # never beats itself
    assert by_version["candidate-weak"].beats_incumbent is False
    assert any("regressed" in r for r in by_version["candidate-weak"].reasons)
    # leaderboard is best-first by the gate metric
    assert ranked[0].model_version == "incumbent-v1"


def test_strong_candidate_beats_incumbent():
    encoders = {
        "incumbent-v1": _FakeEncoder(_POOR),
        "candidate-strong": _FakeEncoder(_PERFECT),
    }
    reports = compare_encoders(encoders, _IMAGES, _GROUPS, dataset="unit")
    ranked = rank_candidates(reports, incumbent="incumbent-v1")
    winner = next(r for r in ranked if r.model_version == "candidate-strong")
    assert winner.beats_incumbent is True and winner.reasons == []
    assert ranked[0].model_version == "candidate-strong"


def test_unknown_incumbent_raises():
    import pytest

    with pytest.raises(ValueError):
        rank_candidates(_reports(), incumbent="nope")
