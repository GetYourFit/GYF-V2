"""GYF core API — P0 foundations.

Exposes health and a minimal feedback-ingestion endpoint that validates the
behavioral event taxonomy. Persistence/broker wiring lands as P0 infra is provisioned.
"""

from __future__ import annotations

from fastapi import FastAPI

from .config import settings
from .events import InteractionEvent
from .sink import get_sink

app = FastAPI(title="GYF Core API", version="0.0.0")
sink = get_sink()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "api", "env": settings.env}


@app.post("/feedback", status_code=202)
def ingest_feedback(event: InteractionEvent) -> dict[str, str]:
    """Validate and persist a behavioral event onto the learning spine.

    Uses the configured event sink (local JSONL in dev; broker-backed once P0
    infra is provisioned — see docs/implementation-plan.md P0-C/D).
    """
    sink.publish(event)
    return {"status": "accepted", "action": event.action.value}
