"""Canonical user-model vocabularies: body type, skin tone, undertone, occasion.

These are the shared source of truth for **both** sides of user modeling:

- Onboarding (``gyf-api``) validates manual input and stores body/skin-tone
  modules' predictions against these vocabularies.
- Recommendation & composition (``gyf-ml`` / ``gyf-api``, P1-C) conditions the
  ranker and the color-theory/body-type effects engine on the *same* labels, so
  a stated preference and an inferred attribute reconcile without a second,
  drifting copy.

Design notes:

- **Body type** uses the standard silhouette taxonomy (rectangle, triangle,
  inverted-triangle, hourglass, oval). It is deliberately gender-neutral so one
  vocabulary serves all users.
- **Skin tone** uses the 10-point **Monk Skin Tone (MST)** scale. The plan gates
  the skin-tone *module* on a full-spectrum MST fairness eval (P1-B Cycle 3);
  adopting MST here means the eval, the manual picker, and any future model all
  speak one scale. ``undertone`` is orthogonal to tone.
- Unknown / unprovided inputs map to the ``UNKNOWN_*`` sentinels rather than
  raising, so a partial manual profile is never rejected and nothing is silently
  coerced to a wrong value.
"""

from __future__ import annotations

# --- Body type (silhouette) ------------------------------------------------

UNKNOWN_BODY_TYPE = "unknown"
BODY_TYPES: frozenset[str] = frozenset(
    {
        "rectangle",
        "triangle",  # a.k.a. pear: hips wider than shoulders
        "inverted_triangle",  # shoulders wider than hips
        "hourglass",
        "oval",  # a.k.a. apple: fuller midsection
        UNKNOWN_BODY_TYPE,
    }
)

# --- Skin tone (Monk Skin Tone scale, MST1 lightest … MST10 deepest) -------

UNKNOWN_SKIN_TONE = "unknown"
SKIN_TONES: frozenset[str] = frozenset({f"mst{n}" for n in range(1, 11)} | {UNKNOWN_SKIN_TONE})

# --- Undertone (orthogonal to tone) ----------------------------------------

UNKNOWN_UNDERTONE = "unknown"
UNDERTONES: frozenset[str] = frozenset({"warm", "cool", "neutral", "olive", UNKNOWN_UNDERTONE})

# --- Occasion (first-class conditioning feature for recsys, P1-C) ----------

OCCASIONS: frozenset[str] = frozenset(
    {
        "casual",
        "business",
        "formal",
        "wedding",
        "festive",
        "party",
        "athleisure",
        "vacation",
    }
)

# --- Style intent (controlled aesthetic vocabulary) ------------------------

STYLE_INTENTS: frozenset[str] = frozenset(
    {
        "minimalist",
        "classic",
        "streetwear",
        "bohemian",
        "preppy",
        "edgy",
        "romantic",
        "sporty",
        "business_casual",
        "glam",
    }
)


def _canonical(value: str | None, vocabulary: frozenset[str], unknown: str) -> str:
    """Lowercase-normalize ``value`` and return it iff it is in ``vocabulary``.

    Returns ``unknown`` for ``None``, blank, or out-of-vocabulary input so a
    partial or imperfect profile is accepted rather than rejected.
    """
    if not value:
        return unknown
    normalized = value.strip().lower()
    return normalized if normalized in vocabulary else unknown


def canonical_body_type(value: str | None) -> str:
    """Canonical body type, or ``UNKNOWN_BODY_TYPE`` if unrecognized."""
    return _canonical(value, BODY_TYPES, UNKNOWN_BODY_TYPE)


def canonical_skin_tone(value: str | None) -> str:
    """Canonical MST skin tone, or ``UNKNOWN_SKIN_TONE`` if unrecognized."""
    return _canonical(value, SKIN_TONES, UNKNOWN_SKIN_TONE)


def canonical_undertone(value: str | None) -> str:
    """Canonical undertone, or ``UNKNOWN_UNDERTONE`` if unrecognized."""
    return _canonical(value, UNDERTONES, UNKNOWN_UNDERTONE)


def is_occasion(value: str) -> bool:
    """Whether ``value`` (case-insensitive) is a known occasion."""
    return value.strip().lower() in OCCASIONS


def is_style_intent(value: str) -> bool:
    """Whether ``value`` (case-insensitive) is a known style-intent label."""
    return value.strip().lower() in STYLE_INTENTS
