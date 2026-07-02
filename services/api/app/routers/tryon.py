"""Virtual try-on (M9) — see the complete designed look on *your* body.

POST /tryon dresses the caller's photo in a recommended outfit's garments via
the configured :class:`TryOnRenderer` port. The photo is consent-gated,
validated like onboarding uploads, processed **in memory, ephemerally** (never
persisted, never logged — D8), and the response carries the doctrine's honest
trio: the render (or an abstention), a calibrated confidence, and exactly which
garments made it onto the body.
"""

from __future__ import annotations

import base64
import io

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from ..auth import Principal
from ..catalog.directory import ItemDirectory
from ..config import settings
from ..dependencies import (
    get_account_repo,
    get_event_sink,
    get_item_directory,
    get_tryon_renderer,
    require_active_principal,
)
from ..events import InteractionAction, InteractionEvent, InteractionTarget
from ..profile.account import AccountRepository
from ..ratelimit import rate_limit
from ..sink import EventSink
from ..tryon import TryOnGarment, TryOnRenderer
from .profile import _ACCEPTED_PHOTO_TYPES, _decode_photo, _is_supported_image

router = APIRouter(tags=["tryon"])

_MAX_GARMENTS = 4


class TryOnResponse(BaseModel):
    """A render or an honest abstention — never a fabricated image."""

    # Base64 PNG of the dressed look; null when the renderer abstained.
    image_b64: str | None
    confidence: float
    model_version: str
    # Slots actually dressed (e.g. footwear is honestly skipped by the beta lane).
    rendered_slots: list[str]
    # Human-readable reason whenever the render is absent or partial.
    reason: str


@router.post(
    "/tryon",
    summary="Render an outfit on the user's photo",
    dependencies=[Depends(rate_limit("tryon", "rate_limit_tryon"))],
)
async def try_on(
    photo: UploadFile = File(..., description="A clear, front-facing photo of the user."),
    item_ids: str = Form(..., description="Comma-separated catalog item ids of the look."),
    principal: Principal = Depends(require_active_principal),
    account_repo: AccountRepository = Depends(get_account_repo),
    directory: ItemDirectory = Depends(get_item_directory),
    renderer: TryOnRenderer = Depends(get_tryon_renderer),
    event_sink: EventSink = Depends(get_event_sink),
) -> TryOnResponse:
    """Dress the uploaded photo in the given garments (top/bottom; footwear is
    phased in per the roadmap). Consent-gated; the photo is ephemeral."""
    if not account_repo.get_consent(principal.user_id).get("data_processing", False):
        raise HTTPException(status_code=403, detail="data_processing consent required")

    ids = [i.strip() for i in item_ids.split(",") if i.strip()]
    if not ids:
        raise HTTPException(status_code=422, detail="item_ids required")
    if len(ids) > _MAX_GARMENTS:
        raise HTTPException(status_code=422, detail=f"at most {_MAX_GARMENTS} items per look")

    if photo.content_type not in _ACCEPTED_PHOTO_TYPES:
        raise HTTPException(status_code=415, detail="unsupported image type (use jpeg, png, webp)")
    raw = await photo.read(settings.max_photo_bytes + 1)
    if len(raw) > settings.max_photo_bytes:
        raise HTTPException(status_code=413, detail="image too large")
    if not raw or not _is_supported_image(raw):
        raise HTTPException(status_code=415, detail="unsupported image type (use jpeg, png, webp)")

    details = directory.lookup(ids)
    garments = [
        TryOnGarment(item_id=d.item_id, image_url=d.image_url, slot=d.slot)
        for item_id in ids
        if (d := details.get(item_id)) is not None and d.image_url
    ]
    if not garments:
        raise HTTPException(status_code=404, detail="no renderable items found for those ids")

    # Decode (validates dimensions / rejects decompression bombs) and re-encode
    # as PNG so the renderer receives one canonical format regardless of upload
    # type. CPU + long vendor polling — keep it off the event loop.
    image = await run_in_threadpool(_decode_photo, raw)
    person_png = await run_in_threadpool(_to_png, image)
    render = await run_in_threadpool(renderer.render, person_png, garments)

    if not render.abstained:
        for garment in garments:
            event_sink.publish(
                InteractionEvent(
                    user_id=principal.user_id,
                    target_type=InteractionTarget.ITEM,
                    target_id=garment.item_id,
                    action=InteractionAction.TRYON,
                    context={"model_version": render.model_version},
                )
            )

    return TryOnResponse(
        image_b64=base64.b64encode(render.image_png).decode() if render.image_png else None,
        confidence=render.confidence,
        model_version=render.model_version,
        rendered_slots=list(render.rendered_slots),
        reason=render.reason,
    )


def _to_png(image: object) -> bytes:
    buf = io.BytesIO()
    image.save(buf, format="PNG")  # type: ignore[attr-defined]
    return buf.getvalue()
