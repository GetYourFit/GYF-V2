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

import dataclasses
import logging
import uuid

from . import conditioning
from ..affiliate import AffiliateLinker, linker_from_settings
from .candidates import CANDIDATE_SLOTS, Candidate, CandidateRepository
from .compose import ScoredOutfit, WardrobeContext, compose
from .goals import parse_goal
from .models import Outfit, OutfitRecommendation
from .taste import TasteProfile, TasteRepository, build_taste
from ..events import InteractionAction, InteractionEvent, InteractionTarget
from ..profile.models import Profile
from ..sink import EventSink
from ..wardrobe import WardrobeRepository

logger = logging.getLogger("gyf")

# How many candidates to pull per slot. Generous enough for real variety and MMR
# diversity, bounded so the assembly cartesian product stays tractable.
_CANDIDATES_PER_SLOT = 40

# How many recent engagements feed the taste vector. Recency decay handles older
# ones; this just bounds the read.
_TASTE_HISTORY = 200

# How many owned garments anchor composition. The most recently added win — the
# freshest closet is the truest one — and the cap keeps the assembly cartesian
# product bounded while still letting several looks build around owned pieces.
_WARDROBE_ANCHORS = 12


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
    wardrobe_repo: WardrobeRepository | None = None,
    linker: AffiliateLinker | None = None,
) -> OutfitRecommendation:
    """Produce up to ``k`` diverse, explained, taste-aware outfits and log them.

    ``goal`` is the user's free-text controllable-styling request ("look taller /
    slimmer / broader"); it is parsed into canonical effects that re-weight the
    composer toward looks achieving the effect. Unrecognized/empty goals are a
    no-op, leaving the recommendation identical to the un-goal path.

    When ``wardrobe_repo`` is given and the user owns catalog garments, those
    garments join the candidate pools as **owned anchors** — looks get built
    around the real closet — and the composer's wardrobe grounding rewards new
    pieces that pair with what the user already owns. An empty wardrobe leaves
    the recommendation identical to the un-grounded path.
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
    wardrobe = _ground_in_wardrobe(pools, user_id, candidates, wardrobe_repo)
    strength = taste.strength if taste.has_signal else 0.0
    scored = compose(pools, constraints, k, strength, wardrobe)

    recommendation_id = str(uuid.uuid4())
    applied_goals = [g.value for g in goals]
    _log_impressions(sink, user_id, recommendation_id, constraints.occasion, applied_goals, scored)

    # Monetize + attribute every shop link at serve time: the Cuelinks subid IS
    # the recommendation_id, so a later conversion (transactions API) joins back
    # to the exact impression slate — revenue and the strongest training label
    # from the same click. Owned garments show no shop link, so they stay raw.
    outfits = [Outfit.from_scored(o) for o in scored]
    linker = linker or linker_from_settings()
    for outfit in outfits:
        for item in outfit.items:
            if not item.owned:
                item.affiliate_url = linker.wrap(item.affiliate_url, recommendation_id)

    return OutfitRecommendation(
        recommendation_id=recommendation_id,
        occasion=constraints.occasion,
        outfits=outfits,
        cold_start=not taste.has_signal,
        personalized=constraints.personalization_strength > 0.0 or taste.has_signal,
        taste_strength=round(strength, 3),
        applied_goals=applied_goals,
        wardrobe_grounded=wardrobe is not None,
    )


def _ground_in_wardrobe(
    pools: dict[str, list[Candidate]],
    user_id: str,
    candidates: CandidateRepository,
    wardrobe_repo: WardrobeRepository | None,
) -> WardrobeContext | None:
    """Inject the user's owned garments into the pools; return the closet context.

    Only catalog-referenced wardrobe rows anchor (freeform typed garments carry no
    perception signals to reason over — D6 abstention). The most recent
    ``_WARDROBE_ANCHORS`` owned items are resolved, flagged ``owned`` and put at
    the front of their slot pool (replacing a duplicate catalog copy if present).
    Returns ``None`` when there is no wardrobe to ground in.
    """
    if wardrobe_repo is None:
        return None
    records = wardrobe_repo.list(user_id)
    owned_ids = [r.item_id for r in records if r.item_id][:_WARDROBE_ANCHORS]
    if not owned_ids:
        return None
    owned = [dataclasses.replace(c, owned=True) for c in candidates.candidates_by_ids(owned_ids)]
    if not owned:
        return None  # stale references only — nothing real to anchor on
    for anchor in owned:
        pool = pools.setdefault(anchor.slot, [])
        pool[:] = [c for c in pool if c.item_id != anchor.item_id]
        pool.insert(0, anchor)
    palette = tuple(c.lch for c in owned if c.lch is not None)
    return WardrobeContext(palette=palette, has_items=True)


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
