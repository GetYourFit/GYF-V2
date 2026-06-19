"""Recommendation orchestration: profile + taste -> constraints -> outfits -> log.

The single entry point the API route calls. It wires the pure pieces together:
:mod:`conditioning` resolves styling constraints, :mod:`taste` builds the user's
taste vector from their behavior, the :class:`CandidateRepository` fetches per-slot
pools (with pgvector taste affinity), and :mod:`compose` assembles, scores
(content blended with taste) and diversely ranks the looks.

It also **logs an impression per served item** onto the behavioral spine, with the
recommendation context (id, occasion, rank, score = propensity). Those impressions
are the implicit negatives + propensities a future two-tower/ranker and the
counterfactual/IPS gate train on — captured from the very first user. Logging is
best-effort: a sink failure must never fail a recommendation.
"""

from __future__ import annotations

import logging
import uuid

from . import conditioning
from .candidates import CANDIDATE_SLOTS, CandidateRepository
from .compose import ScoredOutfit, compose
from .goals import parse_goal
from .models import Outfit, OutfitRecommendation
from .taste import TasteProfile, TasteRepository, build_taste
from ..events import InteractionAction, InteractionEvent, InteractionTarget
from ..profile.models import Profile
from ..sink import EventSink

logger = logging.getLogger("gyf")

# How many candidates to pull per slot. Generous enough for real variety and MMR
# diversity, bounded so the assembly cartesian product stays tractable.
_CANDIDATES_PER_SLOT = 40

# How many recent engagements feed the taste vector. Recency decay handles older
# ones; this just bounds the read.
_TASTE_HISTORY = 200


def recommend(
    profile: Profile,
    user_id: str,
    candidates: CandidateRepository,
    taste_repo: TasteRepository,
    sink: EventSink,
    occasion: str | None,
    region: str | None,
    k: int,
    goal: str | None = None,
) -> OutfitRecommendation:
    """Produce up to ``k`` diverse, explained, taste-aware outfits and log them.

    ``goal`` is the user's free-text controllable-styling request ("look taller /
    slimmer / broader"); it is parsed into canonical effects that re-weight the
    composer toward looks achieving the effect. Unrecognized/empty goals are a
    no-op, leaving the recommendation identical to the un-goal path.
    """
    goals = parse_goal(goal)
    constraints = conditioning.resolve(profile, occasion, region, goals)
    taste = build_taste(taste_repo.engagements(user_id, _TASTE_HISTORY))

    pools = candidates.candidates_by_slot(
        CANDIDATE_SLOTS,
        constraints.region,
        constraints.max_price,
        _CANDIDATES_PER_SLOT,
        taste.vector if taste.has_signal else None,
    )
    strength = taste.strength if taste.has_signal else 0.0
    scored = compose(pools, constraints, k, strength)

    recommendation_id = str(uuid.uuid4())
    applied_goals = [g.value for g in goals]
    _log_impressions(
        sink, user_id, recommendation_id, constraints.occasion, applied_goals, scored
    )

    return OutfitRecommendation(
        recommendation_id=recommendation_id,
        occasion=constraints.occasion,
        outfits=[Outfit.from_scored(o) for o in scored],
        cold_start=not taste.has_signal,
        personalized=constraints.personalization_strength > 0.0 or taste.has_signal,
        taste_strength=round(strength, 3),
        applied_goals=applied_goals,
    )


def _log_impressions(
    sink: EventSink,
    user_id: str,
    recommendation_id: str,
    occasion: str,
    applied_goals: list[str],
    scored: list[ScoredOutfit],
) -> None:
    """Emit one impression per served item with its propensity (rank + score).

    These are the labelled negatives the future ranker needs; an engagement logged
    later with the same ``recommendation_id`` reconstructs the (context, slate,
    label, propensity) tuple. Best-effort — never raises into the request path.
    """
    try:
        for rank, outfit in enumerate(scored):
            for item in outfit.items:
                sink.publish(
                    InteractionEvent(
                        user_id=user_id,
                        target_type=InteractionTarget.ITEM,
                        target_id=item.item_id,
                        action=InteractionAction.IMPRESSION,
                        context={
                            "recommendation_id": recommendation_id,
                            "occasion": occasion,
                            "goals": applied_goals,  # goal-conditioned slate
                            "rank": rank,
                            "score": outfit.score,  # propensity for IPS
                        },
                    )
                )
    except Exception:  # noqa: BLE001 — telemetry must not break recommendations
        logger.warning("impression logging failed for recommendation %s", recommendation_id)


__all__ = ["TasteProfile", "recommend"]
