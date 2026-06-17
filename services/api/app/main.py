"""GYF core API — P0 foundations.

Exposes health and a minimal feedback-ingestion endpoint that validates the
behavioral event taxonomy. Persistence/broker wiring lands as P0 infra is provisioned.
"""

from __future__ import annotations

from fastapi import FastAPI

from .config import settings
from .events import InteractionEvent

app = FastAPI(title="GYF Core API", version="0.0.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "api", "env": settings.env}


@app.post("/feedback", status_code=202)
def ingest_feedback(event: InteractionEvent) -> dict[str, str]:
    """Validate and accept a behavioral event.

    P0: validation only (returns accepted). Broker/lake sink is wired during
    P0 infra provisioning — see docs/implementation-plan.md P0-D.
    """
    # TODO(P0-D): publish to event broker; sink to lake.
    return {"status": "accepted", "action": event.action.value}
