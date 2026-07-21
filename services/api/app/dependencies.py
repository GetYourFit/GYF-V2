"""Shared FastAPI dependencies — the app's injection seam (one place).

Every repository/adapter the routers need is constructed here behind a lazy
provider, so routes stay thin and tests swap real infrastructure for in-memory
doubles via ``app.dependency_overrides[provider]``. Providers are deliberately
import-light: the Postgres/ML runtimes are imported *inside* each function so the
process only pays for what a given route actually uses, and a missing optional
runtime degrades honestly (503 for hard deps, graceful abstain for photo modules).

``main`` re-exports these names so existing ``from app.main import get_*`` test
imports keep working unchanged.
"""

from __future__ import annotations

from functools import lru_cache

from fastapi import Depends, HTTPException, status
from gyf_contracts.eval_report import runtime_model_verdict

from gyf_contracts.consent import behavioral_learning_enabled

from .auth import Principal, get_current_principal, get_optional_principal
from .catalog.directory import ItemDirectory
from .catalog.retrieval import TextEmbedder, VectorSearchRepository
from .collections import CollectionRepository
from .config import settings
from .observability import database_ready
from .profile.account import AccountRepository
from .profile.photo import BodyAdapter, SkinToneAdapter
from .profile.repository import ProfileRepository
from .profile.summary import SummaryRepository
from .recsys.candidates import CandidateRepository
from .recsys.taste import TasteRepository
from .saved_outfits import SavedOutfitRepository
from .sink import EventSink, get_sink
from .social import SocialRepository
from .support import SupportRepository
from .wardrobe import WardrobeRepository


@lru_cache(maxsize=4)
def shared_pool(dsn: str):
    """One process-wide Postgres pool shared by every repository.

    Repositories accept an injectable ``pool``; without this, each provider built
    its own ``ConnectionPool`` per request (~5 fresh TCP+auth handshakes to the
    Supabase pooler per recommendation call, never closed). One pool caps total
    connections and makes every authed request reuse warm connections.
    """
    from psycopg_pool import ConnectionPool

    return ConnectionPool(
        dsn,
        # Production is an always-on Starter and the first authenticated request
        # is the activation path. Keep the already-budgeted three connections
        # warm instead of making that user pay serial TLS/pooler handshakes.
        # Render's old/new overlap doubles this configured maximum; any future
        # worker/pool increase must re-run the connection-budget gate.
        min_size=settings.db_pool_max_size,
        max_size=settings.db_pool_max_size,
        timeout=3.0,
        kwargs={"prepare_threshold": None},
        open=True,
    )


# Process-wide event sink (local JSONL in dev; broker/Postgres-backed once infra
# is provisioned). A module attribute so tests can monkeypatch
# ``app.dependencies.sink`` and ``get_event_sink`` picks the replacement up. The
# Postgres sink reuses the shared pool (defined above) instead of opening its own,
# so total connections stay bounded by db_pool_max_size, not pool + sink separately.
sink = get_sink(
    pool=shared_pool(settings.database_url) if settings.event_sink == "postgres" else None
)


# --- Readiness -------------------------------------------------------------


def get_readiness() -> bool:
    """Readiness signal — DB reachable. Overridable in tests via dependency_overrides."""
    return database_ready(settings.database_url)


# --- Catalog / retrieval ---------------------------------------------------


def get_search_repo() -> VectorSearchRepository:
    """The pgvector-backed retrieval repository, including catalog commerce data."""
    from .affiliate import linker_from_settings
    from .catalog.retrieval import PostgresVectorSearchRepository

    return PostgresVectorSearchRepository(
        settings.database_url,
        pool=shared_pool(settings.database_url),
        indexed_browse=settings.browse_indexed_ring_enabled,
        linker=linker_from_settings(),
    )


def get_text_embedder() -> TextEmbedder | None:
    """The SigLIP text-query embedder from the ML runtime, or ``None`` when the
    ML/torch stack is not installed in this runtime.

    Imported lazily so the API needs the stack only when text search is served.
    Returning ``None`` (rather than raising) lets ``/items/search`` fall back to a
    keyword title match, so search keeps working on the encoder-less prod image
    instead of 503-ing.

    Wrapped in the shared query-embedding cache (F2.5): a repeated query never pays
    the remote encode again, so search is a pgvector scan instead of a GPU round trip.
    """
    if not runtime_model_verdict("encoder", configured_model_uri=settings.perception_model)[0]:
        return None
    try:
        from .catalog.perception_adapter import cached_text_embedder
        from .catalog.query_cache import CachedTextEmbedder

        return CachedTextEmbedder(
            cached_text_embedder(),
            shared_pool(settings.database_url),
            settings.perception_model,
        )
    except ImportError:  # perception runtime / torch not installed
        return None


def get_item_directory() -> ItemDirectory:
    """The Postgres-backed item directory for saved/wardrobe/social item references."""
    from .affiliate import linker_from_settings
    from .catalog.directory import PostgresItemDirectory

    return PostgresItemDirectory(
        settings.database_url,
        linker=linker_from_settings(),
        pool=shared_pool(settings.database_url),
    )


# --- Profile / account -----------------------------------------------------


def get_profile_repo() -> ProfileRepository:
    """The Postgres-backed profile repository (lazy connection pool)."""
    from .profile.repository import PostgresProfileRepository

    return PostgresProfileRepository(settings.database_url, pool=shared_pool(settings.database_url))


def get_account_repo() -> AccountRepository:
    """The Postgres-backed account repository (lazy connection pool)."""
    from .profile.account import PostgresAccountRepository

    return PostgresAccountRepository(settings.database_url, pool=shared_pool(settings.database_url))


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


# --- Photo onboarding modules (graceful abstain, not a hard 503) -----------


def get_skin_adapter() -> SkinToneAdapter | None:
    """The skin-tone estimator adapter, or ``None`` if its ml runtime is absent.

    Unlike text search (a hard 503), a missing module here is a graceful per-module
    abstain: the endpoint still runs the other module, and manual entry is always
    available. Construction loads weights, so it is cached inside the adapter.
    """
    if not runtime_model_verdict("skin_tone")[0]:
        return None
    try:
        from .profile.photo import cached_skin_adapter

        return cached_skin_adapter()
    except ImportError:
        return None


def get_body_adapter() -> BodyAdapter | None:
    """The body-type estimator adapter, or ``None`` if its ml runtime is absent."""
    if not runtime_model_verdict("body")[0]:
        return None
    try:
        from .profile.photo import cached_body_adapter

        return cached_body_adapter()
    except ImportError:
        return None


# --- Recommendation & composition ------------------------------------------


def get_candidate_repo() -> CandidateRepository:
    """The Postgres-backed candidate repository (lazy connection pool)."""
    from .recsys.candidates import PostgresCandidateRepository

    return PostgresCandidateRepository(
        settings.database_url, pool=shared_pool(settings.database_url)
    )


def behavioral_learning_allowed(
    principal: Principal | None = Depends(get_optional_principal),
    repo: AccountRepository = Depends(get_account_repo),
) -> bool:
    """Whether this caller's behaviour may be learned from (F3 consent).

    The account page ships a "Learn from my activity" switch whose copy promises
    that turning it off "keeps styling on your stated preferences only". This is
    the single seam that makes that true: it gates the event sink (nothing is
    written) and the taste repository (nothing is read) — every learning caller
    routes through one of those two providers, so no route can forget the check.

    Absent flag = allowed: existing accounts predate the switch and are already
    learned from; only an explicit opt-out disables it. Anonymous callers have no
    stored behaviour to learn from at all.
    """
    if principal is None:
        return False
    # ponytail: one indexed PK read per request on the learning paths. Fold into the
    # principal if a profiler ever shows it mattering.
    return behavioral_learning_enabled(repo.get_consent(principal.user_id))


def get_taste_repo(allowed: bool = Depends(behavioral_learning_allowed)) -> TasteRepository:
    """The Postgres-backed taste repository — or an empty one when the user has
    switched behavioural learning off (their history is never read)."""
    from .recsys.taste import NoTasteRepository, PostgresTasteRepository

    if not allowed:
        return NoTasteRepository()
    return PostgresTasteRepository(settings.database_url, pool=shared_pool(settings.database_url))


def get_event_sink(allowed: bool = Depends(behavioral_learning_allowed)) -> EventSink:
    """The configured event sink (overridable in tests to avoid real writes) — or a
    dropping sink when the user has switched behavioural learning off.

    Reads the module attribute each call so a test that monkeypatches
    ``app.dependencies.sink`` (e.g. to a real Postgres sink) is honoured.
    """
    if not allowed:
        from .sink import NullEventSink

        return NullEventSink()
    return sink


# --- Stage-2 surfaces (collections, wardrobe, social, summary) -------------


def get_collection_repo() -> CollectionRepository:
    from .collections import PostgresCollectionRepository

    return PostgresCollectionRepository(
        settings.database_url, pool=shared_pool(settings.database_url)
    )


def get_saved_outfit_repo() -> SavedOutfitRepository:
    from .saved_outfits import PostgresSavedOutfitRepository

    return PostgresSavedOutfitRepository(
        settings.database_url, pool=shared_pool(settings.database_url)
    )


def get_wardrobe_repo() -> WardrobeRepository:
    from .wardrobe import PostgresWardrobeRepository

    return PostgresWardrobeRepository(
        settings.database_url, pool=shared_pool(settings.database_url)
    )


def get_social_repo() -> SocialRepository:
    from .social import PostgresSocialRepository

    return PostgresSocialRepository(settings.database_url, pool=shared_pool(settings.database_url))


def get_support_repo() -> SupportRepository:
    from .support import PostgresSupportRepository

    return PostgresSupportRepository(settings.database_url, pool=shared_pool(settings.database_url))


def get_summary_repo() -> SummaryRepository:
    from .profile.summary import PostgresSummaryRepository

    return PostgresSummaryRepository(settings.database_url, pool=shared_pool(settings.database_url))


def get_tryon_job_repo():
    """The durable try-on job queue (F8)."""
    from .tryon.jobs import PostgresTryOnJobRepository

    return PostgresTryOnJobRepository(
        settings.database_url, pool=shared_pool(settings.database_url)
    )


def get_tryon_renderer():
    """The configured TryOnRenderer port (M9, doctrine D1/D2).

    A configured provider constructs only after its registry card passes the
    production license/lane/eval gate. Anything else returns the always-available
    abstaining baseline (invariant #5) so the endpoint stays honest instead of
    serving research models or erroring.
    """
    from .tryon import NullTryOnRenderer

    if (
        settings.tryon_provider == "fal-leffa"
        and settings.fal_api_key
        and runtime_model_verdict("fal-leffa")[0]
    ):
        from .tryon.fal_leffa import FalLeffaTryOnRenderer

        return FalLeffaTryOnRenderer(settings.fal_api_key)
    if (
        settings.tryon_provider == "fashn"
        and settings.fashn_api_key
        and runtime_model_verdict("fashn")[0]
    ):
        from .tryon.fashn import FashnTryOnRenderer

        return FashnTryOnRenderer(settings.fashn_api_key, mode=settings.tryon_mode)
    return NullTryOnRenderer()
