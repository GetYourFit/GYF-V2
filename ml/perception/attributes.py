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
- **Per-attribute prompt ensembling.** Each attribute carries a small set of
  caption templates tuned to it ("clothing made of {label}" for material vs.
  "a photo of a {label}" for category); we embed every (label × template) caption
  and average per label — the standard CLIP/SigLIP zero-shot accuracy lift — at no
  per-image cost (the averaged label embeddings are cached once).
- **Honest abstention.** Each prediction reports ``certain``: when its calibrated
  confidence falls below the attribute's ``min_confidence`` floor, the argmax
  label is kept (for debuggability) but flagged uncertain, so downstream never
  acts on a low-confidence guess. Errors concentrate in this tail (per feedback),
  so this is where "honest confidence" earns its keep.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from gyf_contracts.taxonomy import CATEGORIES

from .model import DEFAULT_LOGIT_SCALE, Encoder, l2_normalize

CATEGORY = "category"  # the meta-attribute that selects which others apply
DEFAULT_MIN_CONFIDENCE = 0.35  # below this, a prediction is flagged uncertain

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
    """A zero-shot attribute: candidate labels, where it applies, prompts, floor.

    ``slots=None`` means the attribute applies to every garment; otherwise it is
    only scored when the predicted category's slot is in ``slots``. ``prompts`` is
    an ensemble of caption templates averaged per label. ``min_confidence`` is the
    calibrated-probability floor below which a prediction is flagged uncertain.
    Output labels stay canonical; only the prompt humanizes underscores.
    """

    labels: tuple[str, ...]
    slots: frozenset[str] | None = None
    prompts: tuple[str, ...] = ("a photo of {label} clothing",)
    min_confidence: float = DEFAULT_MIN_CONFIDENCE


# Registry of every attribute. Order is the canonical output order. Add an
# attribute by adding one entry here; nothing else changes.
ATTRIBUTE_SPECS: dict[str, AttributeSpec] = {
    CATEGORY: AttributeSpec(
        _CATEGORY_NAMES, None, ("a photo of a {label}", "a product photo of a {label}")
    ),
    "pattern": AttributeSpec(
        ("solid", "striped", "checked", "floral", "graphic", "polka dot", "animal print"),
        prompts=("a photo of {label} clothing", "a garment with a {label} pattern"),
    ),
    "formality": AttributeSpec(
        ("casual", "smart casual", "business", "formal"),
        prompts=("{label} clothing", "a photo of {label} attire"),
    ),
    "material": AttributeSpec(
        ("denim", "cotton", "knit", "silk", "leather", "wool", "linen", "lace", "velvet"),
        prompts=("clothing made of {label}", "a photo of a {label} garment"),
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
        prompts=("{label} style clothing", "a photo of {label} fashion"),
    ),
    "season": AttributeSpec(
        ("summer", "winter", "all-season"),
        prompts=("{label} clothing", "clothing for {label} wear"),
    ),
    "target_audience": AttributeSpec(
        ("menswear", "womenswear", "unisex"),
        prompts=("{label}", "a photo of {label}"),
    ),
    "fit": AttributeSpec(
        ("slim fit", "regular fit", "loose fit", "oversized"),
        _WORN,
        ("{label} clothing", "a {label} garment"),
    ),
    "silhouette": AttributeSpec(
        ("a-line", "bodycon", "straight", "wide-leg", "skinny", "tailored", "flowy", "boxy"),
        _WORN,
        ("a {label} cut garment", "a garment with a {label} silhouette"),
    ),
    "neckline": AttributeSpec(
        ("crew neck", "v-neck", "collared", "scoop neck", "halter", "turtleneck"),
        _TOPS,
        ("clothing with a {label}", "a top with a {label}"),
    ),
    "sleeve": AttributeSpec(
        ("sleeveless", "short sleeve", "long sleeve", "three-quarter sleeve"),
        _SLEEVED,
        ("clothing with {label}", "a {label} top"),
    ),
    "length": AttributeSpec(
        ("mini", "midi", "maxi", "cropped", "knee-length", "full-length"),
        _LENGTHED,
        ("a {label} garment", "a {label} length garment"),
    ),
}


@dataclass(frozen=True)
class AttributePrediction:
    label: str
    confidence: float
    certain: bool


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
        """Ensembled, L2-normalized text embedding per label — computed once.

        Embeds every (label × template) caption, then averages the templates per
        label so each label is represented by one robust vector.
        """
        if attribute not in self._text_emb:
            spec = self._specs[attribute]
            captions = [
                prompt.format(label=label.replace("_", " "))
                for label in spec.labels
                for prompt in spec.prompts
            ]
            embs = self._encoder.encode_texts(captions)  # (n_labels * n_prompts, dim)
            embs = embs.reshape(len(spec.labels), len(spec.prompts), -1)
            self._text_emb[attribute] = l2_normalize(embs.mean(axis=1))  # (n_labels, dim)
        return self._text_emb[attribute]

    @property
    def _temperature(self) -> float:
        # Scale cosine sims by the encoder's learned temperature so confidences are
        # calibrated, not near-uniform. Test doubles fall back to a sane default.
        return getattr(self._encoder, "logit_scale", DEFAULT_LOGIT_SCALE)

    def _score(
        self, attribute: str, image_embedding: np.ndarray, scale: float
    ) -> AttributePrediction:
        spec = self._specs[attribute]
        sims = self._label_embeddings(attribute) @ image_embedding
        probs = _softmax(scale * sims)
        best = int(np.argmax(probs))
        confidence = round(float(probs[best]), 4)
        return AttributePrediction(spec.labels[best], confidence, confidence >= spec.min_confidence)

    def predict(self, image_embedding: np.ndarray) -> dict[str, AttributePrediction]:
        """Predict the applicable attributes for one L2-normalized image embedding.

        Category is always predicted first; its slot then selects which remaining
        attributes are scored, so the returned keys vary by garment (e.g. footwear
        has no neckline). Category is always present.
        """
        scale = self._temperature
        out: dict[str, AttributePrediction] = {
            CATEGORY: self._score(CATEGORY, image_embedding, scale)
        }
        slot = _CATEGORY_SLOT.get(out[CATEGORY].label, "unknown")
        for attribute, spec in self._specs.items():
            if attribute == CATEGORY:
                continue
            if spec.slots is None or slot in spec.slots:
                out[attribute] = self._score(attribute, image_embedding, scale)
        return out
