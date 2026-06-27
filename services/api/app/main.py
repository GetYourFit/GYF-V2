"""GYF core API — P0 foundations.

Exposes health, an authenticated identity probe, and a feedback-ingestion
endpoint that validates the behavioral event taxonomy and attributes each event
to the authenticated principal. Persistence/broker wiring lands as P0 infra is
provisioned.
"""

from __future__ import annotations

import io
import logging
from pathlib import Path

from fastapi import Depends, FastAPI, File, HTTPException, Query, Response, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from .auth import Principal, get_current_principal
from .catalog.directory import ItemDirectory
from .catalog.retrieval import (
    SearchResult,
    TextEmbedder,
    VectorSearchRepository,
    search_text,
)
from .collections import (
    CollectionRepository,
    SaveItemRequest,
    SavedItem,
    enrich as enrich_saved,
)
from .config import settings
from .events import FeedbackRequest
from .metrics import install_metrics, metrics_enabled
from .observability import database_ready, install_request_context
from .profile.account import AccountRepository
from .profile.models import ConsentInput, Profile, ProfileInput, profile_from_manual
from .profile.photo import BodyAdapter, SkinToneAdapter, profile_from_photo
from .profile.repository import ProfileRepository
from .profile.summary import ProfileSummary, SummaryRepository, summarize
from .ratelimit import rate_limit
from .recsys.candidates import CandidateRepository
from .saved_outfits import (
    SavedOutfit,
    SavedOutfitRepository,
    SaveOutfitRequest,
    enrich as enrich_saved_outfits,
)
from .recsys.models import OutfitRecommendation
from .recsys.service import recommend
from .recsys.taste import TasteRepository
from .sink import EventSink, get_sink
from .social import (
    Post,
    PostInput,
    ReactionInput,
    SocialRepository,
    enrich_feed,
    make_record,
)
from .telemetry import configure_telemetry
from .wardrobe import (
    WardrobeItem,
    WardrobeItemInput,
    WardrobeRepository,
    build_record,
    enrich as enrich_wardrobe,
)

_API_DESCRIPTION = """
GYF — your AI-native personal stylist. This is the core API.

### See it visually first → open [`/gallery`](/gallery)
The fastest way to test: open **`/gallery`** in your browser. Type a styling goal
(*"look slimmer / taller / broader"*), pick an occasion, and see complete outfits
rendered **with real product photos** — no JSON, no clicking.

### Quick-start (local dev — no auth needed)
In local mode every call is the same **dev user**, auto-provisioned for you, so
you can ignore **Authorize** and just hit endpoints in order:

1. **PUT `/profile`** — create your style profile (the form is pre-filled with a
   valid example; just press *Execute*). Required before recommendations.
2. **GET `/outfits/recommend`** — your outfits. Each garment carries an
   **`image_url`** (served under `/media`). Try the **`goal`** box:
   *"I want to look slimmer / taller / broader"* and watch the looks (and each
   `explanation`) change. `applied_goals` echoes what GYF understood.
3. **POST `/feedback`** — `save` an item id you liked, then call
   `/outfits/recommend` again: it personalizes (`taste_strength` rises).
4. **GET `/items/search`** / **`/items/{id}/similar`** — visual search; results
   include `image_url`.
5. **GET/PUT `/consent`**, **DELETE `/profile`**, **DELETE `/account`** — privacy
   and right-to-erasure.

Every recommendation ships a human reason and an honest confidence — trust is
the product.
"""

# A self-contained gallery page (no build step, no external assets) so a tester
# can see complete outfits with real photos and exercise the NL goal box live.
# It talks only to the public JSON API; in local mode auth is the dev user.
_GALLERY_HTML = (Path(__file__).resolve().parent / "static" / "gallery.html").read_text(
    encoding="utf-8"
)

app = FastAPI(
    title="GYF — AI Personal Stylist API",
    version="0.1.0",
    summary="Learns what looks good on you and builds complete, explained outfits.",
    description=_API_DESCRIPTION,
    contact={"name": "GYF", "url": "https://github.com/"},
    license_info={"name": "Proprietary"},
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_tags=[
        {"name": "recommendations", "description": "Outfit composition & the NL styling-goal box."},
        {"name": "profile", "description": "Onboarding, consent, and account lifecycle."},
        {"name": "catalog", "description": "Visual search & shop-the-look."},
        {"name": "collections", "description": "Server-backed saved-items shortlist."},
        {"name": "wardrobe", "description": "The garments a user owns; styled around."},
        {"name": "social", "description": "Shareable style posts, reactions & follower re-rendering."},
        {"name": "feedback", "description": "Behavioral events that train personalization."},
        {"name": "system", "description": "Health, identity probes & the visual gallery."},
    ],
)

# Allow the deployed web app (a different origin than the API) to call us from the
# browser. Configured via GYF_ALLOWED_ORIGINS; empty in local same-host dev = no
# cross-origin access. Credentials are enabled so the Supabase JWT can be sent.
if settings.cors_origins or settings.allowed_origin_regex:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_origin_regex=settings.allowed_origin_regex or None,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    # Log the effective allow-list at startup so a CORS preflight 404 is diagnosable
    # from the deploy logs (vs. silently guessing which origin is missing).
    logging.getLogger("gyf.cors").info(
        "CORS enabled: origins=%s regex=%r",
        settings.cors_origins or "(none)",
        settings.allowed_origin_regex or None,
    )
else:
    logging.getLogger("gyf.cors").warning(
        "CORS disabled: GYF_ALLOWED_ORIGINS is empty and env is %r — browser calls "
        "from a different origin will fail preflight with 404. Set GYF_ALLOWED_ORIGINS.",
        settings.env,
    )

sink = get_sink()


def _media_root() -> Path | None:
    """Resolve the catalog-image directory, or ``None`` if it doesn't exist.

    A relative ``media_dir`` resolves against the repo root (this file is at
    ``services/api/app/main.py``) so the mount works regardless of the process
    working directory.
    """
    configured = Path(settings.media_dir)
    root = configured if configured.is_absolute() else Path(__file__).resolve().parents[3] / configured
    return root if root.is_dir() else None


# Serve catalog images read-only under /media so API responses (image_url) and the
# gallery can render real photos. Skipped cleanly when the directory is absent.
_media = _media_root()
if _media is not None:
    app.mount("/media", StaticFiles(directory=str(_media)), name="media")

# Observability (P0-E): structured logs + opt-in traces/errors + always-on metrics.
_telemetry = configure_telemetry(app)
install_metrics(app)
# Foundation hardening (W1): request ids, structured access log, uniform error envelope.
install_request_context(app)


@app.get("/", include_in_schema=False)
def root() -> RedirectResponse:
    """Land on the interactive docs."""
    return RedirectResponse(url="/docs")


@app.get("/gallery", response_class=HTMLResponse, tags=["system"], summary="Visual outfit gallery")
def gallery() -> HTMLResponse:
    """A self-contained page that renders recommended outfits with real photos.

    Pure client-side: it calls ``/outfits/recommend`` and lays out each look with
    its garments' ``image_url``. The single best way to *see* the stylist work —
    the NL goal box and occasion selector are wired in.
    """
    return HTMLResponse(_GALLERY_HTML)


@app.get("/health", tags=["system"])
def health() -> dict[str, object]:
    """Liveness: the process is up and serving. Cheap, never touches the DB."""
    return {
        "status": "ok",
        "service": "api",
        "env": settings.env,
        "telemetry": {**_telemetry, "metrics": metrics_enabled()},
    }


def get_readiness() -> bool:
    """Readiness signal — DB reachable. Overridable in tests via dependency_overrides."""
    return database_ready(settings.database_url)


@app.get("/ready", tags=["system"], summary="Readiness probe (dependencies reachable)")
def ready(db_ready: bool = Depends(get_readiness)) -> Response:
    """Readiness: distinct from liveness — reports whether the API can actually serve
    (its datastore is reachable). Returns 503 so a load balancer / K8s readiness gate
    stops routing traffic to a replica that can't reach Postgres, instead of serving 500s."""
    body = {"status": "ready" if db_ready else "not_ready", "checks": {"database": db_ready}}
    code = status.HTTP_200_OK if db_ready else status.HTTP_503_SERVICE_UNAVAILABLE
    return JSONResponse(content=body, status_code=code)


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


@app.get(
    "/items/search",
    tags=["catalog"],
    dependencies=[Depends(rate_limit("search", "rate_limit_search"))],
)
def search_items(
    q: str = Query(..., min_length=1),
    k: int = Query(10, ge=1, le=50),
    region: str | None = None,
    repo: VectorSearchRepository = Depends(get_search_repo),
    embedder: TextEmbedder = Depends(get_text_embedder),
) -> dict[str, list[SearchResult]]:
    """Text->image search over the catalog (e.g. 'red floral summer dress').

    The encoder loads its backend lazily, so a missing runtime (e.g. ``open_clip``
    absent from the API image, which delegates GPU work to the remote lane) only
    raises when we actually embed. Convert that into the same honest 503 the
    construction-time path returns, never a 500 that pretends the search broke.
    """
    try:
        return {"results": search_text(repo, embedder, q, k, region)}
    except ImportError as exc:  # encoder backend not installed in this runtime
        raise HTTPException(status_code=503, detail="text search unavailable") from exc


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

    The principal is provisioned just-in-time on first authed call (JIT user
    provisioning from the identity provider): a verified Supabase user — or the
    dev principal in open-auth — gets a ``users`` row so a freshly rebuilt or
    empty database just works, instead of an absent row reading as "deleted" and
    every call 403-ing. ``ensure_user`` is insert-if-absent, so it never
    resurrects a real tombstone — deletion/erasure semantics are preserved (a
    tombstoned user still 403s; a fully purged one re-registers as a new account).
    """
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


# --- Photo onboarding (P1-B Cycles 2 & 3) dependencies. Overridable in tests. ---

_ACCEPTED_PHOTO_TYPES = frozenset({"image/jpeg", "image/png", "image/webp"})


def get_skin_adapter() -> SkinToneAdapter | None:
    """The skin-tone estimator adapter, or ``None`` if its ml runtime is absent.

    Unlike text search (a hard 503), a missing module here is a graceful per-module
    abstain: the endpoint still runs the other module, and manual entry is always
    available. Construction loads weights, so it is cached inside the adapter.
    """
    try:
        from .profile.photo import cached_skin_adapter

        return cached_skin_adapter()
    except ImportError:
        return None


def get_body_adapter() -> BodyAdapter | None:
    """The body-type estimator adapter, or ``None`` if its ml runtime is absent."""
    try:
        from .profile.photo import cached_body_adapter

        return cached_body_adapter()
    except ImportError:
        return None


@app.post(
    "/profile/photo",
    tags=["profile"],
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
    and is ephemeral** — bytes are never logged and never persisted here (durable,
    consented photo storage arrives with try-on). Each module **abstains** if its ml
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

    image = _decode_photo(raw)

    # Each module abstains on ANY runtime failure (remote Space down, weights/runtime
    # missing, decode error), not just an import error at build time — a flaky or
    # not-yet-deployed module must never 500 the whole onboarding; the other module
    # still runs and the manual path is always the fallback.
    skin = _estimate_or_abstain(skin_adapter, image, "skin-tone")
    body = _estimate_or_abstain(body_adapter, image, "body-type")
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
    logging.getLogger("gyf.photo").info(
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
        logging.getLogger("gyf.photo").warning("%s estimation failed; abstaining", label,
                                               exc_info=True)
        return None


def _decode_photo(raw: bytes) -> object:
    """Decode bytes to an orientation-corrected, EXIF-stripped RGB image.

    Applies EXIF orientation then re-bakes pixels so no camera metadata (incl. GPS)
    survives into anything downstream — privacy by construction (D8).
    """
    from PIL import Image, ImageOps

    try:
        with Image.open(io.BytesIO(raw)) as img:
            img.load()
            return ImageOps.exif_transpose(img).convert("RGB")
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001 — any decode failure is a bad upload
        raise HTTPException(status_code=422, detail="could not decode image") from exc


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


@app.get(
    "/outfits/recommend",
    tags=["recommendations"],
    summary="Recommend complete outfits",
    dependencies=[Depends(rate_limit("recommend", "rate_limit_recommend"))],
)
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


@app.post(
    "/feedback",
    status_code=202,
    tags=["feedback"],
    dependencies=[Depends(rate_limit("feedback", "rate_limit_feedback"))],
)
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


# --- Stage-2 surfaces (W4): saved collections, wardrobe, social, profile summary ---
# Each persists what its web page previously mocked. Dependencies are injectable so
# the routes are tested with in-memory repos (mirrors the recsys/profile pattern).


def get_item_directory() -> ItemDirectory:
    """The Postgres-backed item directory used to enrich saved/wardrobe/social ids."""
    from .catalog.directory import PostgresItemDirectory

    return PostgresItemDirectory(settings.database_url)


def get_collection_repo() -> CollectionRepository:
    from .collections import PostgresCollectionRepository

    return PostgresCollectionRepository(settings.database_url)


def get_saved_outfit_repo() -> SavedOutfitRepository:
    from .saved_outfits import PostgresSavedOutfitRepository

    return PostgresSavedOutfitRepository(settings.database_url)


def get_wardrobe_repo() -> WardrobeRepository:
    from .wardrobe import PostgresWardrobeRepository

    return PostgresWardrobeRepository(settings.database_url)


def get_social_repo() -> SocialRepository:
    from .social import PostgresSocialRepository

    return PostgresSocialRepository(settings.database_url)


def get_summary_repo() -> SummaryRepository:
    from .profile.summary import PostgresSummaryRepository

    return PostgresSummaryRepository(settings.database_url)


@app.post("/collections", status_code=201, tags=["collections"], summary="Save an item")
def save_to_collection(
    body: SaveItemRequest,
    principal: Principal = Depends(require_active_principal),
    repo: CollectionRepository = Depends(get_collection_repo),
    directory: ItemDirectory = Depends(get_item_directory),
) -> SavedItem:
    """Save a catalog item to the user's shortlist. Idempotent per (user, item).

    404s if the item id is not in the catalog (so a typo never silently saves a
    dangling reference). Returns the saved item enriched for immediate render.
    """
    detail = directory.lookup([body.item_id]).get(body.item_id)
    if detail is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown item")
    repo.save(principal.user_id, body.item_id)
    return enrich_saved([body.item_id], directory)[0]


@app.get("/collections", tags=["collections"], summary="The user's saved items")
def list_collection(
    principal: Principal = Depends(require_active_principal),
    repo: CollectionRepository = Depends(get_collection_repo),
    directory: ItemDirectory = Depends(get_item_directory),
) -> dict[str, list[SavedItem]]:
    """The user's saved items, most-recently-saved first, enriched for display."""
    return {"items": enrich_saved(repo.list_item_ids(principal.user_id), directory)}


@app.delete(
    "/collections/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["collections"],
    summary="Unsave an item",
)
def remove_from_collection(
    item_id: str,
    principal: Principal = Depends(require_active_principal),
    repo: CollectionRepository = Depends(get_collection_repo),
) -> Response:
    """Remove an item from the shortlist. Idempotent: 204 whether or not present."""
    repo.remove(principal.user_id, item_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.post(
    "/collections/outfits",
    status_code=201,
    tags=["collections"],
    summary="Save a whole look",
)
def save_outfit(
    body: SaveOutfitRequest,
    principal: Principal = Depends(require_active_principal),
    repo: SavedOutfitRepository = Depends(get_saved_outfit_repo),
    directory: ItemDirectory = Depends(get_item_directory),
) -> SavedOutfit:
    """Save a complete look (a "saved styling session"). Idempotent per
    ``(user, outfit_key)`` — re-saving updates the stored snapshot. Returns the
    saved look enriched for immediate render."""
    outfit_id = repo.save(principal.user_id, body)
    saved = enrich_saved_outfits(repo.list(principal.user_id), directory)
    for look in saved:
        if look.id == outfit_id:
            return look
    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Save failed")


@app.get("/collections/outfits", tags=["collections"], summary="The user's saved looks")
def list_saved_outfits(
    principal: Principal = Depends(require_active_principal),
    repo: SavedOutfitRepository = Depends(get_saved_outfit_repo),
    directory: ItemDirectory = Depends(get_item_directory),
) -> dict[str, list[SavedOutfit]]:
    """The user's saved looks, most-recently-saved first, each re-rendered."""
    return {"outfits": enrich_saved_outfits(repo.list(principal.user_id), directory)}


@app.delete(
    "/collections/outfits/{outfit_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["collections"],
    summary="Unsave a look",
)
def remove_saved_outfit(
    outfit_id: str,
    principal: Principal = Depends(require_active_principal),
    repo: SavedOutfitRepository = Depends(get_saved_outfit_repo),
) -> Response:
    """Remove a saved look. Idempotent: 204 whether or not present."""
    repo.remove(principal.user_id, outfit_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.post("/wardrobe/items", status_code=201, tags=["wardrobe"], summary="Add an owned garment")
def add_wardrobe_item(
    body: WardrobeItemInput,
    principal: Principal = Depends(require_active_principal),
    repo: WardrobeRepository = Depends(get_wardrobe_repo),
    directory: ItemDirectory = Depends(get_item_directory),
) -> WardrobeItem:
    """Add a garment to the wardrobe: a catalog ``item_id`` or a freeform ``title``.

    A catalog reference is enriched from the catalog (404 if the id is unknown); a
    freeform garment is auto-classified into the shared taxonomy so it still slots
    into outfit logic.
    """
    record = build_record(body, directory)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown item")
    repo.add(principal.user_id, record)
    return enrich_wardrobe([record], directory)[0]


@app.get("/wardrobe/items", tags=["wardrobe"], summary="The user's wardrobe")
def list_wardrobe(
    principal: Principal = Depends(require_active_principal),
    repo: WardrobeRepository = Depends(get_wardrobe_repo),
    directory: ItemDirectory = Depends(get_item_directory),
) -> dict[str, list[WardrobeItem]]:
    """The user's owned garments, most-recently-added first."""
    return {"items": enrich_wardrobe(repo.list(principal.user_id), directory)}


@app.delete(
    "/wardrobe/items/{wardrobe_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["wardrobe"],
    summary="Remove a wardrobe garment",
)
def remove_wardrobe_item(
    wardrobe_id: str,
    principal: Principal = Depends(require_active_principal),
    repo: WardrobeRepository = Depends(get_wardrobe_repo),
) -> Response:
    """Remove a wardrobe garment by id. Idempotent: 204 either way."""
    repo.remove(principal.user_id, wardrobe_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get("/social/posts", tags=["social"], summary="The ranked social feed")
def social_feed(
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
    principal: Principal = Depends(require_active_principal),
    repo: SocialRepository = Depends(get_social_repo),
    directory: ItemDirectory = Depends(get_item_directory),
) -> dict[str, list[Post]]:
    """Posts ranked by engagement then recency, each with its look rendered."""
    return {"posts": enrich_feed(repo.feed(limit, offset), directory)}


@app.post("/social/posts", status_code=201, tags=["social"], summary="Share a look")
def create_post(
    body: PostInput,
    principal: Principal = Depends(require_active_principal),
    repo: SocialRepository = Depends(get_social_repo),
    directory: ItemDirectory = Depends(get_item_directory),
) -> Post:
    """Share an outfit as a post. The look's item ids are stored and re-rendered."""
    record = make_record(body, principal.user_id)
    repo.create(record)
    return enrich_feed([record], directory)[0]


@app.post(
    "/social/posts/{post_id}/react",
    tags=["social"],
    summary="React to a post",
    dependencies=[Depends(rate_limit("feedback", "rate_limit_feedback"))],
)
def react_to_post(
    post_id: str,
    body: ReactionInput,
    principal: Principal = Depends(require_active_principal),
    repo: SocialRepository = Depends(get_social_repo),
) -> dict[str, object]:
    """React once per (post, user). 404 if the post does not exist."""
    if repo.get(post_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown post")
    newly = repo.react(post_id, principal.user_id, body.reaction)
    return {"post_id": post_id, "reacted": newly}


@app.post(
    "/social/posts/{post_id}/recreate",
    tags=["social"],
    summary="Recreate a look for yourself",
    dependencies=[Depends(rate_limit("recommend", "rate_limit_recommend"))],
)
def recreate_post(
    post_id: str,
    principal: Principal = Depends(require_active_principal),
    social_repo: SocialRepository = Depends(get_social_repo),
    profile_repo: ProfileRepository = Depends(get_profile_repo),
    candidates: CandidateRepository = Depends(get_candidate_repo),
    taste_repo: TasteRepository = Depends(get_taste_repo),
    event_sink: EventSink = Depends(get_event_sink),
) -> OutfitRecommendation:
    """Re-render a post's look for the *caller* — never a blind copy (CLAUDE.md §2).

    The post supplies the styling intent (its occasion); GYF re-composes the look
    for the follower's own region, body and taste via the recommendation path. This
    is a real composition, not try-on imagery (deferred). 404 if the post is gone,
    404 if the caller has not onboarded.
    """
    post = social_repo.get(post_id)
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown post")
    profile = profile_repo.get(principal.user_id)
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No profile yet")
    return recommend(
        profile,
        principal.user_id,
        candidates,
        taste_repo,
        event_sink,
        post.occasion,
        post.region,
        k=5,
    )


@app.get("/profile/summary", tags=["profile"], summary="Profile stats & badges")
def profile_summary(
    principal: Principal = Depends(require_active_principal),
    repo: SummaryRepository = Depends(get_summary_repo),
) -> ProfileSummary:
    """Stats (outfits made, items saved, wardrobe size, posts, reactions) + badges."""
    return summarize(repo, principal.user_id)
