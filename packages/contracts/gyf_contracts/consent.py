"""Canonical consent-purpose vocabulary shared by API, client types and ML exports.

Only canonical purposes may be written by current clients.  Historical rows may
still contain ``personalization`` from the pre-audit learning switch; read paths
translate that legacy key to ``behavioral_learning`` only when the canonical key
is absent so an explicit opt-out is never turned back on silently.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

DATA_PROCESSING_PURPOSE = "data_processing"
BEHAVIORAL_LEARNING_PURPOSE = "behavioral_learning"
PHOTO_STORAGE_PURPOSE = "photo_storage"
MARKETING_PURPOSE = "marketing"
LEGACY_PERSONALIZATION_PURPOSE = "personalization"

CONSENT_PURPOSES: frozenset[str] = frozenset(
    {
        DATA_PROCESSING_PURPOSE,
        BEHAVIORAL_LEARNING_PURPOSE,
        PHOTO_STORAGE_PURPOSE,
        MARKETING_PURPOSE,
    }
)

LEGACY_CONSENT_ALIASES: dict[str, str] = {
    LEGACY_PERSONALIZATION_PURPOSE: BEHAVIORAL_LEARNING_PURPOSE,
}


def _to_bool(value: Any) -> bool:
    """Coerce stored JSON-ish values without making string ``"false"`` truthy."""

    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return bool(value)


def normalize_consent_flags(flags: Mapping[str, Any] | None) -> dict[str, bool]:
    """Return canonical consent flags, translating legacy stored aliases safely.

    Canonical keys win over legacy aliases.  This lets a user who later saves
    ``behavioral_learning=True`` override an old ``personalization=False`` row,
    while an account that only has legacy ``personalization=False`` remains opted
    out until the user explicitly changes it.
    """

    if not flags:
        return {}
    normalized: dict[str, bool] = {}
    for purpose in CONSENT_PURPOSES:
        if purpose in flags:
            normalized[purpose] = _to_bool(flags[purpose])
    for legacy, canonical in LEGACY_CONSENT_ALIASES.items():
        if canonical not in normalized and legacy in flags:
            normalized[canonical] = _to_bool(flags[legacy])
    return normalized


def behavioral_learning_enabled(flags: Mapping[str, Any] | None) -> bool:
    """Whether behaviour may feed taste/history/export learning.

    Existing accounts predate the switch, so absent consent remains allowed; only
    an explicit canonical or translated legacy ``False`` opts the user out.
    """

    return normalize_consent_flags(flags).get(BEHAVIORAL_LEARNING_PURPOSE, True) is not False
