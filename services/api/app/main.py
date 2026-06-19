"""GYF core API — P0 foundations.

Exposes health, an authenticated identity probe, and a feedback-ingestion
endpoint that validates the behavioral event taxonomy and attributes each event
to the authenticated principal. Persistence/broker wiring lands as P0 infra is
provisioned.
"""

from __future__ import annotations

from fastapi import Depends, FastAPI, HTTPException, Query, Response, status

from .auth import Principal, get_current_principal
from .catalog.retrieval import (
    SearchResult,
    TextEmbedder,
    VectorSearchRepository,
    search_text,
)
from .config import settings
from .events import FeedbackRequest
from .metrics import install_metrics, metrics_enabled
from .profile.account import AccountRepository
from .profile.models import ConsentInput, Profile, ProfileInput, profile_from_manual
from .profile.repository import ProfileRepository
from .sink import get_sink
from .telemetry import configure_telemetry

app = FastAPI(title="GYF Core API", version="0.0.0")
sink = get_sink()

# Observability (P0-E): structured logs + opt-in traces/errors + always-on metrics.
_telemetry = configure_telemetry(app)
install_metrics(app)


@app.get("/health")
def health() -> dict[str, object]:
    return {
        "status": "ok",
        "service": "api",
        "env": settings.env,
        "telemetry": {**_telemetry, "metrics": metrics_enabled()},
    }


@app.get("/me")
def me(principal: Principal = Depends(get_current_principal)) -> dict[str, str | None]:
    """Trivial authenticated endpoint — proves the auth scaffold end-to-end."""
    return {"user_id": principal.user_id, "email": principal.email}


# --- Retrieval (P1-A A3) dependencies. Overridable in tests via dependency_overrides. ---


def get_search_repo() -> VectorSearchRepository:
    """The pgvector-backed retrieval repository (lazy connection pool)."""
    from .catalog.retrieval import PostgresVectorSearchRepository

    return PostgresVectorSearchRepository(settings.database_url)


def get_text_embedder() -> TextEmbedder:
    """The SigLIP text-query embedder from the ML runtime.

    Imported lazily so the API needs the ML/torch stack only when text search is
    actually served. When the perception runtime is not installed, ``/items/search``
    returns an honest 503 rather than pretending to work.
    """
    try:
        from .catalog.perception_adapter import cached_text_embedder

        return cached_text_embedder()
    except ImportError as exc:  # perception runtime / torch not installed
        raise HTTPException(status_code=503, detail="text search unavailable") from exc


@app.get("/items/{item_id}/similar")
def similar_items(
    item_id: str,
    k: int = Query(10, ge=1, le=50),
    region: str | None = None,
    repo: VectorSearchRepository = Depends(get_search_repo),
) -> dict[str, list[SearchResult]]:
    """Visually-similar items (nearest neighbours of the item's embedding)."""
    return {"results": repo.similar_to_item(item_id, k, region)}


@app.get("/items/search")
def search_items(
    q: str = Query(..., min_length=1),
    k: int = Query(10, ge=1, le=50),
    region: str | None = None,
    repo: VectorSearchRepository = Depends(get_search_repo),
    embedder: TextEmbedder = Depends(get_text_embedder),
) -> dict[str, list[SearchResult]]:
    """Text->image search over the catalog (e.g. 'red floral summer dress')."""
    return {"results": search_text(repo, embedder, q, k, region)}


# --- User modeling (P1-B Cycle 1) dependencies. Overridable in tests. ---


def get_profile_repo() -> ProfileRepository:
    """The Postgres-backed profile repository (lazy connection pool)."""
    from .profile.repository import PostgresProfileRepository

    return PostgresProfileRepository(settings.database_url)


def get_account_repo() -> AccountRepository:
    """The Postgres-backed account repository (lazy connection pool)."""
    from .profile.account import PostgresAccountRepository

    return PostgresAccountRepository(settings.database_url)


def require_active_principal(
    principal: Principal = Depends(get_current_principal),
    repo: AccountRepository = Depends(get_account_repo),
) -> Principal:
    """The caller, rejected with 403 if their account has been (soft) deleted.

    A tombstoned user is disabled the instant they request deletion: no further
    reads or writes until the grace window elapses and the purge job erases them.
    """
    if repo.is_deleted(principal.user_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account deleted")
    return principal


@app.get("/profile")
def read_profile(
    principal: Principal = Depends(require_active_principal),
    repo: ProfileRepository = Depends(get_profile_repo),
) -> Profile:
    """The authenticated user's profile. 404 before onboarding completes."""
    profile = repo.get(principal.user_id)
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No profile yet")
    return profile


@app.put("/profile")
def upsert_profile(
    payload: ProfileInput,
    principal: Principal = Depends(require_active_principal),
    repo: ProfileRepository = Depends(get_profile_repo),
) -> Profile:
    """Manual onboarding / edit: validate, stamp confidences, persist, return it.

    Idempotent upsert keyed by the authenticated user — the same call updates an
    existing profile, so the always-editable-preferences requirement is satisfied.
    """
    profile = profile_from_manual(payload)
    repo.upsert(principal.user_id, profile)
    return profile


@app.delete("/profile", status_code=status.HTTP_204_NO_CONTENT)
def delete_profile(
    principal: Principal = Depends(require_active_principal),
    repo: ProfileRepository = Depends(get_profile_repo),
) -> Response:
    """Erase the user's profile (keeps the account). Idempotent: 204 either way."""
    repo.delete(principal.user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get("/consent")
def read_consent(
    principal: Principal = Depends(require_active_principal),
    repo: AccountRepository = Depends(get_account_repo),
) -> dict[str, bool]:
    """The user's current consent flags."""
    return repo.get_consent(principal.user_id)


@app.put("/consent")
def update_consent(
    payload: ConsentInput,
    principal: Principal = Depends(require_active_principal),
    repo: AccountRepository = Depends(get_account_repo),
) -> dict[str, bool]:
    """Grant/revoke consent. Merges known flags; unknown keys are ignored."""
    return repo.update_consent(principal.user_id, payload.flags)


@app.delete("/account", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    principal: Principal = Depends(get_current_principal),
    repo: AccountRepository = Depends(get_account_repo),
) -> Response:
    """Right-to-erasure: tombstone the account now; a purge job hard-deletes it
    (cascading) after the grace window. Idempotent — re-requesting is a no-op."""
    repo.soft_delete(principal.user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


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
