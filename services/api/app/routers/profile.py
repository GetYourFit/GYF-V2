"""Profile surface — onboarding (manual + photo), consent, account lifecycle, summary."""

from __future__ import annotations

import io
import logging

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from starlette.concurrency import run_in_threadpool

from ..auth import Principal, get_current_principal
from ..config import settings
from ..dependencies import (
    get_account_repo,
    get_body_adapter,
    get_profile_repo,
    get_skin_adapter,
    get_summary_repo,
    require_active_principal,
)
from ..profile.account import AccountRepository
from ..profile.models import ConsentInput, Profile, ProfileInput, profile_from_manual
from ..profile.photo import BodyAdapter, SkinToneAdapter, profile_from_photo
from ..profile.repository import ProfileRepository
from ..profile.summary import (
    ProfileSummary,
    SummaryRepository,
    fallback_display_name,
    summarize,
)
from ..ratelimit import rate_limit

router = APIRouter(tags=["profile"])

_log = logging.getLogger("gyf.photo")

_ACCEPTED_PHOTO_TYPES = frozenset({"image/jpeg", "image/png", "image/webp"})

# A generous ceiling for genuine phone photos (~40 MP covers 48 MP sensors after
# downscale) that still rejects decompression bombs — a few-KB file that inflates
# to gigapixels and exhausts memory. ``Image.open`` reads the dimensions from the
# header without decoding pixels, so we reject BEFORE ``load()`` does the work.
_MAX_IMAGE_PIXELS = 40_000_000


@router.get("/profile")
def read_profile(
    principal: Principal = Depends(require_active_principal),
    repo: ProfileRepository = Depends(get_profile_repo),
) -> Profile:
    """The authenticated user's profile. 404 before onboarding completes."""
    profile = repo.get(principal.user_id)
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No profile yet")
    return profile


@router.put("/profile")
def upsert_profile(
    payload: ProfileInput,
    principal: Principal = Depends(require_active_principal),
    repo: ProfileRepository = Depends(get_profile_repo),
    account_repo: AccountRepository = Depends(get_account_repo),
) -> Profile:
    """Manual onboarding / edit: validate, stamp confidences, persist, return it.

    Idempotent upsert keyed by the authenticated user — the same call updates an
    existing profile, so the always-editable-preferences requirement is satisfied.

    ``display_name`` is identity, not styling: it is routed to the ``users`` row
    (surviving profile erasure) and only touched when the client actually sent
    the field — an omitted key never clears an existing name.
    """
    profile = profile_from_manual(payload)
    repo.upsert(principal.user_id, profile)
    if "display_name" in payload.model_fields_set:
        account_repo.set_display_name(principal.user_id, payload.display_name)
    return profile


@router.delete("/profile", status_code=status.HTTP_204_NO_CONTENT)
def delete_profile(
    principal: Principal = Depends(require_active_principal),
    repo: ProfileRepository = Depends(get_profile_repo),
) -> Response:
    """Erase the user's profile (keeps the account). Idempotent: 204 either way."""
    repo.delete(principal.user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/profile/photo",
    summary="Onboard from a photo",
    dependencies=[Depends(rate_limit("photo", "rate_limit_photo"))],
)
async def upsert_profile_from_photo(
    photo: UploadFile = File(..., description="A clear, well-lit photo of the user."),
    principal: Principal = Depends(require_active_principal),
    profile_repo: ProfileRepository = Depends(get_profile_repo),
    account_repo: AccountRepository = Depends(get_account_repo),
    skin_adapter: SkinToneAdapter | None = Depends(get_skin_adapter),
    body_adapter: BodyAdapter | None = Depends(get_body_adapter),
) -> Profile:
    """Estimate skin tone + undertone and body type from one photo, merge into the profile.

    Consent-gated (`data_processing` required). The image is processed **in memory
    and is ephemeral** — bytes are never logged and never persisted here. Each module **abstains** if its ml
    runtime is unavailable, so the endpoint still succeeds with whatever ran; the
    manual `PUT /profile` is always the fallback. Skin-tone is held in **shadow**
    (computed, not surfaced) until the fairness gate flips `skin_tone_enabled`.
    Every estimated field stays editable and never overwrites a higher-confidence
    manual value.
    """
    if not account_repo.get_consent(principal.user_id).get("data_processing", False):
        raise HTTPException(status_code=403, detail="data_processing consent required")

    if photo.content_type not in _ACCEPTED_PHOTO_TYPES:
        raise HTTPException(status_code=415, detail="unsupported image type (use jpeg, png, webp)")

    raw = await photo.read(settings.max_photo_bytes + 1)
    if len(raw) > settings.max_photo_bytes:
        raise HTTPException(status_code=413, detail="image too large")
    if not raw:
        raise HTTPException(status_code=422, detail="empty upload")

    # Defence in depth: the client-supplied content_type is spoofable, so verify the
    # actual leading bytes are a real JPEG/PNG/WebP before PIL ever parses them — a
    # crafted file with an image MIME header must not reach the decoder (M-4).
    if not _is_supported_image(raw):
        raise HTTPException(status_code=415, detail="unsupported image type (use jpeg, png, webp)")

    # Decode + inference are CPU-bound (PIL, local torch) or block on a remote GPU
    # Space for seconds. This is the only `async def` route, so running that work
    # inline would stall the event loop for every other concurrent request. Offload
    # it to the threadpool (where all the plain `def` routes already run).
    image = await run_in_threadpool(_decode_photo, raw)

    # Each module abstains on ANY runtime failure (remote Space down, weights/runtime
    # missing, decode error), not just an import error at build time — a flaky or
    # not-yet-deployed module must never 500 the whole onboarding; the other module
    # still runs and the manual path is always the fallback.
    skin = await run_in_threadpool(_estimate_or_abstain, skin_adapter, image, "skin-tone")
    body = await run_in_threadpool(_estimate_or_abstain, body_adapter, image, "body-type")
    if skin is None and body is None:
        raise HTTPException(status_code=503, detail="photo onboarding unavailable")

    # Shadow gate (D5/D6): skin-tone is computed but not surfaced until it passes
    # the fairness eval and the flag is flipped.
    surfaced_skin = skin if settings.skin_tone_enabled else None

    existing = profile_repo.get(principal.user_id)
    profile = profile_from_photo(skin=surfaced_skin, body=body, existing=existing)
    profile_repo.upsert(principal.user_id, profile)

    # Observability at the decision point (no PII — only which modules ran, the coarse
    # outcome, and adoption confidences). Lets a "fields didn't fill" report be diagnosed
    # from `render logs` instead of guesswork: a present field with positive confidence
    # means the API handed the browser a real value (so any gap is frontend/cache), while
    # an absent field means the module abstained on this photo.
    _log.info(
        "photo onboarding outcome: skin_ran=%s body_ran=%s skin_tone=%s undertone=%s "
        "body_type=%s confidences=%s",
        skin is not None,
        body is not None,
        bool(profile.skin_tone),
        bool(profile.undertone),
        bool(profile.body_type),
        profile.field_confidence,
    )
    return profile


@router.get("/consent")
def read_consent(
    principal: Principal = Depends(require_active_principal),
    repo: AccountRepository = Depends(get_account_repo),
) -> dict[str, bool]:
    """The user's current consent flags."""
    return repo.get_consent(principal.user_id)


@router.put("/consent")
def update_consent(
    payload: ConsentInput,
    principal: Principal = Depends(require_active_principal),
    repo: AccountRepository = Depends(get_account_repo),
) -> dict[str, bool]:
    """Grant/revoke consent. Merges known flags; unknown keys are ignored."""
    return repo.update_consent(principal.user_id, payload.flags)


@router.delete("/account", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    principal: Principal = Depends(get_current_principal),
    repo: AccountRepository = Depends(get_account_repo),
) -> Response:
    """Right-to-erasure: tombstone the account now; a purge job hard-deletes it
    (cascading) after the grace window. Idempotent — re-requesting is a no-op."""
    repo.soft_delete(principal.user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/profile/summary", summary="Profile stats, badges & identity")
def profile_summary(
    principal: Principal = Depends(require_active_principal),
    repo: SummaryRepository = Depends(get_summary_repo),
    account_repo: AccountRepository = Depends(get_account_repo),
) -> ProfileSummary:
    """Stats (outfits made, items saved, wardrobe size, posts, reactions) + badges,
    plus identity: the user-set display name (falling back to the email local-part),
    email, and member-since date — all real account data, never invented."""
    summary = summarize(repo, principal.user_id)
    name, created_at = account_repo.get_identity(principal.user_id)
    summary.display_name = name or fallback_display_name(principal.email)
    summary.email = principal.email
    summary.member_since = created_at.date().isoformat() if hasattr(created_at, "date") else None
    return summary


# --- Photo helpers (module-private) ----------------------------------------


def _estimate_or_abstain(adapter: object | None, image: object, label: str) -> object | None:
    """Run a photo-module adapter, turning any runtime failure into an honest abstain.

    Build-time import errors are already handled by the get_*_adapter providers; this
    catches *call*-time failures (a remote Space down, a missing local runtime that
    only errors on first use) so one module never takes the endpoint down.
    """
    if adapter is None:
        return None
    try:
        return adapter.estimate(image)  # type: ignore[attr-defined]
    except Exception:  # noqa: BLE001 — any module failure must degrade to abstain, not 500
        _log.warning("%s estimation failed; abstaining", label, exc_info=True)
        return None


def _is_supported_image(raw: bytes) -> bool:
    """True iff the leading bytes are a real JPEG, PNG, or WebP signature.

    Magic-byte sniff, independent of the (spoofable) declared content type. WebP is
    a RIFF container: ``RIFF`` at 0 and ``WEBP`` at 8.
    """
    if len(raw) < 12:
        return False
    if raw[:3] == b"\xff\xd8\xff":  # JPEG
        return True
    if raw[:8] == b"\x89PNG\r\n\x1a\n":  # PNG
        return True
    if raw[:4] == b"RIFF" and raw[8:12] == b"WEBP":  # WebP
        return True
    return False


def _decode_photo(raw: bytes) -> object:
    """Decode bytes to an orientation-corrected, EXIF-stripped RGB image.

    Applies EXIF orientation then re-bakes pixels so no camera metadata (incl. GPS)
    survives into anything downstream — privacy by construction (D8). Guards against
    decompression bombs by rejecting oversized images before pixels are decoded.
    """
    from PIL import Image, ImageOps

    try:
        with Image.open(io.BytesIO(raw)) as img:
            width, height = img.size
            if width * height > _MAX_IMAGE_PIXELS:
                raise HTTPException(
                    status_code=422,
                    detail="image resolution is too large — please use a normal photo",
                )
            img.load()
            return ImageOps.exif_transpose(img).convert("RGB")
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001 — any decode failure is a bad upload
        raise HTTPException(status_code=422, detail="could not decode image") from exc
