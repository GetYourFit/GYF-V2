"""Catalog surface — visual search & shop-the-look."""

from __future__ import annotations

import logging
from typing import Literal

from fastapi import APIRouter, Depends, Query, Response
from gyf_contracts.usermodel import CATALOG_GENDERS, catalog_genders_for

from ..catalog.directory import ItemDirectory
from ..catalog.retrieval import (
    CatalogFacets,
    SearchResult,
    TextEmbedder,
    VectorSearchRepository,
    browse_multi_slot,
    enrich_results,
    search_text,
    search_text_multi_slot,
)
from ..auth import Principal, get_optional_principal
from ..dependencies import (
    get_item_directory,
    get_search_repo,
    get_taste_repo,
    get_text_embedder,
)
from ..ratelimit import rate_limit
from ..recsys.taste import TasteRepository, build_taste

# How many recent engagements feed the Explore taste vector — matches the feed's
# horizon so both surfaces learn from the same window.
_TASTE_HISTORY = 200

router = APIRouter(tags=["catalog"])
logger = logging.getLogger(__name__)


class _Precomputed:
    """A :class:`TextEmbedder` holding an already-computed query vector, so the
    existing search functions run without re-embedding (the handler embeds once,
    isolating that failure-prone step from the SQL path)."""

    def __init__(self, vec: list[float]) -> None:
        self._vec = vec

    def embed_query(self, text: str) -> list[float]:
        return self._vec


def _embed_or_none(embedder: TextEmbedder | None, query: str) -> list[float] | None:
    """Embed the query, or ``None`` if no encoder is available or the encode fails
    (remote lane down/cold). Callers fall back to keyword search — never a 500."""
    if embedder is None:
        return None
    try:
        return embedder.embed_query(query)
    except Exception:  # noqa: BLE001 — any encode failure degrades to keyword search
        logger.warning("text encoder failed; falling back to keyword search", exc_info=True)
        return None


@router.get(
    "/items/{item_id}/similar",
    dependencies=[Depends(rate_limit("similar", "rate_limit_search"))],
)
def similar_items(
    response: Response,
    item_id: str,
    k: int = Query(10, ge=1, le=50),
    offset: int = Query(0, ge=0, le=10_000),
    region: str | None = Query(None, max_length=64),
    gender: str | None = Query(
        None, description="Styling gender: results narrow to that slice + unisex."
    ),
    repo: VectorSearchRepository = Depends(get_search_repo),
    directory: ItemDirectory = Depends(get_item_directory),
) -> dict[str, list[SearchResult]]:
    """Visually-similar items (nearest neighbours of the item's embedding)."""
    response.headers["Cache-Control"] = "public, max-age=30"
    hits = repo.similar_to_item(item_id, k, region, offset, genders=_genders(gender))
    return {"results": enrich_results(hits, directory)}


def _genders(gender: str | None) -> frozenset[str] | None:
    """Catalog gender facets for a stated styling gender; ``None`` = no filter."""
    allowed = catalog_genders_for(gender)
    return allowed if allowed != CATALOG_GENDERS else None


def _slot_categories(slot: str | None) -> list[str] | None:
    """Canonical catalog categories for an outfit slot (taxonomy-driven)."""
    if slot is None:
        return None
    from gyf_contracts.taxonomy import CATEGORIES  # single source of truth

    return [c.name for c in CATEGORIES if c.slot == slot]


@router.get("/items/facets", dependencies=[Depends(rate_limit("facets", "rate_limit_search"))])
def catalog_facets(
    response: Response,
    region: str | None = Query(None, max_length=64),
    repo: VectorSearchRepository = Depends(get_search_repo),
) -> CatalogFacets:
    """Real filter ranges for the (region-scoped) catalog so the client only
    offers filters the data can satisfy — e.g. ``priced == 0`` tells Explore to
    hide the price control rather than present a slider that empties the grid."""
    # Facets change only on catalog ingest — let the browser skip the round-trip.
    # Assumes caches key on the full URL incl. ?region= (browsers do; Cloudflare
    # passes this through DYNAMIC, i.e. uncached at the edge — verified 2026-07-05).
    response.headers["Cache-Control"] = "public, max-age=3600"
    return repo.catalog_facets(region)


@router.get("/items/browse", dependencies=[Depends(rate_limit("browse", "rate_limit_search"))])
def browse_items(
    response: Response,
    # le=100, not 50: the Canvas Explorer's initial load requests k=96 (one
    # big interleaved page across 4 slots) — was capped at 50, so that
    # request 422'd and the grid never rendered a single tile. Same class of
    # bug already fixed on /items/search below; mirrors its headroom.
    k: int = Query(24, ge=1, le=100),
    offset: int = Query(0, ge=0, le=10_000),
    region: str | None = Query(None, max_length=64),
    gender: str | None = Query(
        None, description="Styling gender: results narrow to that slice + unisex."
    ),
    slots: str | None = Query(
        None,
        description="Comma-separated outfit slots to interleave (e.g. "
        "'top,bottom,full_body,footwear'). Omit for a single mixed page.",
    ),
    seed: str | None = Query(
        None,
        max_length=64,
        description="Shuffle seed for the anonymous/cold-start feed. Pass a "
        "per-session value for a fresh order every visit; omit for daily rotation.",
    ),
    repo: VectorSearchRepository = Depends(get_search_repo),
    directory: ItemDirectory = Depends(get_item_directory),
    principal: Principal | None = Depends(get_optional_principal),
    taste_repo: TasteRepository = Depends(get_taste_repo),
) -> dict[str, list[SearchResult]]:
    """Explore feed. When the caller is signed in and has a learned taste vector,
    this ranks the catalogue by cosine to it (two-tower content retrieval) — the
    feed reflects what they actually engage with, per-user, and shifts as their
    taste evolves. Callers without engagement get the same cheap rotating relational
    read as anonymous users, so the first grid does not block on the remote encoder.
    ``offset`` is the global count shown, split across slots."""
    taste_vector = None
    if principal is not None:
        taste = build_taste(taste_repo.engagements(principal.user_id, _TASTE_HISTORY))
        taste_vector = taste.vector if taste.has_signal else None
    if taste_vector is not None:
        response.headers["Cache-Control"] = "private, max-age=30"  # per-user, never shared
    else:
        response.headers["Cache-Control"] = "public, max-age=60"
    if slots:
        slot_list = [s.strip() for s in slots.split(",") if s.strip()]
        per_slot_k = max(1, k // len(slot_list))
        hits = browse_multi_slot(
            repo,
            [_slot_categories(s) or [] for s in slot_list],
            per_slot_k,
            region,
            offset // len(slot_list),
            genders=_genders(gender),
            taste_vector=taste_vector,
            seed=seed,
        )
    else:
        hits = repo.browse(
            None, k, region, offset, genders=_genders(gender), taste_vector=taste_vector, seed=seed
        )
    return {"results": enrich_results(hits, directory)}


@router.get("/items/search", dependencies=[Depends(rate_limit("search", "rate_limit_search"))])
def search_items(
    response: Response,
    q: str = Query(..., min_length=1),
    # le=100: the Canvas Explorer's initial cluster load requests k=64 (one
    # big interleaved page across 4 slots) — was capped at 50, so that
    # request 422'd and the canvas rendered nothing.
    k: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0, le=10_000),
    region: str | None = Query(None, max_length=64),
    max_price: float | None = Query(
        None,
        ge=0,
        le=100_000,
        description="Upper price bound (inclusive, in the item's catalog currency). "
        "Null means no price filter.",
    ),
    sort: Literal["relevance", "price_asc", "price_desc"] = Query(
        "relevance",
        description="Result ordering: relevance (cosine similarity), price_asc, or "
        "price_desc. Price-sorted pages still carry honest relevance scores.",
    ),
    gender: str | None = Query(
        None, description="Styling gender: results narrow to that slice + unisex."
    ),
    slot: Literal["top", "bottom", "full_body", "outerwear", "footwear", "accessory"] | None = (
        Query(
            None,
            description="Outfit slot: hard-filters results to that slot's garment "
            "categories (e.g. bottom = jeans/trousers/skirt/…). Null means all slots.",
        )
    ),
    slots: str | None = Query(
        None,
        description="Comma-separated outfit slots (e.g. 'top,bottom,full_body,footwear'): "
        "one embed, one page per slot, round-robin interleaved into a single response. "
        "For multi-slot default browse — replaces N client-side search calls with one. "
        "Mutually exclusive with `slot`; `k` is the total page size, split evenly.",
    ),
    repo: VectorSearchRepository = Depends(get_search_repo),
    embedder: TextEmbedder | None = Depends(get_text_embedder),
    directory: ItemDirectory = Depends(get_item_directory),
) -> dict[str, list[SearchResult]]:
    """Text->image search over the catalog (e.g. 'red floral summer dress').

    The semantic path embeds the query and does an ANN scan. The encoder loads its
    backend lazily and delegates GPU work to a remote lane, so on the encoder-less
    prod image (or when that lane is down) embedding fails. We isolate *only* the
    embed step and fall back to a keyword title match — search keeps returning items
    instead of the raw 500 it used to throw. SQL/other errors are left to surface.
    """
    response.headers["Cache-Control"] = "public, max-age=30"
    vec = _embed_or_none(embedder, q)
    if vec is None:
        hits = repo.keyword_search(
            q,
            k,
            region,
            offset,
            max_price=max_price,
            sort=sort,
            genders=_genders(gender),
            categories=_slot_categories(slot),
        )
    elif slots:
        slot_list = [s.strip() for s in slots.split(",") if s.strip()]
        per_slot_k = max(1, k // len(slot_list))
        hits = search_text_multi_slot(
            repo,
            _Precomputed(vec),
            q,
            per_slot_k,
            region,
            offset // len(slot_list),
            [_slot_categories(s) or [] for s in slot_list],
            max_price=max_price,
            sort=sort,
            genders=_genders(gender),
        )
    else:
        hits = search_text(
            repo,
            _Precomputed(vec),
            q,
            k,
            region,
            offset,
            max_price=max_price,
            sort=sort,
            genders=_genders(gender),
            categories=_slot_categories(slot),
        )
    return {"results": enrich_results(hits, directory)}
