"""GYF core API — application wiring.

Constructs the FastAPI app (OpenAPI metadata, CORS, observability, static media)
and mounts the system probes + the visual gallery. Every product surface lives in
its own router under :mod:`app.routers`, and all repository/adapter construction
lives in :mod:`app.dependencies`. This module is the composition root — it wires
those together and nothing else.

The dependency providers are re-exported at the bottom so existing
``from app.main import get_*`` imports (and ``app.dependency_overrides`` keyed on
them) keep working unchanged.
"""

from __future__ import annotations

import logging
from pathlib import Path

from fastapi import Depends, FastAPI, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from .auth import Principal, get_current_principal
from .config import settings
from .dependencies import get_readiness
from .metrics import install_metrics, metrics_enabled
from .observability import install_request_context
from .routers import (
    catalog,
    collections,
    feedback,
    profile,
    recommendations,
    social,
    wardrobe,
)
from .telemetry import configure_telemetry

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
        {
            "name": "social",
            "description": "Shareable style posts, reactions & follower re-rendering.",
        },
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


def _media_root() -> Path | None:
    """Resolve the catalog-image directory, or ``None`` if it doesn't exist.

    A relative ``media_dir`` resolves against the repo root (this file is at
    ``services/api/app/main.py``) so the mount works regardless of the process
    working directory.
    """
    configured = Path(settings.media_dir)
    root = (
        configured if configured.is_absolute() else Path(__file__).resolve().parents[3] / configured
    )
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


# --- System probes & the visual gallery ------------------------------------


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


# --- Product surfaces ------------------------------------------------------

app.include_router(catalog.router)
app.include_router(profile.router)
app.include_router(recommendations.router)
app.include_router(feedback.router)
app.include_router(collections.router)
app.include_router(wardrobe.router)
app.include_router(social.router)


# --- Back-compat re-exports -------------------------------------------------
# The dependency providers moved to ``app.dependencies``; re-export them so
# ``from app.main import get_*`` and ``app.dependency_overrides[get_*]`` keep
# working. ``sink`` is re-exported for callers that reference ``main.sink``;
# tests that need to swap it should patch ``app.dependencies.sink`` (the single
# source ``get_event_sink`` reads).
from .dependencies import (  # noqa: E402  (re-export after app construction)
    get_account_repo,
    get_body_adapter,
    get_candidate_repo,
    get_collection_repo,
    get_event_sink,
    get_item_directory,
    get_profile_repo,
    get_saved_outfit_repo,
    get_search_repo,
    get_skin_adapter,
    get_social_repo,
    get_summary_repo,
    get_taste_repo,
    get_text_embedder,
    get_wardrobe_repo,
    require_active_principal,
    sink,
)

__all__ = [
    "app",
    "get_account_repo",
    "get_body_adapter",
    "get_candidate_repo",
    "get_collection_repo",
    "get_event_sink",
    "get_item_directory",
    "get_profile_repo",
    "get_readiness",
    "get_saved_outfit_repo",
    "get_search_repo",
    "get_skin_adapter",
    "get_social_repo",
    "get_summary_repo",
    "get_taste_repo",
    "get_text_embedder",
    "get_wardrobe_repo",
    "require_active_principal",
    "sink",
]
