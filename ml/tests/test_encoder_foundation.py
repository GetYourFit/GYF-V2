"""No-weight regression tests for the encoder foundation harness."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pytest

from eval.encoder_foundation import (
    RuntimeBudget,
    RuntimeMeasurement,
    assert_runtime_budget,
    cosine_topk_parity,
    measure_text_runtime,
    retrieval_truth,
    validate_artifact_sha256,
    validate_embeddings,
)
from perception.remote import FallbackEncoder


FIXTURE = Path(__file__).parent / "fixtures" / "encoder_foundation.json"


class _FakeEncoder:
    dim = 4

    def __init__(self, rows: np.ndarray | None = None) -> None:
        self._rows = (
            rows if rows is not None else np.array([[1.0, 0.0, 0.0, 0.0]], dtype=np.float32)
        )
        self.calls = 0

    def encode_texts(self, texts: list[str]) -> np.ndarray:
        self.calls += 1
        return np.repeat(self._rows, len(texts), axis=0)

    def encode_images(self, images: list[object]) -> np.ndarray:
        return np.repeat(self._rows, len(images), axis=0)


class _DeadEncoder(_FakeEncoder):
    def encode_texts(self, texts: list[str]) -> np.ndarray:
        self.calls += 1
        raise RuntimeError("remote unavailable")


def test_ml_defaults_derive_from_the_canonical_runtime_binding() -> None:
    from common.config import Settings
    from gyf_contracts.eval_report import RUNTIME_MODELS

    binding = RUNTIME_MODELS["encoder"]
    assert Settings().perception_model == binding.model_uri
    assert Settings().perception_model_version == binding.model_version


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


def test_cosine_topk_parity_clamps_k_to_fixture_size() -> None:
    vectors = np.eye(3, dtype=np.float32)
    assert cosine_topk_parity(vectors, vectors, k=10) == 1.0


def test_retrieval_truth_rejects_unknown_ids() -> None:
    retrieval_truth(["item-a", "item-b"], {"item-a", "item-b"})
    with pytest.raises(AssertionError):
        retrieval_truth(["item-a", "unavailable"], {"item-a"})


def test_measure_text_runtime_uses_conservative_p95(monkeypatch) -> None:
    encoder = _FakeEncoder()
    samples = iter([0.0, 1.0, 1.1, 1.3, 1.6, 2.0, 2.6, 3.5, 4.7, 6.2, 8.0, 10.4])
    monkeypatch.setattr("eval.encoder_foundation.time.perf_counter", lambda: next(samples))

    measurement = measure_text_runtime(encoder, ["a", "b"], repeats=5)

    assert measurement.cold_seconds == 1.0
    assert measurement.warm_p50_seconds == pytest.approx(0.9)
    assert measurement.warm_p95_seconds == pytest.approx(2.4)
    assert measurement.cold_cpu_seconds >= 0
    assert measurement.warm_cpu_p95_seconds >= 0
    assert measurement.items_per_second == pytest.approx(2 / 1.08)


def test_runtime_budget_checks_wall_cpu_and_rss() -> None:
    measurement = RuntimeMeasurement(1.0, 0.1, 0.2, 0.3, 0.15, 2, 10.0, 100)
    assert_runtime_budget(measurement, RuntimeBudget(1.0, 0.3, 0.2, 100))
    with pytest.raises(AssertionError, match="warm_p95=.*warm_cpu_p95=.*rss="):
        assert_runtime_budget(measurement, RuntimeBudget(0.9, 0.1, 0.1, 99))


@pytest.mark.parametrize("value", ["", "a" * 63, "A" * 64, "g" * 64])
def test_artifact_hash_validation_rejects_missing_or_malformed_values(value: str) -> None:
    with pytest.raises(AssertionError, match="SHA-256"):
        validate_artifact_sha256(value)


def test_artifact_hash_validation_accepts_a_sha256() -> None:
    validate_artifact_sha256("a" * 64)


def test_fallback_encoder_demotes_to_local_baseline() -> None:
    local = _FakeEncoder()
    encoder = FallbackEncoder(_DeadEncoder(), lambda: local)

    out = encoder.encode_texts(["dress"])

    assert out.shape == (1, 4)
    assert encoder.lane == "local"
    assert "remote unavailable" in encoder.fallback_reason
    assert local.calls == 1
