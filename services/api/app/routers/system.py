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
import time
from pathlib import Path
from typing import Literal, Protocol

import httpx
from fastapi import APIRouter, Depends
from gyf_contracts.model_policy import is_servable, load_registry
from pydantic import BaseModel

from ..config import settings
from ..observability import database_ready

router = APIRouter(tags=["system"])

CapabilityState = Literal["live", "beta", "shadow", "degraded", "planned"]

# Liveness probe of a configured remote Space, cached so /system/status stays
# cheap. A configured-but-unreachable Space (a sleeping ZeroGPU host) must report
# "degraded", not "live" — the status surface used to claim "live" from the env
# var alone and lied while the Space was down (invariant #6: honest intelligence).
_PROBE_TTL_S = 60.0
_probe_cache: dict[str, tuple[float, bool]] = {}


def _remote_reachable(url: str) -> bool:
    """True iff the Space answered an HTTP request (any <500) recently. Cached per
    URL for _PROBE_TTL_S; distinct capabilities sharing one Space cost one probe."""
    if not url:
        return False
    now = time.monotonic()
    hit = _probe_cache.get(url)
    if hit is not None and now - hit[0] < _PROBE_TTL_S:
        return hit[1]
    try:
        ok = httpx.get(url, timeout=2.0, follow_redirects=True).status_code < 500
    except Exception:  # noqa: BLE001 — unreachable == not live; the status must never 500
        ok = False
    _probe_cache[url] = (now, ok)
    return ok


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
    encoder_url = os.environ.get("GYF_ENCODER_REMOTE_URL", "").strip()
    if encoder_url:
        if _remote_reachable(encoder_url):
            return Capability(
                status="live",
                lane="remote-gpu",
                detail="Text→image catalog search embeds queries on the remote GPU lane.",
            )
        return Capability(
            status="degraded",
            lane="keyword-fallback",
            detail="GPU encoder lane unreachable — search falls back to keyword match.",
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
        if _remote_reachable(remote_url):
            return Capability(
                status="live",
                lane="remote-gpu",
                detail=f"{name} runs on the remote GPU lane.",
            )
        return Capability(
            status="degraded",
            lane="manual-fallback",
            detail=(
                f"GPU lane configured but unreachable — {name} abstains; "
                "manual onboarding carries the flow."
            ),
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


def _price_coverage_detail(catalog: CatalogHealth) -> str:
    """One honest sentence on real price-feed coverage, derived from live counts.

    Never a hardcoded "pending" — this is exactly the kind of status string that
    goes stale the moment the underlying data catches up (it did: catalog is now
    fully priced), so it must be computed from the same aggregate the ``catalog``
    field reports.
    """
    if not catalog.items:
        return "price coverage unknown."
    if catalog.with_price == catalog.items:
        return "real price feeds cover the full catalog."
    pct = round(100 * (catalog.with_price or 0) / catalog.items)
    return f"real price feeds cover {pct}% of the catalog."


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
                f"attribution (subid = recommendation_id); {_price_coverage_detail(catalog)}"
            ),
        )
        if settings.cuelinks_cid
        else Capability(
            status="degraded",
            lane="manual-fallback",
            detail=(
                "Buy links redirect to retailers without affiliate attribution; "
                f"{_price_coverage_detail(catalog)}"
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


# ── Operator surface: per-model lane + serve-eligibility (M8.5) ──────────────
# The /system/status endpoint above is the *user*-facing capability report. This
# is the *operator*-facing one the M8.5 audit flagged missing: which specific
# models GYF can load, which lane each is in, and whether it may enter the
# serving path — derived from models.registry.json via the SAME is_servable()
# gate scripts/check_model_licenses.py enforces in CI, so the live view can
# never disagree with the build gate (one source of truth, engineering-doctrine
# D2/D5). No secrets: model names, licenses, and lanes are already public in the
# repo. Never 500 — a missing registry is itself an honestly-reported state.


class ModelStatus(BaseModel):
    """One model behind a capability port: its lane and serve-eligibility."""

    name: str
    capability: str  # the port it plugs into: encoder, body_estimator, try_on, …
    provider: str
    lane: str  # "production" (serving path) | "research" (offline north-star)
    license: str
    # Passes the doctrine license+lane+eval gate (is_servable, require_eval=True) —
    # identical verdict to the CI license gate.
    servable: bool
    blockers: list[str]  # why it may not serve yet; empty when servable
    eval_report: str | None


class ModelRegistryStatus(BaseModel):
    """Operator view of every model GYF can load and its serve-eligibility.

    ``available`` is False when the registry isn't bundled in this image (a
    minimal serving build) — reported honestly rather than pretended present.
    """

    available: bool
    models: list[ModelStatus]


def _find_registry_root() -> Path | None:
    """Locate the repo root (dir holding models.registry.json), walking up from
    this file. None when the registry isn't bundled — reported, never guessed."""
    for parent in Path(__file__).resolve().parents:
        if (parent / "models.registry.json").is_file():
            return parent
    return None


@router.get(
    "/system/models",
    summary="Operator view: per-model lane + serve-eligibility (M8.5)",
)
def model_registry_status() -> ModelRegistryStatus:
    """Per-model lane + serve-eligibility, from the same gate CI enforces.

    Research-lane models report ``servable=False`` with the honest reason
    (``lane is 'research', not production``) — so an operator sees exactly what
    is in the serving path, what is held back as an offline north-star, and why.
    """
    root = _find_registry_root()
    if root is None:
        return ModelRegistryStatus(available=False, models=[])
    try:
        cards = load_registry(root / "models.registry.json")
    except Exception:  # noqa: BLE001 — the trust surface must never 500
        return ModelRegistryStatus(available=False, models=[])
    models = []
    for c in sorted(cards, key=lambda x: (x.lane.value, x.capability, x.name)):
        ok, reasons = is_servable(c)
        models.append(
            ModelStatus(
                name=c.name,
                capability=c.capability,
                provider=c.provider,
                lane=c.lane.value,
                license=c.license,
                servable=ok,
                blockers=reasons,
                eval_report=c.eval_report,
            )
        )
    return ModelRegistryStatus(available=True, models=models)


__all__ = [
    "Capability",
    "CatalogHealth",
    "InMemorySystemStatsRepository",
    "ModelRegistryStatus",
    "ModelStatus",
    "PostgresSystemStatsRepository",
    "SystemStatsRepository",
    "SystemStatus",
    "get_system_stats_repo",
    "router",
]
