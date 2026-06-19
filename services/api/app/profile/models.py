"""Profile domain models for onboarding (P1-B Cycle 1, manual path).

A profile is the user-model record powering personalization (P1-C): skin tone,
undertone, body type, measurements, style intent, budget, and the occasion the
user is dressing for. Every field is optional — onboarding never blocks on a
field the user skips — and each stored field carries a confidence in
``field_confidence`` so the recommender can weight a hand-entered fact against a
model-inferred one.

The manual path (this module) records confidence ``1.0`` for every field the
user states (they are the ground truth about themselves); the photo path
(Cycle 2/3) will write model confidences instead. Inputs are validated against
the shared :mod:`gyf_contracts.usermodel` vocabularies and out-of-vocabulary
values are coerced to ``unknown`` rather than rejected.
"""

from __future__ import annotations

from typing import Annotated

from gyf_contracts.usermodel import (
    canonical_body_type,
    canonical_skin_tone,
    canonical_undertone,
    is_occasion,
    is_style_intent,
)
from pydantic import BaseModel, Field, field_validator

# Manual onboarding asserts ground truth about oneself: full confidence.
MANUAL_CONFIDENCE = 1.0

Money = Annotated[float, Field(ge=0)]


class BudgetRange(BaseModel):
    """A min/max spend band in a single currency (per-garment, not per-outfit)."""

    min: Money = 0.0
    max: Money | None = None
    currency: str = "USD"

    @field_validator("currency")
    @classmethod
    def _upper_currency(cls, v: str) -> str:
        return v.strip().upper()


class ProfileInput(BaseModel):
    """Manual onboarding input. Every field optional; unknowns coerced, not rejected.

    ``model_config`` forbids extra keys so a typo'd field surfaces as a 422 rather
    than being silently dropped into the void.
    """

    model_config = {"extra": "forbid"}

    skin_tone: str | None = None
    undertone: str | None = None
    body_type: str | None = None
    measurements: dict[str, float] = Field(default_factory=dict)
    style_intent: list[str] = Field(default_factory=list)
    budget_range: BudgetRange | None = None
    occasion: str | None = None

    @field_validator("skin_tone")
    @classmethod
    def _canon_skin_tone(cls, v: str | None) -> str | None:
        return canonical_skin_tone(v) if v is not None else None

    @field_validator("undertone")
    @classmethod
    def _canon_undertone(cls, v: str | None) -> str | None:
        return canonical_undertone(v) if v is not None else None

    @field_validator("body_type")
    @classmethod
    def _canon_body_type(cls, v: str | None) -> str | None:
        return canonical_body_type(v) if v is not None else None

    @field_validator("style_intent")
    @classmethod
    def _known_style_intents(cls, v: list[str]) -> list[str]:
        # Drop unrecognized aesthetics (keep order, dedupe) so the stored list is
        # always a clean subset of the controlled vocabulary.
        seen: set[str] = set()
        kept: list[str] = []
        for label in v:
            norm = label.strip().lower()
            if is_style_intent(norm) and norm not in seen:
                seen.add(norm)
                kept.append(norm)
        return kept

    @field_validator("occasion")
    @classmethod
    def _known_occasion(cls, v: str | None) -> str | None:
        if v is None:
            return None
        norm = v.strip().lower()
        return norm if is_occasion(norm) else None


class Profile(BaseModel):
    """A stored profile: input fields plus provenance and per-field confidence."""

    skin_tone: str | None = None
    undertone: str | None = None
    body_type: str | None = None
    measurements: dict[str, float] = Field(default_factory=dict)
    style_intent: list[str] = Field(default_factory=list)
    budget_range: BudgetRange | None = None
    occasion: str | None = None
    source: str = "manual"
    field_confidence: dict[str, float] = Field(default_factory=dict)
    model_version: str | None = None


def profile_from_manual(payload: ProfileInput) -> Profile:
    """Build a stored :class:`Profile` from validated manual onboarding input.

    Records ``MANUAL_CONFIDENCE`` for each field the user actually supplied (a
    non-empty value), leaving skipped fields absent from ``field_confidence`` so
    the recommender can tell "stated unknown" from "not asked".
    """
    confidence: dict[str, float] = {}
    for field_name in ("skin_tone", "undertone", "body_type", "occasion"):
        if getattr(payload, field_name) is not None:
            confidence[field_name] = MANUAL_CONFIDENCE
    if payload.measurements:
        confidence["measurements"] = MANUAL_CONFIDENCE
    if payload.style_intent:
        confidence["style_intent"] = MANUAL_CONFIDENCE
    if payload.budget_range is not None:
        confidence["budget_range"] = MANUAL_CONFIDENCE

    return Profile(
        skin_tone=payload.skin_tone,
        undertone=payload.undertone,
        body_type=payload.body_type,
        measurements=payload.measurements,
        style_intent=payload.style_intent,
        budget_range=payload.budget_range,
        occasion=payload.occasion,
        source="manual",
        field_confidence=confidence,
        model_version=None,
    )
