"""Run the full perception step on a garment image.

Combines the three perception signals — the SigLIP embedding (for retrieval +
compatibility), zero-shot attributes, and CIELAB color — into one
:class:`PerceptionResult`. This is the unit the backfill pipeline persists: an
embedding into ``item_embeddings`` and the attribute/color block (each value with
a confidence) merged into ``items.attributes``.
"""

from __future__ import annotations

from dataclasses import dataclass

from PIL.Image import Image

from .attributes import AttributeExtractor
from .color import GarmentColor, dominant_color
from .model import Encoder


@dataclass(frozen=True)
class PerceptionResult:
    embedding: list[float]
    attributes: dict[str, dict[str, object]]  # name -> {value, confidence}
    color: GarmentColor

    def attributes_block(self, model_version: str) -> dict[str, object]:
        """Shape written into items.attributes (model-tagged, confidence-bearing)."""
        return {
            "perception": {
                "model_version": model_version,
                "attributes": self.attributes,
                "color": {
                    "lab": list(self.color.lab),
                    "lch": list(self.color.lch),
                    "hue_name": self.color.hue_name,
                    "rgb": list(self.color.rgb),
                },
            }
        }


class Perceptor:
    """Embeds + attributes + colors garment images using one shared encoder."""

    def __init__(self, encoder: Encoder, extractor: AttributeExtractor | None = None) -> None:
        self._encoder = encoder
        self._extractor = extractor or AttributeExtractor(encoder)

    def perceive(self, image: Image) -> PerceptionResult:
        embedding = self._encoder.encode_images([image])[0]
        preds = self._extractor.predict(embedding)
        return PerceptionResult(
            embedding=[float(x) for x in embedding],
            attributes={
                name: {"value": p.label, "confidence": p.confidence, "certain": p.certain}
                for name, p in preds.items()
            },
            color=dominant_color(image),
        )
