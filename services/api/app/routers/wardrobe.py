"""Wardrobe surface — the garments a user owns; styled around."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status

from ..auth import Principal
from ..catalog.directory import ItemDirectory
from ..dependencies import get_item_directory, get_wardrobe_repo, require_active_principal
from ..ratelimit import rate_limit
from ..wardrobe import (
    WardrobeItem,
    WardrobeItemInput,
    WardrobeRepository,
    build_record,
    enrich as enrich_wardrobe,
)

router = APIRouter(tags=["wardrobe"])

_MUTATION_LIMIT = Depends(rate_limit("wardrobe", "rate_limit_mutation"))


@router.post(
    "/wardrobe/items",
    status_code=201,
    summary="Add an owned garment",
    dependencies=[_MUTATION_LIMIT],
)
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


@router.get("/wardrobe/items", summary="The user's wardrobe")
def list_wardrobe(
    principal: Principal = Depends(require_active_principal),
    repo: WardrobeRepository = Depends(get_wardrobe_repo),
    directory: ItemDirectory = Depends(get_item_directory),
) -> dict[str, list[WardrobeItem]]:
    """The user's owned garments, most-recently-added first."""
    return {"items": enrich_wardrobe(repo.list(principal.user_id), directory)}


@router.delete(
    "/wardrobe/items/{wardrobe_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a wardrobe garment",
    dependencies=[_MUTATION_LIMIT],
)
def remove_wardrobe_item(
    wardrobe_id: str,
    principal: Principal = Depends(require_active_principal),
    repo: WardrobeRepository = Depends(get_wardrobe_repo),
) -> Response:
    """Remove a wardrobe garment by id. Idempotent: 204 either way."""
    repo.remove(principal.user_id, wardrobe_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
