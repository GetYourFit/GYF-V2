"""Social surface — shareable style posts, reactions & follower re-rendering."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status

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
    ReportInput,
    SocialRepository,
    enrich_feed,
    make_record,
)

router = APIRouter(tags=["social"])


@router.get("/social/posts", summary="The ranked social feed")
def social_feed(
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0, le=10_000),
    scope: Literal["all", "following"] = Query(
        "all",
        description="'all' = the global feed; 'following' = only posts by authors "
        "the caller follows (empty until they follow someone).",
    ),
    principal: Principal = Depends(require_active_principal),
    repo: SocialRepository = Depends(get_social_repo),
    directory: ItemDirectory = Depends(get_item_directory),
) -> dict[str, list[Post]]:
    """Posts ranked by engagement then recency, each with its look rendered."""
    authors = repo.following(principal.user_id) if scope == "following" else None
    records = repo.feed(limit, offset, authors)
    # ponytail: post-fetch block filter — a page dominated by blocked authors can
    # under-fill; push the exclusion into the feed SQL if block lists ever grow.
    hidden = set(repo.blocked(principal.user_id))
    if hidden:
        records = [r for r in records if r.user_id not in hidden]
    reacted = repo.reacted_post_ids(principal.user_id, [r.id for r in records])
    return {"posts": enrich_feed(records, directory, reacted)}


@router.post(
    "/social/posts",
    status_code=201,
    summary="Share a look",
    dependencies=[Depends(rate_limit("social_post", "rate_limit_mutation"))],
)
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


@router.delete(
    "/social/posts/{post_id}/react",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a reaction",
    dependencies=[Depends(rate_limit("feedback", "rate_limit_feedback"))],
)
def unreact_to_post(
    post_id: str,
    principal: Principal = Depends(require_active_principal),
    repo: SocialRepository = Depends(get_social_repo),
) -> Response:
    """Un-react (idempotent: 204 whether or not a reaction existed)."""
    repo.unreact(post_id, principal.user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put(
    "/social/follows/{user_id}",
    summary="Follow a user's style",
    dependencies=[Depends(rate_limit("feedback", "rate_limit_feedback"))],
)
def follow_user(
    user_id: str,
    principal: Principal = Depends(require_active_principal),
    repo: SocialRepository = Depends(get_social_repo),
) -> dict[str, object]:
    """Follow another user (idempotent PUT). Their posts appear in the
    ``scope=following`` feed and any of their looks stay one "recreate" away —
    always re-rendered for *you*, never blindly copied (CLAUDE.md §2).
    422 on self-follow, 404 if the user does not exist."""
    if user_id == principal.user_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Cannot follow yourself"
        )
    try:
        newly = repo.follow(principal.user_id, user_id)
    except KeyError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown user") from None
    return {"user_id": user_id, "following": True, "newly": newly}


@router.delete(
    "/social/follows/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Unfollow a user",
)
def unfollow_user(
    user_id: str,
    principal: Principal = Depends(require_active_principal),
    repo: SocialRepository = Depends(get_social_repo),
) -> Response:
    """Stop following. Idempotent: 204 whether or not currently following."""
    repo.unfollow(principal.user_id, user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/social/posts/{post_id}/report",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Report a post",
    dependencies=[Depends(rate_limit("feedback", "rate_limit_feedback"))],
)
def report_post(
    post_id: str,
    body: ReportInput,
    principal: Principal = Depends(require_active_principal),
    repo: SocialRepository = Depends(get_social_repo),
) -> Response:
    """Record a moderation report against a post. 404 if the post is gone."""
    if not repo.report(post_id, principal.user_id, body.reason):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown post")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put(
    "/social/blocks/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Block a user",
    dependencies=[Depends(rate_limit("feedback", "rate_limit_feedback"))],
)
def block_user(
    user_id: str,
    principal: Principal = Depends(require_active_principal),
    repo: SocialRepository = Depends(get_social_repo),
) -> Response:
    """Hide a user's posts from the caller's feeds (idempotent PUT).
    422 on self-block, 404 if the user does not exist."""
    if user_id == principal.user_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Cannot block yourself"
        )
    try:
        repo.block(principal.user_id, user_id)
    except KeyError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown user") from None
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete(
    "/social/blocks/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Unblock a user",
)
def unblock_user(
    user_id: str,
    principal: Principal = Depends(require_active_principal),
    repo: SocialRepository = Depends(get_social_repo),
) -> Response:
    """Undo a block. Idempotent: 204 whether or not currently blocked."""
    repo.unblock(principal.user_id, user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/social/blocks", summary="Who the caller has blocked")
def list_blocks(
    principal: Principal = Depends(require_active_principal),
    repo: SocialRepository = Depends(get_social_repo),
) -> dict[str, list[str]]:
    """The caller's block list (most recent first) — lets the client hide
    blocked authors immediately and offer unblock."""
    return {"blocked": repo.blocked(principal.user_id)}


@router.get("/social/follows", summary="Who the caller follows")
def list_follows(
    principal: Principal = Depends(require_active_principal),
    repo: SocialRepository = Depends(get_social_repo),
) -> dict[str, list[str]]:
    """The caller's follow list (most recent first) — lets the client mark
    authors as followed and render the Following feed tab."""
    return {"following": repo.following(principal.user_id)}


@router.post(
    "/social/posts/{post_id}/recreate",
    summary="Recreate a look for yourself",
    dependencies=[Depends(rate_limit("recommend", "rate_limit_recommend"))],
)
def recreate_post(
    request: Request,
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
        request_id=getattr(request.state, "request_id", "-"),
    )
