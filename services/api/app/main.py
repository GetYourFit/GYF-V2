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
from .recsys.candidates import CandidateRepository
from .recsys.models import OutfitRecommendation
from .recsys.service import recommend
from .recsys.taste import TasteRepository
from .sink import EventSink, get_sink
from .telemetry import configure_telemetry

_API_DESCRIPTION = """
GYF — your AI-native personal stylist. This is the core API.

### Quick-start (local dev — no auth needed)
In local mode every call is the same **dev user**, auto-provisioned for you, so
you can click **Authorize** nothing and just hit endpoints in order:

1. **PUT `/profile`** — create your style profile (the form is pre-filled with a
   valid example; just press *Execute*). Required before recommendations.
2. **GET `/outfits/recommend`** — your outfits. Try the **`goal`** box:
   *"I want to look slimmer / taller / broader"* and watch the looks (and each
   `explanation`) change. `applied_goals` echoes what GYF understood.
3. **POST `/feedback`** — `save` an item id you liked, then call
   `/outfits/recommend` again: it personalizes (`taste_strength` rises).
4. **GET `/items/search`** / **`/items/{id}/similar`** — visual search.
5. **GET/PUT `/consent`**, **DELETE `/profile`**, **DELETE `/account`** — privacy
   and right-to-erasure.

Every recommendation ships a human reason and an honest confidence — trust is
the product.
"""

app = FastAPI(
    title="GYF Core API",
    version="0.1.0",
    description=_API_DESCRIPTION,
    openapi_tags=[
        {"name": "recommendations", "description": "Outfit composition & the NL styling-goal box."},
        {"name": "profile", "description": "Onboarding, consent, and account lifecycle."},
        {"name": "catalog", "description": "Visual search & shop-the-look."},
        {"name": "feedback", "description": "Behavioral events that train personalization."},
        {"name": "system", "description": "Health & identity probes."},
    ],
)
sink = get_sink()

# Observability (P0-E): structured logs + opt-in traces/errors + always-on metrics.
_telemetry = configure_telemetry(app)
install_metrics(app)


@app.get("/health", tags=["system"])
def health() -> dict[str, object]:
    return {
        "status": "ok",
        "service": "api",
        "env": settings.env,
        "telemetry": {**_telemetry, "metrics": metrics_enabled()},
    }


@app.get("/me", tags=["system"])
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


@app.get("/items/{item_id}/similar", tags=["catalog"])
def similar_items(
    item_id: str,
    k: int = Query(10, ge=1, le=50),
    region: str | None = None,
    repo: VectorSearchRepository = Depends(get_search_repo),
) -> dict[str, list[SearchResult]]:
    """Visually-similar items (nearest neighbours of the item's embedding)."""
    return {"results": repo.similar_to_item(item_id, k, region)}


@app.get("/items/search", tags=["catalog"])
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

    In local/open-auth mode the dev principal is auto-provisioned so a freshly
    rebuilt database (empty ``users`` table) just works — without this, an absent
    row reads as "deleted" and every call 403s. It never resurrects a real
    tombstone (insert-if-absent only), so deletion semantics are preserved.
    """
    if settings.auth_is_open:
        repo.ensure_user(principal.user_id)
    if repo.is_deleted(principal.user_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account deleted")
    return principal


@app.get("/profile", tags=["profile"])
def read_profile(
    principal: Principal = Depends(require_active_principal),
    repo: ProfileRepository = Depends(get_profile_repo),
) -> Profile:
    """The authenticated user's profile. 404 before onboarding completes."""
    profile = repo.get(principal.user_id)
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No profile yet")
    return profile


@app.put("/profile", tags=["profile"])
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


@app.delete("/profile", status_code=status.HTTP_204_NO_CONTENT, tags=["profile"])
def delete_profile(
    principal: Principal = Depends(require_active_principal),
    repo: ProfileRepository = Depends(get_profile_repo),
) -> Response:
    """Erase the user's profile (keeps the account). Idempotent: 204 either way."""
    repo.delete(principal.user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get("/consent", tags=["profile"])
def read_consent(
    principal: Principal = Depends(require_active_principal),
    repo: AccountRepository = Depends(get_account_repo),
) -> dict[str, bool]:
    """The user's current consent flags."""
    return repo.get_consent(principal.user_id)


@app.put("/consent", tags=["profile"])
def update_consent(
    payload: ConsentInput,
    principal: Principal = Depends(require_active_principal),
    repo: AccountRepository = Depends(get_account_repo),
) -> dict[str, bool]:
    """Grant/revoke consent. Merges known flags; unknown keys are ignored."""
    return repo.update_consent(principal.user_id, payload.flags)


@app.delete("/account", status_code=status.HTTP_204_NO_CONTENT, tags=["profile"])
def delete_account(
    principal: Principal = Depends(get_current_principal),
    repo: AccountRepository = Depends(get_account_repo),
) -> Response:
    """Right-to-erasure: tombstone the account now; a purge job hard-deletes it
    (cascading) after the grace window. Idempotent — re-requesting is a no-op."""
    repo.soft_delete(principal.user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Recommendation & composition (P1-C Cycle 1) dependencies. Overridable in tests. ---


def get_candidate_repo() -> CandidateRepository:
    """The Postgres-backed candidate repository (lazy connection pool)."""
    from .recsys.candidates import PostgresCandidateRepository

    return PostgresCandidateRepository(settings.database_url)


def get_taste_repo() -> TasteRepository:
    """The Postgres-backed taste repository (lazy connection pool)."""
    from .recsys.taste import PostgresTasteRepository

    return PostgresTasteRepository(settings.database_url)


def get_event_sink() -> EventSink:
    """The configured event sink (overridable in tests to avoid real writes)."""
    return sink


@app.get("/outfits/recommend", tags=["recommendations"], summary="Recommend complete outfits")
def recommend_outfits(
    occasion: str | None = Query(
        None,
        description="What you're dressing for. Overrides your profile's stored occasion.",
        openapi_examples={
            "casual": {"summary": "Casual", "value": "casual"},
            "business": {"summary": "Business", "value": "business"},
            "wedding": {"summary": "Wedding", "value": "wedding"},
            "festive": {"summary": "Festive", "value": "festive"},
        },
    ),
    k: int = Query(5, ge=1, le=20, description="How many outfits to return."),
    region: str | None = Query(None, description="Region code (e.g. IN) for culture-aware garments."),
    goal: str | None = Query(
        None,
        max_length=200,
        description=(
            "Free-text styling goal. GYF parses it into visual effects (taller / "
            "slimmer / broader) and steers the look with color theory + body-type "
            "intelligence. Unrecognized text is a no-op."
        ),
        openapi_examples={
            "none": {"summary": "No goal (baseline)", "value": None},
            "slimmer": {"summary": "Look slimmer", "value": "I want to look slimmer"},
            "taller": {"summary": "Look taller", "value": "I want to look taller"},
            "broader": {"summary": "Look broader", "value": "I want to look broader and more muscular"},
            "combined": {"summary": "Taller + slimmer", "value": "taller and slimmer"},
        },
    ),
    principal: Principal = Depends(require_active_principal),
    profile_repo: ProfileRepository = Depends(get_profile_repo),
    candidates: CandidateRepository = Depends(get_candidate_repo),
    taste_repo: TasteRepository = Depends(get_taste_repo),
    event_sink: EventSink = Depends(get_event_sink),
) -> OutfitRecommendation:
    """Personalized outfit recommendations: complete, explained, diverse looks.

    Conditions on the user's onboarding profile (occasion, budget, undertone, style
    intent) and their learned taste (from prior saves/carts/skips). Works on the
    very first visit (pure cold-start) and sharpens as behavior accrues. Each call
    logs impressions so the recommendation is auditable and trainable. ``occasion``
    overrides the profile's stored one. ``goal`` is a free-text controllable-styling
    request ("look taller / slimmer / broader") that biases the look toward that
    visual effect. 404s before onboarding.
    """
    profile = profile_repo.get(principal.user_id)
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No profile yet")
    return recommend(
        profile, principal.user_id, candidates, taste_repo, event_sink, occasion, region, k, goal
    )


@app.post("/feedback", status_code=202, tags=["feedback"])
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
