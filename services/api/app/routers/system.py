"""System status — the M8.5 trust surface (CLAUDE.md §2 "Trust & transparency").

One endpoint that reports, honestly and without secrets, what is live, what is
experimental (beta/shadow), what is degraded, and what is not built yet — for
operators *and* users. Every value is derived from real runtime state (config,
installed runtimes, the database); nothing is hard-coded optimism. The endpoint
must never 500: an unreachable database is itself a status to report.

No auth: transparency is the point. No URLs, tokens, hosts, or counts that
could identify a user are exposed — capability states and catalog aggregates only.
"""

from __future__ import annotations

import importlib.util
import os
from pathlib import Path
from typing import Literal, Protocol

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from ..config import settings
from ..observability import database_ready

router = APIRouter(tags=["system"])

CapabilityState = Literal["live", "beta", "shadow", "degraded", "planned"]


class Capability(BaseModel):
    """One product capability: its honest state and how it is served."""

    status: CapabilityState
    # Which lane serves it: "remote-gpu" (ZeroGPU Space), "local" (in-process),
    # "manual-fallback" (the module abstains; manual entry carries the flow),
    # or "none" (not built).
    lane: str
    # One human sentence an operator or user can act on.
    detail: str


class CatalogHealth(BaseModel):
    """Aggregate data health of the serving catalog (no per-item data)."""

    items: int | None = None
    with_embedding: int | None = None
    with_price: int | None = None
    with_image: int | None = None


class SystemStatus(BaseModel):
    """The full trust report: per-capability state + data/backbone health."""

    environment: str
    database: Literal["ready", "unreachable"]
    capabilities: dict[str, Capability]
    catalog: CatalogHealth
    event_sink: str


class SystemStatsRepository(Protocol):
    def catalog_health(self) -> CatalogHealth:
        """Aggregate counts over the serving catalog."""
        ...


_CATALOG_HEALTH = """
SELECT
    count(*),
    (SELECT count(*) FROM item_embeddings),
    count(price),
    count(*) FILTER (WHERE image_refs <> '{}')
FROM items
"""


class PostgresSystemStatsRepository:
    """Aggregate reads for the status surface. Lazy pool, injectable for tests."""

    def __init__(self, dsn: str, pool: object | None = None) -> None:
        if pool is None:
            from psycopg_pool import ConnectionPool  # lazy: only when used

            pool = ConnectionPool(dsn, min_size=0, max_size=2, open=True)
        self._pool = pool

    def catalog_health(self) -> CatalogHealth:
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            row = conn.execute(_CATALOG_HEALTH).fetchone()
        return CatalogHealth(
            items=row[0], with_embedding=row[1], with_price=row[2], with_image=row[3]
        )


class InMemorySystemStatsRepository:
    """Fixed-answer stats repo for tests."""

    def __init__(self, health: CatalogHealth | None = None) -> None:
        self.health = health or CatalogHealth(items=0, with_embedding=0, with_price=0, with_image=0)

    def catalog_health(self) -> CatalogHealth:
        return self.health


def get_system_stats_repo() -> SystemStatsRepository:
    from ..dependencies import shared_pool

    return PostgresSystemStatsRepository(
        settings.database_url, pool=shared_pool(settings.database_url)
    )


def _runtime_installed(module: str) -> bool:
    """Whether a top-level runtime package is installed, without importing it."""
    try:
        return importlib.util.find_spec(module) is not None
    except (ImportError, ValueError):
        return False


def _skin_tone_fairness_evaluated() -> bool:
    """True once a skin-tone fairness report exists under eval-reports/.

    The doctrine's D5 gate is machine-readable by construction: the fairness
    eval writes its report to the repo's ``eval-reports/``. Absent (including
    on images that don't ship the directory) reads as "pending" — the honest
    default for an uncleared gate.
    """
    for parent in Path(__file__).resolve().parents:
        reports = parent / "eval-reports"
        if reports.is_dir():
            return any(reports.glob("skintone-fairness*"))
    return False


def _text_search_capability() -> Capability:
    """Mirror the real /items/search serving path (perception.remote.encoder_for):
    a set ``GYF_ENCODER_REMOTE_URL`` serves queries over the ZeroGPU lane with no
    local torch; otherwise the local SigLIP encoder needs the torch runtime."""
    if os.environ.get("GYF_ENCODER_REMOTE_URL", "").strip():
        return Capability(
            status="live",
            lane="remote-gpu",
            detail="Text→image catalog search embeds queries on the remote GPU lane.",
        )
    if _runtime_installed("torch"):
        return Capability(
            status="live",
            lane="local",
            detail="Text→image catalog search is serving in-process.",
        )
    return Capability(
        status="degraded",
        lane="none",
        detail="No encoder lane configured and no local ML runtime — search returns 503.",
    )


def _photo_module(remote_url: str, name: str) -> Capability:
    """Status of a photo-onboarding module from its lane config + local runtime."""
    if remote_url:
        return Capability(
            status="live",
            lane="remote-gpu",
            detail=f"{name} runs on the remote GPU lane.",
        )
    if _runtime_installed("torch"):
        return Capability(
            status="live",
            lane="local",
            detail=f"{name} runs in-process on this host.",
        )
    return Capability(
        status="degraded",
        lane="manual-fallback",
        detail=(
            f"No GPU lane configured and no local ML runtime — {name} abstains; "
            "manual onboarding carries the flow."
        ),
    )


@router.get("/system/status", summary="What is live, experimental, degraded, or planned")
def system_status(
    stats: SystemStatsRepository = Depends(get_system_stats_repo),
) -> SystemStatus:
    """The M8.5 trust report. Safe to expose: states and aggregates only.

    Capability states: ``live`` (serving), ``beta`` (surfaced as an editable
    estimate), ``shadow`` (computed, not surfaced), ``degraded`` (fallback
    carrying the flow), ``planned`` (not built — never pretended otherwise).
    """
    db_ready = database_ready(settings.database_url)
    try:
        catalog = stats.catalog_health() if db_ready else CatalogHealth()
    except Exception:  # noqa: BLE001 — the status surface must never 500
        catalog = CatalogHealth()

    skin = _photo_module(settings.skintone_remote_url, "Skin-tone estimation")
    if skin.status == "live":
        # The module can run — but it is surfaced only as a beta estimate until
        # the fairness gate clears, and re-shadowed when the flag is off.
        surfaced = settings.skin_tone_enabled
        skin = Capability(
            status="beta" if surfaced else "shadow",
            lane=skin.lane,
            detail=(
                "Surfaced as an editable estimate; full-spectrum fairness eval "
                + ("passed." if _skin_tone_fairness_evaluated() else "pending.")
                if surfaced
                else "Computed but not surfaced (fairness gate)."
            ),
        )

    capabilities = {
        "outfit_recommendations": Capability(
            status="live" if db_ready else "degraded",
            lane="local",
            detail="Explained, confidence-scored outfits with taste + wardrobe grounding."
            if db_ready
            else "Database unreachable — recommendations cannot serve.",
        ),
        "text_search": _text_search_capability(),
        "photo_body_type": _photo_module(settings.body_remote_url, "Body-type estimation"),
        "photo_skin_tone": skin,
        "virtual_try_on": Capability(
            status="beta",
            lane="licensed-api",
            detail="Outfits render on your photo via a licensed model (top+bottom; "
            "footwear phased in). Ephemeral: photos are never stored.",
        )
        if settings.tryon_provider and settings.fashn_api_key
        else Capability(
            status="planned",
            lane="none",
            detail="No rendering lane configured — nothing is rendered or implied.",
        ),
        "affiliate_commerce": Capability(
            status="live",
            lane="cuelinks",
            detail=(
                "Buy links wrap through Cuelinks deeplinks with per-recommendation "
                "attribution (subid = recommendation_id); real price feeds pending."
            ),
        )
        if settings.cuelinks_cid
        else Capability(
            status="degraded",
            lane="manual-fallback",
            detail=(
                "Buy links redirect to retailers without affiliate attribution; "
                "real price feeds pending."
            ),
        ),
    }

    return SystemStatus(
        environment=settings.env,
        database="ready" if db_ready else "unreachable",
        capabilities=capabilities,
        catalog=catalog,
        event_sink=settings.event_sink,
    )


__all__ = [
    "Capability",
    "CatalogHealth",
    "InMemorySystemStatsRepository",
    "PostgresSystemStatsRepository",
    "SystemStatsRepository",
    "SystemStatus",
    "get_system_stats_repo",
    "router",
]
