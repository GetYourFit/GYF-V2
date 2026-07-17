"""Recommendation orchestration: profile + taste -> constraints -> outfits -> log.

The single entry point the API route calls. It wires the pure pieces together:
:mod:`conditioning` resolves styling constraints, :mod:`taste` builds the user's
taste vector from their behavior, the :class:`CandidateRepository` fetches per-slot
pools (with pgvector taste affinity), and :mod:`compose` assembles, scores
(content blended with taste) and diversely ranks the looks.

It also **logs an impression per served item** onto the behavioral spine, with the
recommendation context (id, occasion, rank, ranking score). Those impressions are
the implicit negatives a future two-tower/ranker trains on — captured from the very
first user. Logging is best-effort: a sink failure must never fail a recommendation.
"""

from __future__ import annotations

import dataclasses
import logging
import time
import uuid
from collections.abc import Iterator
from contextlib import contextmanager

from gyf_contracts.usermodel import CATALOG_GENDERS, catalog_genders_for

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

# The composer consumes at most 14 items per slot; 20 preserves enough footwear
# headroom for the endpoint's maximum `k` without shipping 4 * 80 wide, 768-d
# embedding rows over the production pooler on every request.
_CANDIDATES_PER_SLOT = 20

# How many recent engagements feed the taste vector. Recency decay handles older
# ones; this just bounds the read.
_TASTE_HISTORY = 200

# How many owned garments anchor composition. The most recently added win — the
# freshest closet is the truest one — and the cap keeps the assembly cartesian
# product bounded while still letting several looks build around owned pieces.
_WARDROBE_ANCHORS = 12


@contextmanager
def _stage(request_id: str, name: str) -> Iterator[None]:
    start = time.perf_counter()
    outcome = "success"
    try:
        yield
    except BaseException:
        outcome = "error"
        raise
    finally:
        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        logger.info(
            "recommendation_stage request_id=%s stage=%s outcome=%s duration_ms=%.2f",
            request_id,
            name,
            outcome,
            duration_ms,
            extra={
                "request_id": request_id,
                "stage": name,
                "outcome": outcome,
                "duration_ms": duration_ms,
            },
        )


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
    anchor_item_id: str | None = None,
    request_id: str = "-",
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

    ``anchor_item_id`` pins a specific catalog item ("complete the look"): it
    becomes the *only* candidate in its slot, so every returned outfit is a
    complete look built around that product — same personalization, scoring,
    diversity and attribution as the feed. Raises :class:`LookupError` when the
    item is unknown, so the route can answer 404 honestly.
    """
    with _stage(request_id, "profile_conditioning"):
        goals = parse_goal(goal)
        constraints = conditioning.resolve(profile, occasion, region, goals)
    with _stage(request_id, "taste_history"):
        taste = build_taste(taste_repo.engagements(user_id, _TASTE_HISTORY))

    # Gendered relevance: draw only from the user's slice + unisex (unfaceted
    # items always pass). Nonbinary/unknown users see the full catalog.
    genders = catalog_genders_for(profile.gender)
    with _stage(request_id, "candidate_retrieval"):
        pools = candidates.candidates_by_slot(
            CANDIDATE_SLOTS,
            constraints.region,
            constraints.max_price,
            _CANDIDATES_PER_SLOT,
            taste.vector if taste.has_signal else None,
            genders if genders != CATALOG_GENDERS else None,
            request_id=request_id,
        )
    with _stage(request_id, "wardrobe_grounding"):
        wardrobe = _ground_in_wardrobe(pools, user_id, candidates, wardrobe_repo)
    if anchor_item_id is not None:
        with _stage(request_id, "anchor_lookup"):
            anchor = _pin_anchor(pools, anchor_item_id, candidates)
        # Only blueprints that include the anchor's slot may assemble — every
        # returned look must genuinely contain the pinned product.
        constraints = dataclasses.replace(
            constraints,
            blueprints=tuple(bp for bp in constraints.blueprints if anchor.slot in bp),
        )
    strength = taste.strength if taste.has_signal else 0.0
    with _stage(request_id, "composition"):
        scored = compose(pools, constraints, k, strength, wardrobe)

    recommendation_id = str(uuid.uuid4())
    applied_goals = [g.value for g in goals]
    with _stage(request_id, "impression_logging"):
        _log_impressions(
            sink,
            user_id,
            recommendation_id,
            constraints.occasion,
            applied_goals,
            scored,
            anchor_item_id,
        )

    # Monetize + attribute every shop link at serve time: the Cuelinks subid IS
    # the recommendation_id, so a later conversion (transactions API) joins back
    # to the exact impression slate — revenue and the strongest training label
    # from the same click. Owned garments show no shop link, so they stay raw.
    with _stage(request_id, "finalization"):
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
        anchor_item_id=anchor_item_id,
    )


def _pin_anchor(
    pools: dict[str, list[Candidate]],
    anchor_item_id: str,
    candidates: CandidateRepository,
) -> Candidate:
    """Make ``anchor_item_id`` the sole candidate in its slot ("complete the look").

    Pinned *after* wardrobe grounding so the anchor always wins its slot; other
    slots keep their full personalized pools (and owned anchors), so composition
    styles the rest of the look around the pinned product. No region/price
    predicates — the user chose this item explicitly.
    """
    resolved = candidates.candidates_by_ids([anchor_item_id])
    if not resolved:
        raise LookupError(anchor_item_id)
    anchor = resolved[0]
    pools[anchor.slot] = [anchor]
    return anchor


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
    anchor_item_id: str | None = None,
) -> None:
    """Emit one impression per served item with its rank and ranking score.

    These are the labelled negatives the future ranker needs; an engagement logged
    later with the same ``recommendation_id`` reconstructs the (context, slate,
    label) tuple. Best-effort — never raises into the request path.
    """
    try:
        extra = {"anchor_item_id": anchor_item_id} if anchor_item_id else {}
        events = [
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
                    # Deterministic ranking score, NOT a logging propensity: this
                    # slate comes from a fully deterministic top-k MMR selection, so
                    # P(shown|context) is 1 for shown items. A real IPS/counterfactual
                    # gate (doctrine D5) needs randomized logging (epsilon-greedy /
                    # softmax pre-MMR) before this can be treated as a propensity.
                    "score": outfit.score,
                    **extra,  # anchored ("complete the look") slates
                },
            )
            for rank, outfit in enumerate(scored)
            for item in outfit.items
        ]
        # One batched write, not ~40 per-item round trips.
        sink.publish_many(events)
    except Exception:  # noqa: BLE001 — telemetry must not break recommendations
        logger.warning("impression logging failed for recommendation %s", recommendation_id)


__all__ = ["TasteProfile", "recommend"]
