"""Perception tests — color, zero-shot attributes, perceive, and backfill.

A FakeEncoder provides deterministic embeddings so the logic around the encoder
is tested without downloading Marqo-FashionSigLIP weights (the heavy SigLIP path
is exercised separately, offline, when weights are available).
"""

from __future__ import annotations

from collections.abc import Iterator

import numpy as np
from PIL import Image

from perception.attributes import (
    ATTRIBUTE_SPECS,
    CATEGORY,
    AttributeExtractor,
    AttributeSpec,
)
from perception.color import dominant_color
from perception.model import EMBEDDING_DIM, l2_normalize
from perception.perceive import PerceptionResult, Perceptor
from pipelines.backfill import (
    BackfillResult,
    PendingItem,
    run_backfill,
    to_pgvector,
)


class FakeEncoder:
    """Maps inputs to deterministic unit vectors in a tiny space."""

    dim = 4

    def __init__(self) -> None:
        # text label -> assigned basis-ish vector, so a matching image can be steered.
        self._texts: dict[str, np.ndarray] = {}

    def encode_images(self, images):
        return l2_normalize(np.array([[1.0, 0.0, 0.0, 0.0]] * len(images), dtype=np.float32))

    def encode_texts(self, texts):
        out = []
        for i, t in enumerate(texts):
            v = np.zeros(4, dtype=np.float32)
            v[i % 4] = 1.0
            out.append(v)
        return l2_normalize(np.array(out, dtype=np.float32))


def _solid_image(rgb=(200, 30, 30)) -> Image.Image:
    return Image.new("RGB", (32, 32), rgb)


# --- color ---


def test_dominant_color_reds_resolve_to_red_hue():
    color = dominant_color(_solid_image((200, 30, 30)))
    assert color.hue_name == "red"
    assert 0 <= color.lch[2] <= 360
    assert color.lab[0] > 0  # lightness


def test_dominant_color_neutral_is_named_grayscale():
    assert dominant_color(_solid_image((10, 10, 10))).hue_name == "black"
    assert dominant_color(_solid_image((250, 250, 250))).hue_name == "white"


# --- attributes ---


def test_attribute_extractor_predicts_category_and_valid_labels():
    extractor = AttributeExtractor(FakeEncoder())
    img_emb = FakeEncoder().encode_images([_solid_image()])[0]
    preds = extractor.predict(img_emb)

    assert CATEGORY in preds  # category is always present
    assert set(preds) <= set(ATTRIBUTE_SPECS)  # only known attributes
    for name, pred in preds.items():
        assert pred.label in ATTRIBUTE_SPECS[name].labels
        assert 0.0 <= pred.confidence <= 1.0


def test_attribute_extractor_gates_by_category_slot():
    """A garment is only scored for attributes that fit its slot.

    The FakeEncoder steers the prediction to a 'top' category, which must surface
    a neckline but never a length (length applies only to bottoms/full-body).
    """
    preds = AttributeExtractor(FakeEncoder()).predict(
        FakeEncoder().encode_images([_solid_image()])[0]
    )
    assert preds[CATEGORY].label in ATTRIBUTE_SPECS[CATEGORY].labels
    assert "neckline" in preds  # tops get a neckline
    assert "length" not in preds  # ...but never a length (bottoms/full-body only)


def test_attribute_confidence_uses_encoder_logit_scale():
    """A learned temperature must sharpen confidence; a tiny one flattens it.

    Locks in the SigLIP calibration fix: raw cosine sims are near-uniform under
    softmax, so the encoder's logit_scale must be applied before softmax.
    """

    class ScaledEncoder(FakeEncoder):
        def __init__(self, logit_scale: float) -> None:
            super().__init__()
            self.logit_scale = logit_scale

    img_emb = FakeEncoder().encode_images([_solid_image()])[0]
    # Minimal registry: a single-label category (so a slot resolves) plus a
    # 'pattern' with distinct labels where one candidate clearly wins.
    specs = {
        CATEGORY: AttributeSpec(("dress",), None, "a photo of a {label}"),
        "pattern": AttributeSpec(("a", "b", "c", "d")),
    }
    sharp = AttributeExtractor(ScaledEncoder(100.0), specs).predict(img_emb)["pattern"]
    flat = AttributeExtractor(ScaledEncoder(0.01), specs).predict(img_emb)["pattern"]
    assert sharp.confidence > 0.9  # peaked
    assert flat.confidence < 0.3  # near-uniform over 4 labels (~0.25)


# --- perceive ---


def test_perceptor_combines_embedding_attributes_color():
    result = Perceptor(FakeEncoder()).perceive(_solid_image())
    assert len(result.embedding) == 4
    block = result.attributes_block("v1")["perception"]
    assert block["model_version"] == "v1"
    assert CATEGORY in block["attributes"]
    assert set(block["attributes"]) <= set(ATTRIBUTE_SPECS)
    assert block["color"]["hue_name"] == "red"


def test_embedding_dim_matches_schema_constant():
    assert EMBEDDING_DIM == 768


# --- backfill ---


def test_to_pgvector_format():
    assert to_pgvector([1.0, 2.5, 0.0]) == "[1.0,2.5,0.0]"


class InMemoryBackfillStore:
    def __init__(self, items: list[PendingItem]) -> None:
        self._items = items
        self.saved: dict[str, PerceptionResult] = {}

    def pending(self, model_version, limit) -> Iterator[PendingItem]:
        todo = [i for i in self._items if i.item_id not in self.saved]
        yield from (todo[:limit] if limit else todo)

    def save(self, item_id, result, model_version) -> None:
        self.saved[item_id] = result


def test_backfill_processes_loadable_and_skips_broken(monkeypatch):
    items = [
        PendingItem("a", ["ok-a"]),
        PendingItem("b", ["broken", "ok-b"]),  # first ref fails, second works
        PendingItem("c", ["broken-only"]),
    ]
    store = InMemoryBackfillStore(items)

    def loader(ref: str) -> Image.Image:
        if ref.startswith("broken"):
            raise OSError("cannot load")
        return _solid_image()

    result = run_backfill(store, Perceptor(FakeEncoder()), loader, "v1")
    assert isinstance(result, BackfillResult)
    assert result.processed == 2  # a and b
    assert result.skipped == 1  # c
    assert set(store.saved) == {"a", "b"}


def test_backfill_is_resumable_after_partial_progress():
    items = [PendingItem("a", ["ok"]), PendingItem("b", ["ok"])]
    store = InMemoryBackfillStore(items)
    store.saved["a"] = Perceptor(FakeEncoder()).perceive(_solid_image())  # already done

    result = run_backfill(store, Perceptor(FakeEncoder()), lambda r: _solid_image(), "v1")
    assert result.processed == 1  # only b remained
