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

import re
from typing import Annotated, Literal

from gyf_contracts.consent import (
    BEHAVIORAL_LEARNING_PURPOSE,
    CONSENT_PURPOSES,
    DATA_PROCESSING_PURPOSE,
    LEGACY_PERSONALIZATION_PURPOSE,
    MARKETING_PURPOSE,
    PHOTO_STORAGE_PURPOSE,
)
from gyf_contracts.usermodel import (
    canonical_body_type,
    canonical_gender,
    canonical_skin_tone,
    canonical_undertone,
    is_occasion,
    is_style_intent,
)
from pydantic import BaseModel, Field, StrictBool, field_validator, model_validator
from pydantic.json_schema import SkipJsonSchema

# Manual onboarding asserts ground truth about oneself: full confidence.
MANUAL_CONFIDENCE = 1.0

PROFILE_FIELDS = (
    "skin_tone",
    "undertone",
    "body_type",
    "gender",
    "measurements",
    "style_intent",
    "budget_range",
    "occasion",
)

# Controlled set of consent keys the user can grant/revoke (CLAUDE.md §2 privacy).
# A closed vocabulary keeps the legal surface auditable; unknown keys are rejected.
CONSENT_KEYS = CONSENT_PURPOSES


ConsentBool = StrictBool | SkipJsonSchema[None]


def _consent_flags_schema(schema: dict[str, object]) -> None:
    properties = schema.get("properties")
    if isinstance(properties, dict):
        for prop in properties.values():
            if isinstance(prop, dict):
                prop.pop("default", None)
    schema["examples"] = [
        {
            DATA_PROCESSING_PURPOSE: True,
            BEHAVIORAL_LEARNING_PURPOSE: False,
            PHOTO_STORAGE_PURPOSE: False,
            MARKETING_PURPOSE: False,
        }
    ]


class ConsentFlags(BaseModel):
    """Canonical purpose-specific consent flags.

    Missing keys mean "leave this purpose unchanged".  Current clients must use
    ``behavioral_learning`` for the learning switch; the legacy ``personalization``
    key is translated only from stored historical rows, never accepted on writes.
    """

    model_config = {
        "extra": "forbid",
        "json_schema_extra": _consent_flags_schema,
    }

    data_processing: ConsentBool = None
    behavioral_learning: ConsentBool = None
    photo_storage: ConsentBool = None
    marketing: ConsentBool = None

    @model_validator(mode="before")
    @classmethod
    def _reject_legacy_purpose(cls, value: object) -> object:
        if isinstance(value, dict) and LEGACY_PERSONALIZATION_PURPOSE in value:
            raise ValueError(
                "unsupported consent purpose 'personalization'; use 'behavioral_learning'"
            )
        return value

    @field_validator(
        "data_processing",
        "behavioral_learning",
        "photo_storage",
        "marketing",
        mode="before",
    )
    @classmethod
    def _reject_null(cls, value: object) -> object:
        if value is None:
            raise ValueError("consent purpose values must be booleans")
        return value

    def as_update(self) -> dict[str, bool]:
        """Only the keys the client actually sent, preserving explicit ``false``."""

        return {
            k: bool(v) for k, v in self.model_dump(exclude_none=True, exclude_unset=True).items()
        }


class ConsentInput(BaseModel):
    """A partial consent update over canonical purpose keys.

    Unknown or legacy purpose keys fail validation instead of being silently
    dropped, so the API cannot report a false privacy state to the client.
    """

    model_config = {"extra": "forbid"}

    flags: ConsentFlags = Field(default_factory=ConsentFlags)


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

    model_config = {
        "extra": "forbid",
        "json_schema_extra": {
            "examples": [
                {
                    "skin_tone": "medium",
                    "undertone": "cool",
                    "body_type": "rectangle",
                    "style_intent": ["minimalist", "streetwear"],
                    "budget_range": {"max": 120, "currency": "USD"},
                    "occasion": "casual",
                }
            ]
        },
    }

    skin_tone: str | None = None
    undertone: str | None = None
    body_type: str | None = None
    gender: str | None = None
    measurements: dict[str, float] = Field(default_factory=dict)
    style_intent: list[str] = Field(default_factory=list)
    budget_range: BudgetRange | None = None
    occasion: str | None = None
    # Identity, not styling: stored on ``users`` (survives profile erasure), so it
    # never enters the Profile model or field_confidence — the router routes it to
    # the account repository. Whitespace-only clears; >60 chars is a 422.
    display_name: str | None = Field(default=None, max_length=60)
    # Also identity, also routed to `users` by the router (never entering
    # Profile/field_confidence): phone is collected at signup as a country
    # code (E.164 calling code, e.g. "+1") plus a national number, kept
    # separate so the UI can re-render a country picker without re-parsing a
    # combined string. avatar_url is metadata only — the client uploads the
    # image directly to Supabase Storage and only sends us the resulting URL.
    phone_country_code: str | None = Field(default=None, max_length=5)
    phone_number: str | None = Field(default=None, max_length=20)
    avatar_url: str | None = Field(default=None, max_length=2048)

    @field_validator("display_name", "phone_number", "avatar_url", mode="before")
    @classmethod
    def _trim_display_name(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = str(v).strip()
        return v or None

    @field_validator("phone_country_code", mode="before")
    @classmethod
    def _normalize_country_code(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = str(v).strip()
        if not v:
            return None
        if not v.startswith("+"):
            v = "+" + v
        if not re.fullmatch(r"\+[1-9][0-9]{0,3}", v):
            raise ValueError("phone_country_code must be an E.164 calling code, e.g. '+1'")
        return v

    @field_validator("skin_tone")
    @classmethod
    def _canon_skin_tone(cls, v: str | None) -> str | None:
        return canonical_skin_tone(v) if v is not None else None

    @field_validator("gender")
    @classmethod
    def _canon_gender(cls, v: str | None) -> str | None:
        return canonical_gender(v) if v is not None else None

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
    gender: str | None = None
    measurements: dict[str, float] = Field(default_factory=dict)
    style_intent: list[str] = Field(default_factory=list)
    budget_range: BudgetRange | None = None
    occasion: str | None = None
    source: str = "manual"
    field_confidence: dict[str, float] = Field(default_factory=dict)
    model_version: str | None = None


class PhotoAnalysis(BaseModel):
    """Only estimates freshly adopted from one photo upload."""

    skin_tone: str | None = None
    undertone: str | None = None
    body_type: str | None = None
    measurements: dict[str, float] = Field(default_factory=dict)
    field_confidence: dict[str, float] = Field(default_factory=dict)
    state: Literal["completed", "partial", "abstained"] = "abstained"
    reason: str


class ProfilePhotoResponse(Profile):
    """Merged profile plus fresh-only analysis metadata for this upload."""

    photo_analysis: PhotoAnalysis


def profile_from_manual(payload: ProfileInput, existing: Profile | None = None) -> Profile:
    """Build or partially update a stored profile from validated manual input.

    Records ``MANUAL_CONFIDENCE`` for each field the user actually supplied (a
    non-empty value), leaving skipped fields absent from ``field_confidence`` so
    the recommender can tell "stated unknown" from "not asked". On an update,
    omitted fields retain their stored values. Explicit null clears a nullable
    field; an empty collection or accepted empty string clears its field. Either
    form also removes that field's confidence.
    """
    # Out-of-vocabulary input canonicalizes to the "unknown" sentinel (not None).
    # Recording MANUAL_CONFIDENCE for it produced the prod contradiction: a stored
    # skin_tone of "unknown" at confidence 1.0. Treat a coerced-unknown as "not
    # stated" — no confidence, and store None so downstream can't read it as a
    # confident value. Genuine None (field skipped) is handled the same way.
    canonical: dict[str, str | None] = {}
    confidence: dict[str, float] = {}
    for field_name in ("skin_tone", "undertone", "body_type", "gender", "occasion"):
        value = getattr(payload, field_name)
        if value in (None, "unknown"):
            canonical[field_name] = None
            continue
        canonical[field_name] = value
        confidence[field_name] = MANUAL_CONFIDENCE
    if payload.measurements:
        confidence["measurements"] = MANUAL_CONFIDENCE
    if payload.style_intent:
        confidence["style_intent"] = MANUAL_CONFIDENCE
    if payload.budget_range is not None:
        confidence["budget_range"] = MANUAL_CONFIDENCE

    manual = Profile(
        skin_tone=canonical["skin_tone"],
        undertone=canonical["undertone"],
        body_type=canonical["body_type"],
        gender=canonical["gender"],
        measurements=payload.measurements,
        style_intent=payload.style_intent,
        budget_range=payload.budget_range,
        occasion=payload.occasion,
        source="manual",
        field_confidence=confidence,
        model_version=None,
    )
    if existing is None:
        return manual

    updated = existing.model_copy(deep=True)
    changed = payload.model_fields_set.intersection(PROFILE_FIELDS)
    for field_name in changed:
        setattr(updated, field_name, getattr(manual, field_name))
        if field_name in manual.field_confidence:
            updated.field_confidence[field_name] = MANUAL_CONFIDENCE
        else:
            updated.field_confidence.pop(field_name, None)
    # The schema has one coarse provenance pair, not per-field provenance. Manual
    # fields are confidence 1.0; while any lower-confidence estimate remains, keep
    # the photo model provenance. Clear it once the last estimate is corrected or
    # removed, or when a complete manual form replaces the profile.
    has_estimate = any(
        confidence < MANUAL_CONFIDENCE for confidence in updated.field_confidence.values()
    )
    if changed == set(PROFILE_FIELDS) or (updated.source == "photo" and not has_estimate):
        updated.source = "manual"
        updated.model_version = None
    return updated
