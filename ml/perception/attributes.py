"""Zero-shot garment attributes via the shared image/text encoder.

For each attribute (pattern, formality, fit) we embed a set of natural-language
candidate labels and pick the one whose embedding is most similar to the image,
with a softmax-calibrated confidence. Zero-shot first (no training) gets us
functional attributes immediately; a trained head can replace any single
attribute later without changing this interface or the stored shape. Every value
carries a confidence + model_version per the schema convention.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .model import Encoder

# Candidate label spaces. Prompt templating turns each label into a caption the
# fashion-tuned text encoder understands.
ATTRIBUTE_LABELS: dict[str, list[str]] = {
    "pattern": ["solid", "striped", "checked", "floral", "graphic", "polka dot", "animal print"],
    "formality": ["casual", "smart casual", "business", "formal"],
    "fit": ["slim fit", "regular fit", "loose fit", "oversized"],
}
_PROMPT = "a photo of {label} clothing"


@dataclass(frozen=True)
class AttributePrediction:
    label: str
    confidence: float


def _softmax(x: np.ndarray) -> np.ndarray:
    z = x - x.max()
    e = np.exp(z)
    return e / e.sum()


class AttributeExtractor:
    """Predicts garment attributes for image embeddings, zero-shot.

    Label-text embeddings are computed once and cached per extractor instance, so
    scoring a batch of items is a matrix multiply.
    """

    def __init__(self, encoder: Encoder, labels: dict[str, list[str]] | None = None) -> None:
        self._encoder = encoder
        self._labels = labels or ATTRIBUTE_LABELS
        self._text_emb: dict[str, np.ndarray] = {}

    def _label_embeddings(self, attribute: str) -> np.ndarray:
        if attribute not in self._text_emb:
            prompts = [_PROMPT.format(label=label) for label in self._labels[attribute]]
            self._text_emb[attribute] = self._encoder.encode_texts(prompts)
        return self._text_emb[attribute]

    def predict(self, image_embedding: np.ndarray) -> dict[str, AttributePrediction]:
        """Predict every attribute for one L2-normalized image embedding."""
        out: dict[str, AttributePrediction] = {}
        for attribute, labels in self._labels.items():
            sims = self._label_embeddings(attribute) @ image_embedding
            probs = _softmax(sims)
            best = int(np.argmax(probs))
            out[attribute] = AttributePrediction(labels[best], round(float(probs[best]), 4))
        return out
