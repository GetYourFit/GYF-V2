"""Zero-shot garment attributes via the shared image/text encoder.

For each attribute we embed a set of natural-language candidate labels and pick
the one whose embedding is most similar to the image, with a softmax-calibrated
confidence (cosine sims scaled by the encoder's learned ``logit_scale``). Zero-
shot first (no training) gets us functional attributes immediately; a trained
head can replace any single attribute later without changing this interface or
the stored shape. Every value carries a confidence + model_version per schema.

Two design choices keep this rich *and* correct:

- **Category drives gating.** We predict the canonical garment category first
  (the same vocabulary the catalog uses — :mod:`gyf_contracts.taxonomy`), derive
  its outfit ``slot``, and only score the attributes that make sense for that
  slot. Asking a sneaker for its neckline is both wasteful and nonsensical, so we
  don't. This also means fewer matmuls per item across a catalog backfill.
- **Per-attribute prompt templates.** A caption tuned per attribute
  ("clothing made of {label}" for material vs. "a photo of a {label}" for
  category) measurably sharpens zero-shot accuracy.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from gyf_contracts.taxonomy import CATEGORIES

from .model import DEFAULT_LOGIT_SCALE, Encoder

CATEGORY = "category"  # the meta-attribute that selects which others apply

# Canonical category vocabulary and slot map come from the shared contract, so
# perception predicts into exactly the categories the catalog normalizes feeds
# into — no second, drifting copy.
_CATEGORY_NAMES: tuple[str, ...] = tuple(c.name for c in CATEGORIES)
_CATEGORY_SLOT: dict[str, str] = {c.name: c.slot for c in CATEGORIES}

# Slots for which the body-shape attributes (fit/silhouette/neckline/…) apply.
_WORN = frozenset({"top", "bottom", "full_body", "outerwear"})
_TOPS = frozenset({"top", "full_body"})
_SLEEVED = frozenset({"top", "full_body", "outerwear"})
_LENGTHED = frozenset({"bottom", "full_body"})


@dataclass(frozen=True)
class AttributeSpec:
    """A zero-shot attribute: its candidate labels, where it applies, its prompt.

    ``slots=None`` means the attribute applies to every garment; otherwise it is
    only scored when the predicted category's slot is in ``slots``. Output labels
    stay canonical; only the prompt humanizes underscores.
    """

    labels: tuple[str, ...]
    slots: frozenset[str] | None = None
    prompt: str = "a photo of {label} clothing"


# Registry of every attribute. Order is the canonical output order. Add an
# attribute by adding one entry here; nothing else changes.
ATTRIBUTE_SPECS: dict[str, AttributeSpec] = {
    CATEGORY: AttributeSpec(_CATEGORY_NAMES, None, "a photo of a {label}"),
    "pattern": AttributeSpec(
        ("solid", "striped", "checked", "floral", "graphic", "polka dot", "animal print"),
    ),
    "formality": AttributeSpec(
        ("casual", "smart casual", "business", "formal"), prompt="{label} clothing"
    ),
    "material": AttributeSpec(
        ("denim", "cotton", "knit", "silk", "leather", "wool", "linen", "lace", "velvet"),
        prompt="clothing made of {label}",
    ),
    "aesthetic": AttributeSpec(
        (
            "minimalist",
            "streetwear",
            "bohemian",
            "business formal",
            "ethnic traditional",
            "athleisure",
            "vintage",
            "preppy",
        ),
        prompt="{label} style clothing",
    ),
    "season": AttributeSpec(
        ("summer", "winter", "all-season"), prompt="{label} clothing"
    ),
    "target_audience": AttributeSpec(
        ("menswear", "womenswear", "unisex"), prompt="{label}"
    ),
    "fit": AttributeSpec(
        ("slim fit", "regular fit", "loose fit", "oversized"), _WORN, "{label} clothing"
    ),
    "silhouette": AttributeSpec(
        ("a-line", "bodycon", "straight", "wide-leg", "skinny", "tailored", "flowy", "boxy"),
        _WORN,
        "a {label} cut garment",
    ),
    "neckline": AttributeSpec(
        ("crew neck", "v-neck", "collared", "scoop neck", "halter", "turtleneck"),
        _TOPS,
        "clothing with a {label}",
    ),
    "sleeve": AttributeSpec(
        ("sleeveless", "short sleeve", "long sleeve", "three-quarter sleeve"),
        _SLEEVED,
        "clothing with {label}",
    ),
    "length": AttributeSpec(
        ("mini", "midi", "maxi", "cropped", "knee-length", "full-length"),
        _LENGTHED,
        "a {label} garment",
    ),
}


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

    Label-text embeddings are computed once per attribute and cached, so scoring
    reduces to a matrix multiply against the (already L2-normalized) image
    embedding — and the image forward pass, not these tiny text matmuls,
    dominates cost.
    """

    def __init__(self, encoder: Encoder, specs: dict[str, AttributeSpec] | None = None) -> None:
        self._encoder = encoder
        self._specs = specs or ATTRIBUTE_SPECS
        self._text_emb: dict[str, np.ndarray] = {}

    def _label_embeddings(self, attribute: str) -> np.ndarray:
        if attribute not in self._text_emb:
            spec = self._specs[attribute]
            prompts = [spec.prompt.format(label=label.replace("_", " ")) for label in spec.labels]
            self._text_emb[attribute] = self._encoder.encode_texts(prompts)
        return self._text_emb[attribute]

    @property
    def _temperature(self) -> float:
        # Scale cosine sims by the encoder's learned temperature so confidences are
        # calibrated, not near-uniform. Test doubles fall back to a sane default.
        return getattr(self._encoder, "logit_scale", DEFAULT_LOGIT_SCALE)

    def _score(self, attribute: str, image_embedding: np.ndarray, scale: float) -> AttributePrediction:
        sims = self._label_embeddings(attribute) @ image_embedding
        probs = _softmax(scale * sims)
        best = int(np.argmax(probs))
        return AttributePrediction(self._specs[attribute].labels[best], round(float(probs[best]), 4))

    def predict(self, image_embedding: np.ndarray) -> dict[str, AttributePrediction]:
        """Predict the applicable attributes for one L2-normalized image embedding.

        Category is always predicted first; its slot then selects which remaining
        attributes are scored, so the returned keys vary by garment (e.g. footwear
        has no neckline). Category is always present.
        """
        scale = self._temperature
        out: dict[str, AttributePrediction] = {CATEGORY: self._score(CATEGORY, image_embedding, scale)}
        slot = _CATEGORY_SLOT.get(out[CATEGORY].label, "unknown")
        for attribute, spec in self._specs.items():
            if attribute == CATEGORY:
                continue
            if spec.slots is None or slot in spec.slots:
                out[attribute] = self._score(attribute, image_embedding, scale)
        return out
