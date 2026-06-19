"""Recommendation orchestration: profile -> constraints -> candidates -> outfits.

The single entry point the API route calls. It wires the pure pieces together:
:mod:`conditioning` resolves the styling constraints, the
:class:`CandidateRepository` fetches per-slot pools, and :mod:`compose` assembles,
scores and diversely ranks the looks. Kept thin and side-effect-free (other than
the repo read) so the cold-start path is easy to follow and test end-to-end.
"""

from __future__ import annotations

from . import conditioning
from .candidates import CandidateRepository
from .compose import compose
from .conditioning import CANDIDATE_SLOTS
from .models import Outfit, OutfitRecommendation
from ..profile.models import Profile

# How many candidates to pull per slot. Generous enough for real variety and MMR
# diversity, bounded so the assembly cartesian product stays tractable.
_CANDIDATES_PER_SLOT = 40


def recommend(
    profile: Profile,
    repo: CandidateRepository,
    occasion: str | None,
    region: str | None,
    k: int,
) -> OutfitRecommendation:
    """Produce up to ``k`` diverse, explained outfits for ``profile``."""
    constraints = conditioning.resolve(profile, occasion, region)
    pools = repo.candidates_by_slot(
        CANDIDATE_SLOTS, constraints.region, constraints.max_price, _CANDIDATES_PER_SLOT
    )
    scored = compose(pools, constraints, k)
    return OutfitRecommendation(
        occasion=constraints.occasion,
        outfits=[Outfit.from_scored(o) for o in scored],
        cold_start=True,
        personalized=constraints.personalization_strength > 0.0,
    )
