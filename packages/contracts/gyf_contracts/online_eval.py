"""Online evaluation scaffolding — the offline→online promotion gate (engineering-doctrine D5).

Offline metrics (:mod:`gyf_contracts.eval_report`) pick *candidates*; a candidate becomes the
*served* model only after it wins online. That online step needs real beta traffic, which GYF
does not have yet — so this module fixes the **shape** now (typed interfaces, deterministic
bucketing) and leaves the estimators unimplemented. This is the documented offline→online metric
gap (CLAUDE.md §8); wiring it is part of P2 once impressions accrue (see ``impression`` logging
already shipped in P1-C Cycle 2).

Nothing here touches production traffic yet; methods that need data raise ``NotImplementedError``
with an explicit "awaiting beta traffic" message rather than returning a fake result (no mockups).
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass


@dataclass(frozen=True)
class Arm:
    """One side of an online comparison: a model version serving a slice of traffic."""

    name: str  # "control" | "candidate" | ...
    model_version: str


def assign_arm(unit_id: str, experiment: str, arms: tuple[Arm, ...]) -> Arm:
    """Deterministically bucket a unit (user/session) into an arm.

    Stable hash of ``experiment:unit_id`` → arm index, so a unit always sees the same arm across
    requests without storing assignments. Implemented now (no traffic needed); the *measurement*
    of what each arm produced is what waits on data.
    """
    if not arms:
        raise ValueError("at least one arm is required")
    digest = hashlib.sha256(f"{experiment}:{unit_id}".encode()).digest()
    return arms[int.from_bytes(digest[:8], "big") % len(arms)]


@dataclass(frozen=True)
class InterleavingResult:
    """Outcome of team-draft interleaving between two rankers (per-query credit)."""

    control_wins: int
    candidate_wins: int
    ties: int


def interleave(control_ranking: list[str], candidate_ranking: list[str]) -> list[str]:
    """Team-draft interleaving of two rankings into one list to show the user.

    The shown list is computed now; attributing clicks back to the contributing ranker (the part
    that yields :class:`InterleavingResult`) requires logged interactions and lands with traffic.
    """
    raise NotImplementedError(
        "interleaving credit attribution awaits beta traffic (P2); see online_eval module docstring"
    )


def ips_estimate(
    rewards: list[float], logged_probs: list[float], target_probs: list[float]
) -> float:
    """Inverse-propensity-scored estimate of a new policy's reward from logged data.

    Counterfactual off-policy evaluation — the honest way to estimate a candidate ranker before
    risking live traffic. Needs the logged propensities the serving stack does not record yet.
    """
    raise NotImplementedError(
        "IPS counterfactual estimation awaits logged propensities (P2); see module docstring"
    )
