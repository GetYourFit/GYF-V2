"""Recommendation surface — outfit composition & the NL styling-goal box."""

from __future__ import annotations

import logging
import re
import time

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from gyf_contracts.usermodel import CATALOG_GENDERS, STYLE_INTENTS, catalog_genders_for

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
from ..events import InteractionAction, InteractionEvent, InteractionTarget
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
logger = logging.getLogger("gyf")
_STYLE_PATTERN = "^(?:" + "|".join(re.escape(value) for value in sorted(STYLE_INTENTS)) + ")$"


def _profile_for_request(repo: ProfileRepository, user_id: str, request: Request):
    start = time.perf_counter()
    outcome = "success"
    try:
        return repo.get(user_id)
    except BaseException:
        outcome = "error"
        raise
    finally:
        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        request_id = getattr(request.state, "request_id", "-")
        logger.info(
            "recommendation_stage request_id=%s stage=profile outcome=%s duration_ms=%.2f",
            request_id,
            outcome,
            duration_ms,
            extra={
                "request_id": request_id,
                "stage": "profile",
                "outcome": outcome,
                "duration_ms": duration_ms,
            },
        )


@router.get(
    "/outfits/recommend",
    summary="Recommend complete outfits",
    dependencies=[Depends(rate_limit("recommend", "rate_limit_recommend"))],
)
def recommend_outfits(
    request: Request,
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
    style: str | None = Query(
        None,
        pattern=_STYLE_PATTERN,
        description="Controlled style for this slate only; the stored profile is unchanged.",
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
    profile = _profile_for_request(profile_repo, principal.user_id, request)
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No profile yet")
    if style is not None:
        profile = profile.model_copy(deep=True)
        profile.style_intent = [style]
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
        request_id=getattr(request.state, "request_id", "-"),
    )


@router.get(
    "/outfits/complete",
    summary="Complete the look around a specific item",
    dependencies=[Depends(rate_limit("recommend", "rate_limit_recommend"))],
)
def complete_look(
    request: Request,
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
    style: str | None = Query(
        None,
        pattern=_STYLE_PATTERN,
        description="Controlled style for this slate only; the stored profile is unchanged.",
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
    profile = _profile_for_request(profile_repo, principal.user_id, request)
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No profile yet")
    if style is not None:
        profile = profile.model_copy(deep=True)
        profile.style_intent = [style]
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
            request_id=getattr(request.state, "request_id", "-"),
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
    event_sink: EventSink = Depends(get_event_sink),
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
    scores: dict[str, float | None] = {}
    for hit in hits:  # preserve similarity order through hydration
        c = by_id.get(hit.item_id)
        if c is None or c.slot != slot:
            continue
        item = OutfitItem.from_candidate(c)
        item.affiliate_url = linker.wrap(item.affiliate_url, recommendation_id or "swap")
        items.append(item)
        raw_score = getattr(hit, "score", None)
        scores[item.item_id] = float(raw_score) if raw_score is not None else None
    _log_alternate_impressions(
        event_sink, principal.user_id, recommendation_id, item_id, items, scores
    )
    return {"alternates": items}


def _log_alternate_impressions(
    sink: EventSink,
    user_id: str,
    recommendation_id: str | None,
    replaced_item_id: str,
    alternates: list[OutfitItem],
    scores: dict[str, float | None],
) -> None:
    """Record swap choices as served exposures before the user corrects a look.

    Alternates are part of the recommendation loop: if a user chooses one, that
    correction should join to something GYF actually served, not become an
    unverified organic label. Logging remains best-effort, matching the main
    slate impression path, so a telemetry outage never blocks the UI.
    """
    if not alternates:
        return
    try:
        events = []
        for rank, item in enumerate(alternates):
            context: dict[str, object] = {
                "surface": "alternates",
                "replaced_item_id": replaced_item_id,
                "rank": rank,
            }
            if recommendation_id:
                context["recommendation_id"] = recommendation_id
            score = scores.get(item.item_id)
            if score is not None:
                context["score"] = score
            events.append(
                InteractionEvent(
                    user_id=user_id,
                    target_type=InteractionTarget.ITEM,
                    target_id=item.item_id,
                    action=InteractionAction.IMPRESSION,
                    context=context,
                )
            )
        sink.publish_many(events)
    except Exception:  # noqa: BLE001 — exposure telemetry must not block alternates
        logger.warning(
            "alternate impression logging failed for recommendation %s", recommendation_id
        )
