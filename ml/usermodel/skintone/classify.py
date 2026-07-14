"""Map a CIELAB skin readout to a Monk Skin Tone bucket + undertone (pure).

Deliberately explainable (no black-box CNN): tone comes from ``L*`` against
per-bucket anchors, undertone from the ``a*``/``b*`` balance. Explainability is a
fairness feature — we can audit *why* a tone was assigned, and the anchors are a
single, reviewable table rather than opaque weights.

⚠ The ``L*`` anchors below are **provisional**, pending calibration against a
balanced full-MST image set (``fairness_eval.py``). Until that gate passes, the
module runs in shadow (computed, not surfaced) — see
PROGRESS.md (p1b cycle 3, skin tone).
"""

from __future__ import annotations

from gyf_contracts.usermodel import UNKNOWN_SKIN_TONE, UNKNOWN_UNDERTONE

# Provisional L* anchor per MST bucket (lightest mst1 → deepest mst10). Roughly
# even perceptual spacing across the lightness range observed for facial skin.
_MST_ANCHORS: list[tuple[str, float]] = [
    ("mst1", 90.0),
    ("mst2", 82.0),
    ("mst3", 74.0),
    ("mst4", 66.0),
    ("mst5", 58.0),
    ("mst6", 50.0),
    ("mst7", 42.0),
    ("mst8", 34.0),
    ("mst9", 27.0),
    ("mst10", 20.0),
]

# Half the spacing between adjacent anchors (~4 L*): a reading this far from its
# nearest anchor sits exactly between two buckets → confidence 0.5.
_ANCHOR_HALF_STEP = 4.0

# Below this, abstain to "unknown" rather than present a guessed tone (D6 honesty).
MIN_TONE_CONFIDENCE = 0.45


def lab_to_mst(L: float, a: float, b: float) -> tuple[str, float]:
    """Nearest MST bucket by ``L*`` + a distance-based confidence in [0, 1]."""
    bucket, anchor_L = min(_MST_ANCHORS, key=lambda kv: abs(kv[1] - L))
    distance = abs(anchor_L - L)
    confidence = max(0.0, 1.0 - distance / (2 * _ANCHOR_HALF_STEP))
    if confidence < MIN_TONE_CONFIDENCE:
        return UNKNOWN_SKIN_TONE, confidence
    return bucket, confidence


def lab_to_undertone(a: float, b: float) -> tuple[str, float]:
    """Warm / cool / neutral / olive from the ``a*``/``b*`` balance.

    Warm skin skews yellow (high ``b*``), cool skews pink/blue (``b*`` low
    relative to ``a*``), olive carries a green-yellow cast (``b*`` high, ``a*``
    low). Confidence grows with the margin between the leading signal and neutral.
    """
    # Neutral band: small chroma in both axes.
    if abs(b) < 6.0 and abs(a) < 6.0:
        return "neutral", 0.6
    if b >= 12.0 and a < 8.0:
        return "olive", min(1.0, (b - 12.0) / 12.0 + 0.5)
    if b > a:
        return "warm", min(1.0, (b - a) / 20.0 + 0.5)
    if a >= b:
        return "cool", min(1.0, (a - b) / 20.0 + 0.5)
    return UNKNOWN_UNDERTONE, 0.4
