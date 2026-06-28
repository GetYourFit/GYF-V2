"""Photo-onboarding adapters + profile merge (P1-B Cycles 2 & 3).

Bridges the API to the two user-model estimators in the ``gyf-ml`` runtime —
body-type (SAM 3D Body → MHR) and skin-tone (face-parse → CIELAB → MST) — behind
small Protocols, exactly like ``catalog/perception_adapter.py`` bridges perception.
Each adapter imports its heavy ml package lazily on construction, so the API runs
without those runtimes installed; ``main.py`` catches the ImportError and the
corresponding module simply abstains (the other still runs; manual is always there).

The adapters return transport results decoupled from the ml dataclasses, and
:func:`profile_from_photo` folds whichever ran into a stored :class:`Profile` with
``source="photo"`` and a **merge policy that never overwrites a higher-confidence
field** — so a value the user stated by hand (confidence 1.0) always wins over a
model guess, satisfying the always-editable invariant.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from functools import lru_cache
from typing import Protocol

from .models import Profile

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
    """Bridge to ``usermodel.skintone`` (RetinaFace + FaRL + CIELAB).

    When ``remote_url`` is set the whole pipeline runs on the ZeroGPU Space (the API
    host needs no pyfacer/torch); otherwise it runs in-process. Either way the result
    is the same :class:`SkinToneResult`.
    """

    def __init__(self, *, remote_url: str = "", hf_token: str | None = None) -> None:
        # Import here so an ImportError surfaces only when this adapter is built;
        # main.py turns that into a graceful per-module abstain.
        if remote_url:
            from usermodel.skintone.remote import RemoteSkinToneEstimator

            remote = RemoteSkinToneEstimator(remote_url, hf_token=hf_token)
            self._run = remote.estimate
        else:
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


class SilhouetteBodyAdapter:
    """Bridge to ``usermodel.body`` (BiRefNet silhouette + RTMW keypoints → widths).

    The shape estimator is selected by :func:`usermodel.body.body_estimator_for`:
    the remote ZeroGPU lane when ``remote_url`` is set (the API host needs no
    BiRefNet / RTMW / GPU), else the CPU-capable local baseline. The
    widths→ratios→silhouette-class taxonomy always runs in-process.
    """

    def __init__(self, *, remote_url: str = "", hf_token: str | None = None) -> None:
        from usermodel.body import body_estimator_for, estimate_body

        self._estimate = estimate_body
        self._estimator = body_estimator_for(remote_url, hf_token=hf_token)

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
    """Process-wide singleton. ``GYF_SKINTONE_REMOTE_URL`` routes to the ZeroGPU Space."""
    from ..config import settings

    return FaceParsingSkinToneAdapter(
        remote_url=settings.skintone_remote_url, hf_token=settings.hf_token or None
    )


@lru_cache(maxsize=1)
def cached_body_adapter() -> SilhouetteBodyAdapter:
    """Process-wide singleton so the models load once.

    Reads the GPU-lane config: ``GYF_BODY_REMOTE_URL`` routes segmentation + pose to
    the ZeroGPU Space, ``GYF_HF_TOKEN`` authenticates the Space quota.
    """
    from ..config import settings

    return SilhouetteBodyAdapter(
        remote_url=settings.body_remote_url, hf_token=settings.hf_token or None
    )


def _adopt(
    profile: Profile,
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
    profile.field_confidence[field_name] = round(confidence, 4)
    return True


def profile_from_photo(
    *,
    skin: SkinToneResult | None,
    body: BodyResult | None,
    existing: Profile | None = None,
) -> Profile:
    """Fold whichever modules ran into a stored profile (merge-by-confidence).

    Starts from the user's ``existing`` profile (so manual fields and untouched
    values survive) and overlays photo estimates only where they are present and
    more confident. Stamps ``source="photo"`` and a combined ``model_version`` from
    the modules that contributed.
    """
    profile = existing.model_copy(deep=True) if existing is not None else Profile()
    versions: list[str] = []

    if skin is not None:
        sc = skin.field_confidence
        _adopt(profile, "skin_tone", skin.skin_tone, sc.get("skin_tone", 0.0), unknown="unknown")
        _adopt(profile, "undertone", skin.undertone, sc.get("undertone", 0.0), unknown="unknown")
        if skin.model_version:
            versions.append(skin.model_version)

    if body is not None:
        bc = body.field_confidence
        _adopt(profile, "body_type", body.body_type, bc.get("body_type", 0.0), unknown="unknown")
        _adopt(
            profile, "measurements", body.measurements, bc.get("measurements", 0.0), unknown=None
        )
        if body.model_version:
            versions.append(body.model_version)

    profile.source = PHOTO_SOURCE
    profile.model_version = "+".join(versions) if versions else profile.model_version
    return profile
