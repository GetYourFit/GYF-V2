"""Photo-onboarding adapters + profile merge (P1-B Cycles 2 & 3).

Bridges the API to the two user-model estimators in the ``gyf-ml`` runtime —
body-type (local RTMW keypoint geometry) and skin-tone (face-parse → CIELAB → MST) — behind
small Protocols, exactly like ``catalog/perception_adapter.py`` bridges perception.
Each adapter imports its heavy ml package lazily on construction, so the API runs
without those runtimes installed; ``main.py`` catches the ImportError and the
corresponding module simply abstains (the other still runs; manual is always there).

The adapters return transport results decoupled from the ml dataclasses, and
:func:`profile_from_photo` folds whichever ran into a stored :class:`Profile` with
``source="photo"``. A photo upload is an explicit re-estimate, so a non-abstaining
estimate overwrites that field; the returned estimate remains editable and a later
manual save can correct it.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from functools import lru_cache
from typing import Protocol

from .models import PhotoAnalysis, Profile, ProfilePhotoResponse

# Photo-derived fields are stamped with this provenance so the recommender (and the
# UI's "we estimated this — fix if wrong" affordance) can tell them from manual input.
PHOTO_SOURCE = "photo"


@dataclass(frozen=True)
class SkinToneResult:
    """Transport result of the skin-tone module (decoupled from the ml dataclass)."""

    skin_tone: str
    undertone: str
    field_confidence: dict[str, float] = field(default_factory=dict)
    model_version: str = ""


@dataclass(frozen=True)
class BodyResult:
    """Transport result of the body-type module (decoupled from the ml dataclass)."""

    body_type: str
    measurements: dict[str, float] = field(default_factory=dict)
    field_confidence: dict[str, float] = field(default_factory=dict)
    model_version: str = ""


class SkinToneAdapter(Protocol):
    def estimate(self, image: object) -> SkinToneResult: ...


class BodyAdapter(Protocol):
    def estimate(self, image: object) -> BodyResult: ...


class FaceParsingSkinToneAdapter:
    """Bridge to the local research-only ``usermodel.skintone`` pipeline."""

    def __init__(self) -> None:
        # Import here so an ImportError surfaces only when this adapter is built;
        # main.py turns that into a graceful per-module abstain.
        from usermodel.skintone import FaceParsingSkinToneEstimator, estimate_skin_tone

        local = FaceParsingSkinToneEstimator()
        self._run = lambda img: estimate_skin_tone(img, local)

    def estimate(self, image: object) -> SkinToneResult:
        est = self._run(image)
        return SkinToneResult(
            skin_tone=est.skin_tone,
            undertone=est.undertone,
            field_confidence=dict(est.field_confidence),
            model_version=est.model_version,
        )


class RTMWBodyAdapter:
    """Bridge to the clean CPU RTMW keypoint-ratio body candidate."""

    def __init__(self) -> None:
        from usermodel.body import RTMWBodyEstimator, estimate_body

        self._estimate = estimate_body
        self._estimator = RTMWBodyEstimator()

    def estimate(self, image: object) -> BodyResult:
        est = self._estimate(image, self._estimator)
        return BodyResult(
            body_type=est.body_type,
            measurements=dict(est.measurements),
            field_confidence=dict(est.field_confidence),
            model_version=est.model_version,
        )


@lru_cache(maxsize=1)
def cached_skin_adapter() -> FaceParsingSkinToneAdapter:
    """Process-wide singleton for offline research/evaluation."""
    return FaceParsingSkinToneAdapter()


@lru_cache(maxsize=1)
def cached_body_adapter() -> RTMWBodyAdapter:
    """Process-wide singleton so the RTMW model loads once."""
    return RTMWBodyAdapter()


def _adopt(
    profile: ProfilePhotoResponse,
    analysis: PhotoAnalysis,
    field_name: str,
    value: object,
    confidence: float,
    *,
    unknown: str | None,
) -> bool:
    """Write a real photo ``value`` onto ``profile.field_name`` (explicit re-estimate).

    Skips only genuine abstains: empty / ``unknown`` sentinel values, or a
    zero-confidence guess (D6 honesty — a module that emits a sentinel-free fallback
    label whose quality collapsed to 0.0 must not surface). Otherwise the estimate
    **wins and fills the field**: uploading a photo is an explicit user request to
    (re)estimate, so it overwrites a prior value rather than being silently
    suppressed — the value stays editable and is badged "Estimated" in the UI, so
    the user can correct it before saving (which re-stamps it as manual, conf 1.0).
    Returns whether the field was adopted.
    """
    if value is None or value == "" or (unknown is not None and value == unknown):
        return False
    if confidence <= 0.0:
        return False
    setattr(profile, field_name, value)
    setattr(analysis, field_name, value)
    rounded = round(confidence, 4)
    profile.field_confidence[field_name] = rounded
    analysis.field_confidence[field_name] = rounded
    return True


def profile_from_photo(
    *,
    skin: SkinToneResult | None,
    body: BodyResult | None,
    existing: Profile | None = None,
) -> ProfilePhotoResponse:
    """Fold whichever modules ran into a stored profile (explicit re-estimate).

    Starts from the user's ``existing`` profile (so manual fields and untouched
    values survive) and overwrites each field for which a module produced a
    non-abstaining estimate. The fields stay editable. Stamps ``source="photo"``
    and a combined ``model_version`` from the modules that contributed.
    """
    analysis = PhotoAnalysis(reason="Continue with the manual fields.")
    profile = ProfilePhotoResponse(
        **(existing.model_dump(exclude={"photo_analysis"}) if existing is not None else {}),
        photo_analysis=analysis,
    )
    versions: list[str] = []

    if skin is not None:
        sc = skin.field_confidence
        _adopt(
            profile,
            analysis,
            "skin_tone",
            skin.skin_tone,
            sc.get("skin_tone", 0.0),
            unknown="unknown",
        )
        _adopt(
            profile,
            analysis,
            "undertone",
            skin.undertone,
            sc.get("undertone", 0.0),
            unknown="unknown",
        )
        if skin.model_version:
            versions.append(skin.model_version)

    if body is not None:
        bc = body.field_confidence
        _adopt(
            profile,
            analysis,
            "body_type",
            body.body_type,
            bc.get("body_type", 0.0),
            unknown="unknown",
        )
        _adopt(
            profile,
            analysis,
            "measurements",
            body.measurements,
            bc.get("measurements", 0.0),
            unknown=None,
        )
        if body.model_version:
            versions.append(body.model_version)

    profile.source = PHOTO_SOURCE
    profile.model_version = "+".join(versions) if versions else profile.model_version
    if analysis.skin_tone and analysis.body_type:
        analysis.state = "completed"
        analysis.reason = "Review both estimates before continuing."
    elif analysis.field_confidence:
        analysis.state = "partial"
        analysis.reason = "Review the estimate and complete the missing fields manually."
    return profile
