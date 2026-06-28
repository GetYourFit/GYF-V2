"""Collections surface — saved items and saved looks."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status

from ..auth import Principal
from ..catalog.directory import ItemDirectory
from ..collections import (
    CollectionRepository,
    SaveItemRequest,
    SavedItem,
    enrich as enrich_saved,
)
from ..dependencies import (
    get_collection_repo,
    get_item_directory,
    get_saved_outfit_repo,
    require_active_principal,
)
from ..saved_outfits import (
    SavedOutfit,
    SavedOutfitRepository,
    SaveOutfitRequest,
    enrich as enrich_saved_outfits,
)

router = APIRouter(tags=["collections"])


@router.post("/collections", status_code=201, summary="Save an item")
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


@router.get("/collections", summary="The user's saved items")
def list_collection(
    principal: Principal = Depends(require_active_principal),
    repo: CollectionRepository = Depends(get_collection_repo),
    directory: ItemDirectory = Depends(get_item_directory),
) -> dict[str, list[SavedItem]]:
    """The user's saved items, most-recently-saved first, enriched for display."""
    return {"items": enrich_saved(repo.list_item_ids(principal.user_id), directory)}


@router.delete(
    "/collections/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
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


@router.post("/collections/outfits", status_code=201, summary="Save a whole look")
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


@router.get("/collections/outfits", summary="The user's saved looks")
def list_saved_outfits(
    principal: Principal = Depends(require_active_principal),
    repo: SavedOutfitRepository = Depends(get_saved_outfit_repo),
    directory: ItemDirectory = Depends(get_item_directory),
) -> dict[str, list[SavedOutfit]]:
    """The user's saved looks, most-recently-saved first, each re-rendered."""
    return {"outfits": enrich_saved_outfits(repo.list(principal.user_id), directory)}


@router.delete(
    "/collections/outfits/{outfit_id}",
    status_code=status.HTTP_204_NO_CONTENT,
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
