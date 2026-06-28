"""Feedback surface — behavioral events that train personalization."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from ..auth import Principal
from ..dependencies import get_event_sink, require_active_principal
from ..events import FeedbackRequest
from ..ratelimit import rate_limit
from ..sink import EventSink

router = APIRouter(tags=["feedback"])


@router.post(
    "/feedback",
    status_code=202,
    dependencies=[Depends(rate_limit("feedback", "rate_limit_feedback"))],
)
def ingest_feedback(
    body: FeedbackRequest,
    principal: Principal = Depends(require_active_principal),
    event_sink: EventSink = Depends(get_event_sink),
) -> dict[str, str]:
    """Validate and persist a behavioral event onto the learning spine.

    The event is attributed to the authenticated principal (not a client-supplied
    id) and written via the configured sink (local JSONL in dev; broker-backed once
    P0 infra is provisioned — see docs/implementation-plan.md P0-C/D).
    """
    event = body.to_event(principal.user_id)
    event_sink.publish(event)
    return {"status": "accepted", "action": event.action.value}
