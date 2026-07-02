"""Recommendation surface — outfit composition & the NL styling-goal box."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..auth import Principal
from ..dependencies import (
    get_candidate_repo,
    get_event_sink,
    get_profile_repo,
    get_taste_repo,
    get_wardrobe_repo,
    require_active_principal,
)
from ..profile.repository import ProfileRepository
from ..ratelimit import rate_limit
from ..recsys.candidates import CandidateRepository
from ..recsys.models import OutfitRecommendation
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
        None, description="Region code (e.g. IN) for culture-aware garments."
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
