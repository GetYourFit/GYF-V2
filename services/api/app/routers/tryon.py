"""Virtual try-on (M9/F8) — see the complete designed look on *your* body.

Try-on is a **durable job**, not a request. A render takes 10-60s on a GPU; doing that
inside the request meant it died with the connection, could not be retried or cancelled,
and had no cost ceiling. So ``POST /tryon`` now *enqueues* and returns 202, and
:mod:`app.tryon.worker` renders it through the :class:`TryOnRenderer` port.

What that buys the user: they can close the page. The render is waiting when they come
back. That is the whole point of the async shape, and the surface should say so.

The honest trio (doctrine D6) survives the move — every finished job carries a render
*or* an abstention, a calibrated confidence, and exactly which garments made it onto the
body. The photo (D8) is consent-gated, validated, and dropped the instant the job goes
terminal, so it lives for the render, not for the job's TTL.

Try-on stays CLOSED to users until the F9 evaluation gate: ``GYF_TRYON_ENABLED`` ships
false and every route below refuses. The endpoints exist, and are tested, so that the
gate is a flag flip and not a rewrite.
"""

from __future__ import annotations

import io
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from ..auth import Principal
from ..catalog.directory import ItemDirectory
from ..config import settings
from ..dependencies import (
    get_account_repo,
    get_item_directory,
    get_tryon_job_repo,
    get_tryon_renderer,
    require_active_principal,
)
from ..profile.account import AccountRepository
from ..ratelimit import rate_limit
from ..tryon import NullTryOnRenderer, TryOnRenderer
from ..tryon.jobs import TryOnJob, TryOnJobRepository
from .profile import _ACCEPTED_PHOTO_TYPES, _decode_photo, _is_supported_image

router = APIRouter(tags=["tryon"])

_MAX_GARMENTS = 4


class TryOnQuota(BaseModel):
    """Free, but bounded — the GPU is finite. Never a paywall: nothing here is buyable."""

    used: int
    limit: int


class TryOnJobView(BaseModel):
    """A job's honest state. The render itself is fetched from ``image_url``, never
    inlined: a base64 blob on every poll would move megabytes to say "still working"."""

    job_id: str
    # queued | running | succeeded | abstained | failed | cancelled
    status: str
    item_ids: list[str]
    # Set only when a render exists. Absent on abstention — by construction, not by
    # accident: an abstaining renderer produced no image and the surface must not imply one.
    image_url: str | None
    confidence: float | None
    model_version: str | None
    rendered_slots: list[str]
    # Human-readable, and always populated when the outcome is anything but a plain
    # success — this is what the UI shows instead of a generic error.
    reason: str
    error_code: str | None
    attempts: int
    created_at: datetime
    finished_at: datetime | None
    expires_at: datetime


class TryOnJobCreated(BaseModel):
    job_id: str
    status: str
    quota: TryOnQuota


class TryOnJobList(BaseModel):
    jobs: list[TryOnJobView]
    quota: TryOnQuota


def _view(job: TryOnJob) -> TryOnJobView:
    return TryOnJobView(
        job_id=job.job_id,
        status=job.status,
        item_ids=list(job.item_ids),
        image_url=f"/tryon/jobs/{job.job_id}/image" if job.has_image else None,
        confidence=job.confidence,
        model_version=job.model_version,
        rendered_slots=list(job.rendered_slots),
        reason=job.reason,
        error_code=job.error_code,
        attempts=job.attempts,
        created_at=job.created_at,
        finished_at=job.finished_at,
        expires_at=job.expires_at,
    )


def _require_lane(renderer: TryOnRenderer) -> None:
    """Refuse before a sensitive upload is accepted, never after.

    Two ways try-on can be shut: the F9 gate (``tryon_enabled``) and the absence of a
    promoted rendering lane. Either way nothing could ever be rendered, so asking for a
    body photo first and abstaining on it afterwards would be taking a photo under false
    pretences (F1b closed exactly this hole on the synchronous route).
    """
    if not settings.tryon_enabled or isinstance(renderer, NullTryOnRenderer):
        raise HTTPException(
            status_code=503, detail="virtual try-on is not available on this deployment"
        )


@router.post(
    "/tryon",
    status_code=202,
    summary="Queue a render of an outfit on the user's photo",
    dependencies=[Depends(rate_limit("tryon", "rate_limit_tryon"))],
)
async def enqueue_try_on(
    photo: UploadFile = File(..., description="A clear, front-facing photo of the user."),
    item_ids: str = Form(..., description="Comma-separated catalog item ids of the look."),
    principal: Principal = Depends(require_active_principal),
    account_repo: AccountRepository = Depends(get_account_repo),
    directory: ItemDirectory = Depends(get_item_directory),
    renderer: TryOnRenderer = Depends(get_tryon_renderer),
    jobs: TryOnJobRepository = Depends(get_tryon_job_repo),
) -> TryOnJobCreated:
    """Queue the render. Returns 202 — poll ``GET /tryon/jobs/{id}`` for the outcome."""
    if not account_repo.get_consent(principal.user_id).get("data_processing", False):
        raise HTTPException(status_code=403, detail="data_processing consent required")

    _require_lane(renderer)

    # Cost gates, both before the photo is read. The daily cap is the deployment-wide
    # kill switch; the monthly quota is the per-user one. Neither is a paywall — there is
    # nothing to buy, and these responses must never link to one.
    if jobs.renders_today() >= settings.tryon_daily_render_cap:
        raise HTTPException(
            status_code=503,
            detail="try-on is paused for today to keep it free for everyone",
        )
    used = jobs.month_count(principal.user_id)
    if used >= settings.tryon_monthly_quota_per_user:
        raise HTTPException(
            status_code=429,
            detail=(
                f"you've used all {settings.tryon_monthly_quota_per_user} free renders this month"
            ),
        )

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
    if not any((d := details.get(i)) is not None and d.image_url for i in ids):
        raise HTTPException(status_code=404, detail="no renderable items found for those ids")

    # Decode (validates dimensions / rejects decompression bombs) and re-encode as PNG so
    # the worker stores one canonical format regardless of upload type. CPU — keep it off
    # the event loop.
    image = await run_in_threadpool(_decode_photo, raw)
    person_png = await run_in_threadpool(_to_png, image)

    job = await run_in_threadpool(
        jobs.enqueue, principal.user_id, ids, person_png, settings.tryon_job_ttl_hours
    )
    return TryOnJobCreated(
        job_id=job.job_id,
        status=job.status,
        quota=TryOnQuota(used=used + 1, limit=settings.tryon_monthly_quota_per_user),
    )


@router.get("/tryon/jobs", summary="The caller's recent try-on jobs and quota")
def list_try_on_jobs(
    principal: Principal = Depends(require_active_principal),
    jobs: TryOnJobRepository = Depends(get_tryon_job_repo),
) -> TryOnJobList:
    """The history surface — what makes "close the page and come back" real."""
    return TryOnJobList(
        jobs=[_view(j) for j in jobs.list_for_user(principal.user_id)],
        quota=TryOnQuota(
            used=jobs.month_count(principal.user_id),
            limit=settings.tryon_monthly_quota_per_user,
        ),
    )


@router.get("/tryon/jobs/{job_id}", summary="Poll one try-on job")
def get_try_on_job(
    job_id: str,
    principal: Principal = Depends(require_active_principal),
    jobs: TryOnJobRepository = Depends(get_tryon_job_repo),
) -> TryOnJobView:
    job = jobs.get(job_id, principal.user_id)
    # 404, not 403: another user's job reads as absent rather than as forbidden, so the
    # response cannot be used to confirm that a given job id exists.
    if job is None:
        raise HTTPException(status_code=404, detail="job not found")
    return _view(job)


@router.get("/tryon/jobs/{job_id}/image", summary="The rendered look")
def get_try_on_image(
    job_id: str,
    principal: Principal = Depends(require_active_principal),
    jobs: TryOnJobRepository = Depends(get_tryon_job_repo),
) -> Response:
    """Stream the render. A 404 here is also how TTL expiry surfaces: the sweep deleted
    the row, so the render is genuinely gone — which is the promise, not a failure."""
    png = jobs.image(job_id, principal.user_id)
    if png is None:
        raise HTTPException(status_code=404, detail="render not found or expired")
    # Private: this is a picture of the user's body. It must never land in a shared cache.
    return Response(
        content=png,
        media_type="image/png",
        headers={"Cache-Control": "private, max-age=300"},
    )


@router.delete("/tryon/jobs/{job_id}", status_code=202, summary="Cancel a try-on job")
def cancel_try_on_job(
    job_id: str,
    principal: Principal = Depends(require_active_principal),
    jobs: TryOnJobRepository = Depends(get_tryon_job_repo),
) -> TryOnJobView:
    """Cancel honestly.

    A **queued** job is genuinely cancelled: no GPU is spent, and the quota is refunded
    (``month_count`` excludes cancelled jobs). A **running** job is flagged — the worker
    honours it between passes, but the vendor's render call is not interruptible, so the
    GPU seconds are already spent. The UI must not claim otherwise. Either way the photo
    is dropped.
    """
    jobs.request_cancel(job_id, principal.user_id)
    job = jobs.get(job_id, principal.user_id)
    if job is None:
        raise HTTPException(status_code=404, detail="job not found")
    # Idempotent: cancelling an already-terminal job is a no-op that reports its real state.
    return _view(job)


def _to_png(image: object) -> bytes:
    buf = io.BytesIO()
    image.save(buf, format="PNG")  # type: ignore[attr-defined]
    return buf.getvalue()
