"""Catalog surface — visual search & shop-the-look."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from ..catalog.directory import ItemDirectory
from ..catalog.retrieval import (
    SearchResult,
    TextEmbedder,
    VectorSearchRepository,
    enrich_results,
    search_text,
)
from ..dependencies import get_item_directory, get_search_repo, get_text_embedder
from ..ratelimit import rate_limit

router = APIRouter(tags=["catalog"])


@router.get("/items/{item_id}/similar")
def similar_items(
    item_id: str,
    k: int = Query(10, ge=1, le=50),
    offset: int = Query(0, ge=0),
    region: str | None = None,
    repo: VectorSearchRepository = Depends(get_search_repo),
    directory: ItemDirectory = Depends(get_item_directory),
) -> dict[str, list[SearchResult]]:
    """Visually-similar items (nearest neighbours of the item's embedding)."""
    hits = repo.similar_to_item(item_id, k, region, offset)
    return {"results": enrich_results(hits, directory)}


@router.get("/items/search", dependencies=[Depends(rate_limit("search", "rate_limit_search"))])
def search_items(
    q: str = Query(..., min_length=1),
    k: int = Query(10, ge=1, le=50),
    offset: int = Query(0, ge=0),
    region: str | None = None,
    max_price: float | None = Query(None, ge=0),
    sort: str = Query("relevance", pattern="^(relevance|price_asc|price_desc)$"),
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
    try:
        hits = search_text(repo, embedder, q, k, region, offset, max_price, sort)
        return {"results": enrich_results(hits, directory)}
    except ImportError as exc:  # encoder backend not installed in this runtime
        raise HTTPException(status_code=503, detail="text search unavailable") from exc
