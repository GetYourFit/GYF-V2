"""Recommendation surface — outfit composition & the NL styling-goal box."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from gyf_contracts.usermodel import CATALOG_GENDERS, catalog_genders_for

from ..affiliate import linker_from_settings
from ..auth import Principal
from ..catalog.retrieval import VectorSearchRepository
from ..dependencies import (
    get_candidate_repo,
    get_event_sink,
    get_profile_repo,
    get_search_repo,
    get_taste_repo,
    get_wardrobe_repo,
    require_active_principal,
)
from ..profile.repository import ProfileRepository
from ..ratelimit import rate_limit
from ..recsys.candidates import CandidateRepository
from ..recsys.conditioning import _CATEGORIES_BY_SLOT
from ..recsys.models import OutfitItem, OutfitRecommendation
from ..recsys.service import recommend
from ..recsys.taste import TasteRepository
from ..sink import EventSink
from ..wardrobe import WardrobeRepository

router = APIRouter(tags=["recommendations"])


@router.get(
    "/outfits/recommend",
    summary="Recommend complete outfits",
    dependencies=[Depends(rate_limit("recommend", "rate_limit_recommend"))],
)
def recommend_outfits(
    occasion: str | None = Query(
        None,
        max_length=64,
        description="What you're dressing for. Overrides your profile's stored occasion.",
        openapi_examples={
            "casual": {"summary": "Casual", "value": "casual"},
            "business": {"summary": "Business", "value": "business"},
            "wedding": {"summary": "Wedding", "value": "wedding"},
            "festive": {"summary": "Festive", "value": "festive"},
        },
    ),
    k: int = Query(5, ge=1, le=20, description="How many outfits to return."),
    region: str | None = Query(
        None, max_length=64, description="Region code (e.g. IN) for culture-aware garments."
    ),
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
            "broader": {
                "summary": "Look broader",
                "value": "I want to look broader and more muscular",
            },
            "combined": {"summary": "Taller + slimmer", "value": "taller and slimmer"},
        },
    ),
    principal: Principal = Depends(require_active_principal),
    profile_repo: ProfileRepository = Depends(get_profile_repo),
    candidates: CandidateRepository = Depends(get_candidate_repo),
    taste_repo: TasteRepository = Depends(get_taste_repo),
    event_sink: EventSink = Depends(get_event_sink),
    wardrobe_repo: WardrobeRepository = Depends(get_wardrobe_repo),
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
        profile,
        principal.user_id,
        candidates,
        taste_repo,
        event_sink,
        occasion,
        region,
        k,
        goal,
        wardrobe_repo,
    )


@router.get(
    "/outfits/complete",
    summary="Complete the look around a specific item",
    dependencies=[Depends(rate_limit("recommend", "rate_limit_recommend"))],
)
def complete_look(
    item_id: str = Query(..., description="Catalog item every returned outfit is built around."),
    occasion: str | None = Query(
        None,
        max_length=64,
        description="What you're dressing for. Overrides your profile's stored occasion.",
    ),
    k: int = Query(3, ge=1, le=10, description="How many completed looks to return."),
    region: str | None = Query(
        None, max_length=64, description="Region code (e.g. IN) for culture-aware garments."
    ),
    goal: str | None = Query(
        None, max_length=200, description="Free-text styling goal (taller / slimmer / broader)."
    ),
    principal: Principal = Depends(require_active_principal),
    profile_repo: ProfileRepository = Depends(get_profile_repo),
    candidates: CandidateRepository = Depends(get_candidate_repo),
    taste_repo: TasteRepository = Depends(get_taste_repo),
    event_sink: EventSink = Depends(get_event_sink),
    wardrobe_repo: WardrobeRepository = Depends(get_wardrobe_repo),
) -> OutfitRecommendation:
    """Complete, personalized outfits pinned to one product ("complete the look").

    The item is the sole candidate in its slot, so every outfit contains it —
    the rest of the look (e.g. pants + shoes around a chosen shirt) is styled by
    the same engine as the feed: occasion, undertone, taste, wardrobe grounding,
    NL goals, diversity, explanation and confidence all apply. 404s when the
    item is unknown or the user has no profile yet.
    """
    profile = profile_repo.get(principal.user_id)
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No profile yet")
    try:
        return recommend(
            profile,
            principal.user_id,
            candidates,
            taste_repo,
            event_sink,
            occasion,
            region,
            k,
            goal,
            wardrobe_repo,
            anchor_item_id=item_id,
        )
    except LookupError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown item") from None


@router.get(
    "/outfits/alternates",
    summary="Same-slot alternates for one garment in a look (swap-a-piece)",
    dependencies=[Depends(rate_limit("recommend", "rate_limit_recommend"))],
)
def outfit_alternates(
    item_id: str = Query(..., description="The garment being swapped out."),
    recommendation_id: str | None = Query(
        None, description="The slate the outfit came from — joins the swap to it."
    ),
    k: int = Query(3, ge=1, le=6, description="How many alternates to return."),
    region: str | None = Query(None, max_length=64, description="Region code (e.g. IN)."),
    principal: Principal = Depends(require_active_principal),
    profile_repo: ProfileRepository = Depends(get_profile_repo),
    candidates: CandidateRepository = Depends(get_candidate_repo),
    search_repo: VectorSearchRepository = Depends(get_search_repo),
) -> dict[str, list[OutfitItem]]:
    """Visually-coherent replacements for one piece of a recommended outfit.

    Nearest neighbours of the garment's embedding, restricted to the same slot's
    categories and the user's gender slice, hydrated to full outfit items with
    affiliate-wrapped links (attributed to ``recommendation_id`` when given).
    Every swap the client then reports (action=``swap``) is a labelled
    compatibility example. 404s when the item is unknown.
    """
    base = candidates.candidates_by_ids([item_id])
    if not base:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown item")
    slot = base[0].slot
    categories = list(_CATEGORIES_BY_SLOT.get(slot, ())) or [base[0].category]
    profile = profile_repo.get(principal.user_id)
    genders = catalog_genders_for(profile.gender) if profile else CATALOG_GENDERS
    hits = search_repo.similar_to_item(
        item_id,
        k,
        region,
        genders=genders if genders != CATALOG_GENDERS else None,
        categories=categories,
    )
    by_id = {c.item_id: c for c in candidates.candidates_by_ids([h.item_id for h in hits])}
    linker = linker_from_settings()
    items: list[OutfitItem] = []
    for hit in hits:  # preserve similarity order through hydration
        c = by_id.get(hit.item_id)
        if c is None:
            continue
        item = OutfitItem.from_candidate(c)
        item.affiliate_url = linker.wrap(item.affiliate_url, recommendation_id or "swap")
        items.append(item)
    return {"alternates": items}
