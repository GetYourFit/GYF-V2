"""Social surface — shareable style posts, reactions & follower re-rendering."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..auth import Principal
from ..catalog.directory import ItemDirectory
from ..dependencies import (
    get_candidate_repo,
    get_event_sink,
    get_item_directory,
    get_profile_repo,
    get_social_repo,
    get_taste_repo,
    require_active_principal,
)
from ..profile.repository import ProfileRepository
from ..ratelimit import rate_limit
from ..recsys.candidates import CandidateRepository
from ..recsys.models import OutfitRecommendation
from ..recsys.service import recommend
from ..recsys.taste import TasteRepository
from ..sink import EventSink
from ..social import (
    Post,
    PostInput,
    ReactionInput,
    SocialRepository,
    enrich_feed,
    make_record,
)

router = APIRouter(tags=["social"])


@router.get("/social/posts", summary="The ranked social feed")
def social_feed(
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
    principal: Principal = Depends(require_active_principal),
    repo: SocialRepository = Depends(get_social_repo),
    directory: ItemDirectory = Depends(get_item_directory),
) -> dict[str, list[Post]]:
    """Posts ranked by engagement then recency, each with its look rendered."""
    return {"posts": enrich_feed(repo.feed(limit, offset), directory)}


@router.post("/social/posts", status_code=201, summary="Share a look")
def create_post(
    body: PostInput,
    principal: Principal = Depends(require_active_principal),
    repo: SocialRepository = Depends(get_social_repo),
    directory: ItemDirectory = Depends(get_item_directory),
) -> Post:
    """Share an outfit as a post. The look's item ids are stored and re-rendered."""
    record = make_record(body, principal.user_id)
    repo.create(record)
    return enrich_feed([record], directory)[0]


@router.post(
    "/social/posts/{post_id}/react",
    summary="React to a post",
    dependencies=[Depends(rate_limit("feedback", "rate_limit_feedback"))],
)
def react_to_post(
    post_id: str,
    body: ReactionInput,
    principal: Principal = Depends(require_active_principal),
    repo: SocialRepository = Depends(get_social_repo),
) -> dict[str, object]:
    """React once per (post, user). 404 if the post does not exist."""
    if repo.get(post_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown post")
    newly = repo.react(post_id, principal.user_id, body.reaction)
    return {"post_id": post_id, "reacted": newly}


@router.post(
    "/social/posts/{post_id}/recreate",
    summary="Recreate a look for yourself",
    dependencies=[Depends(rate_limit("recommend", "rate_limit_recommend"))],
)
def recreate_post(
    post_id: str,
    principal: Principal = Depends(require_active_principal),
    social_repo: SocialRepository = Depends(get_social_repo),
    profile_repo: ProfileRepository = Depends(get_profile_repo),
    candidates: CandidateRepository = Depends(get_candidate_repo),
    taste_repo: TasteRepository = Depends(get_taste_repo),
    event_sink: EventSink = Depends(get_event_sink),
) -> OutfitRecommendation:
    """Re-render a post's look for the *caller* — never a blind copy (CLAUDE.md §2).

    The post supplies the styling intent (its occasion); GYF re-composes the look
    for the follower's own region, body and taste via the recommendation path. This
    is a real composition, not try-on imagery (deferred). 404 if the post is gone,
    404 if the caller has not onboarded.
    """
    post = social_repo.get(post_id)
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown post")
    profile = profile_repo.get(principal.user_id)
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No profile yet")
    return recommend(
        profile,
        principal.user_id,
        candidates,
        taste_repo,
        event_sink,
        post.occasion,
        post.region,
        k=5,
    )
