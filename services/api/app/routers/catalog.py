"""Catalog surface — visual search & shop-the-look."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
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
from ..dependencies import get_item_directory, get_search_repo, get_text_embedder
from ..ratelimit import rate_limit

router = APIRouter(tags=["catalog"])


@router.get(
    "/items/{item_id}/similar",
    dependencies=[Depends(rate_limit("similar", "rate_limit_search"))],
)
def similar_items(
    response: Response,
    item_id: str,
    k: int = Query(10, ge=1, le=50),
    offset: int = Query(0, ge=0, le=10_000),
    region: str | None = None,
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
    region: str | None = None,
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
    k: int = Query(24, ge=1, le=50),
    offset: int = Query(0, ge=0, le=10_000),
    region: str | None = None,
    gender: str | None = Query(
        None, description="Styling gender: results narrow to that slice + unisex."
    ),
    slots: str | None = Query(
        None,
        description="Comma-separated outfit slots to interleave (e.g. "
        "'top,bottom,full_body,footwear'). Omit for a single mixed page.",
    ),
    repo: VectorSearchRepository = Depends(get_search_repo),
    directory: ItemDirectory = Depends(get_item_directory),
) -> dict[str, list[SearchResult]]:
    """Empty-state Explore feed — a cheap catalogue page, NO text embedding and NO
    vector scan (unlike /items/search). The default browse view isn't a real query,
    so paying a multi-second SigLIP embed + HNSW scan for a generic seed was pure
    waste that also 500'd the grid whenever the GPU lane was cold. This serves in
    tens of ms from a plain relational read and needs no ML runtime at all, so the
    grid fills instantly and stays up even when the encoder is down. Priced items
    with images lead; ``offset`` is the global count shown, split across slots."""
    # Near-static per (region, gender, slots): let the browser + any edge cache it.
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
        )
    else:
        hits = repo.browse(None, k, region, offset, genders=_genders(gender))
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
    region: str | None = None,
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
    embedder: TextEmbedder = Depends(get_text_embedder),
    directory: ItemDirectory = Depends(get_item_directory),
) -> dict[str, list[SearchResult]]:
    """Text->image search over the catalog (e.g. 'red floral summer dress').

    The encoder loads its backend lazily, so a missing runtime (e.g. ``open_clip``
    absent from the API image, which delegates GPU work to the remote lane) only
    raises when we actually embed. Convert that into the same honest 503 the
    construction-time path returns, never a 500 that pretends the search broke.
    """
    response.headers["Cache-Control"] = "public, max-age=30"
    try:
        if slots:
            slot_list = [s.strip() for s in slots.split(",") if s.strip()]
            per_slot_k = max(1, k // len(slot_list))
            hits = search_text_multi_slot(
                repo,
                embedder,
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
                embedder,
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
    except ImportError as exc:  # encoder backend not installed in this runtime
        raise HTTPException(status_code=503, detail="text search unavailable") from exc
