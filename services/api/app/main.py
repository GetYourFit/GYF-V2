"""GYF core API — P0 foundations.

Exposes health, an authenticated identity probe, and a feedback-ingestion
endpoint that validates the behavioral event taxonomy and attributes each event
to the authenticated principal. Persistence/broker wiring lands as P0 infra is
provisioned.
"""

from __future__ import annotations

from fastapi import Depends, FastAPI

from .auth import Principal, get_current_principal
from .config import settings
from .events import FeedbackRequest
from .sink import get_sink

app = FastAPI(title="GYF Core API", version="0.0.0")
sink = get_sink()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "api", "env": settings.env}


@app.get("/me")
def me(principal: Principal = Depends(get_current_principal)) -> dict[str, str | None]:
    """Trivial authenticated endpoint — proves the auth scaffold end-to-end."""
    return {"user_id": principal.user_id, "email": principal.email}


@app.post("/feedback", status_code=202)
def ingest_feedback(
    body: FeedbackRequest,
    principal: Principal = Depends(get_current_principal),
) -> dict[str, str]:
    """Validate and persist a behavioral event onto the learning spine.

    The event is attributed to the authenticated principal (not a client-supplied
    id) and written via the configured sink (local JSONL in dev; broker-backed once
    P0 infra is provisioned — see docs/implementation-plan.md P0-C/D).
    """
    event = body.to_event(principal.user_id)
    sink.publish(event)
    return {"status": "accepted", "action": event.action.value}
