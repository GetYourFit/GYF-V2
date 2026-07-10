"""Extract virtual-try-on training pairs from the GYF catalog.

A VTON model learns from *paired* data: ``(flat/hanger shot of a garment, the same
garment worn by a person)``. The catalog already has both — items average ~7 images
each — but ``image_refs`` is a bare list with no label saying which shot is which.

This module recovers the split with a signal GYF already computes: the **body
estimator detects people**. An item image with a detected body is an *on-model* shot;
one without is a *flat* shot. Pair the two within the same item and you have a training
example — no new labelling, no VITON-HD/DressCode (so the resulting checkpoint is
commercial-clean; see docs/plans/free-vton-moat.md).

The person detector is injected (a ``PersonDetector``) so the pure pairing logic tests
without torch and the heavy GPU detection can run wherever the GPU is (Kaggle). Running
this over the catalog answers the make-or-break question: *how many real pairs do we
have?* — the number that decides whether the fine-tune is worth it.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Iterable, Protocol


@dataclass(frozen=True)
class VtonPair:
    """One training example: a garment's flat shot + the same garment on a person."""

    item_id: str
    flat_ref: str
    on_model_ref: str


class PersonDetector(Protocol):
    """Is there a person in this image? ``None`` = couldn't decide (skip the image)."""

    def has_person(self, image_ref: str) -> bool | None: ...


# ponytail: pair each on-model shot with the FIRST flat shot only. A garment needs one
# clean reference, not every hanger angle; the cartesian product would balloon the set
# with near-duplicate flats. Widen to all-flats only if the fine-tune is data-starved.
def pair_item(item_id: str, image_refs: Iterable[str], detector: PersonDetector) -> list[VtonPair]:
    """Split an item's images into flat vs on-model, then pair them.

    Returns an empty list unless the item has at least one flat AND one on-model shot
    (only then is it a usable training example). Images the detector can't decide on
    (``has_person`` → ``None``) are dropped, never guessed — a wrong flat/on-model label
    poisons the training pair.
    """
    flats: list[str] = []
    on_models: list[str] = []
    for ref in image_refs:
        verdict = detector.has_person(ref)
        if verdict is True:
            on_models.append(ref)
        elif verdict is False:
            flats.append(ref)
        # None → undecided → skip
    if not flats or not on_models:
        return []
    reference_flat = flats[0]
    return [VtonPair(item_id, reference_flat, on_model) for on_model in on_models]


def extract_pairs(
    items: Iterable[tuple[str, list[str]]], detector: PersonDetector
) -> list[VtonPair]:
    """Flatten :func:`pair_item` over ``(item_id, image_refs)`` rows from the catalog."""
    return [pair for item_id, refs in items for pair in pair_item(item_id, refs, detector)]


class BodyEstimatorPersonDetector:
    """``PersonDetector`` backed by the body estimator (its confidence *is* the signal).

    ``model_confidence > 0`` means a body was found (see body/estimator.py, which returns
    0.0 when it finds none). GPU-heavy — this is the part that runs on Kaggle. The image
    loader is injected so this stays storage-agnostic (local path, HTTP, Supabase).
    """

    def __init__(
        self, estimator: object, load_image: Callable[[str], object], min_confidence: float = 0.0
    ) -> None:
        self._estimator = estimator
        self._load = load_image
        self._min = min_confidence

    def has_person(self, image_ref: str) -> bool | None:
        try:
            image = self._load(image_ref)
        except Exception:  # noqa: BLE001 — an unreadable image is undecidable, not on/off-model
            return None
        if image is None:
            return None
        estimate = self._estimator.estimate(image)  # type: ignore[attr-defined]
        return estimate.model_confidence > self._min


def _demo() -> None:
    """Self-check the pure pairing logic with a fake detector (no torch, no GPU)."""

    class Fake:
        def __init__(self, people: set[str]) -> None:
            self._people = people

        def has_person(self, ref: str) -> bool | None:
            if ref.endswith("?"):
                return None  # undecidable
            return ref in self._people

    # item A: one flat + two on-model → two pairs (both share the first flat)
    pairs = pair_item("A", ["flat1", "model1", "model2"], Fake({"model1", "model2"}))
    assert pairs == [
        VtonPair("A", "flat1", "model1"),
        VtonPair("A", "flat1", "model2"),
    ], pairs
    # item B: flat only → no pair
    assert pair_item("B", ["flat1", "flat2"], Fake(set())) == []
    # item C: on-model only → no pair
    assert pair_item("C", ["model1"], Fake({"model1"})) == []
    # undecidable images are skipped, not guessed
    assert pair_item("D", ["flat1", "model1", "weird?"], Fake({"model1"})) == [
        VtonPair("D", "flat1", "model1")
    ]
    # extract_pairs flattens across items
    rows = [("A", ["flat1", "model1"]), ("B", ["flat1"])]
    assert extract_pairs(rows, Fake({"model1"})) == [VtonPair("A", "flat1", "model1")]
    print("vton_pairs self-check OK")


if __name__ == "__main__":
    _demo()
