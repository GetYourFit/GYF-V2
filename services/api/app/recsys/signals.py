"""The reward contract — one definition of "positive" for taste, now and later.

A single source of truth mapping each behavioral action to a scalar reward. The
online taste model (Cycle 2) uses it today to weight item embeddings into a taste
vector; the future two-tower retrieval + ranker will use the *same* mapping as its
label function, so the online and trained models never disagree on what an
engagement is worth. Keeping it here — not buried in the taste math — is the
architectural seam that makes the early users' data trainable later.

Rewards are signed: positive actions pull taste toward an item, negatives push it
away. Magnitudes encode intent strength (a cart/try-on is a stronger purchase
signal than a passing view). ``IMPRESSION`` is the served-but-unacted negative the
ranker needs; it carries no intrinsic reward (its label is "not engaged").
"""

from __future__ import annotations

from ..events import InteractionAction

# Action -> reward. Tuned for *intent strength*, not frequency. Revisit against
# real engagement once volume exists (offline calibration, then online gate).
ACTION_REWARD: dict[InteractionAction, float] = {
    InteractionAction.CART: 1.2,  # strongest purchase intent
    InteractionAction.TRYON: 1.0,  # high intent: imagining it on themselves
    InteractionAction.SAVE: 1.0,  # explicit "I like this"
    InteractionAction.SHARE: 0.8,  # endorses to others
    InteractionAction.REACT: 0.6,  # lightweight approval
    InteractionAction.FOLLOW: 0.5,  # taste affinity (user-target)
    InteractionAction.VIEW: 0.1,  # weak positive (dwell unknown at v1)
    InteractionAction.SKIP: -0.6,  # explicit rejection
    InteractionAction.IMPRESSION: 0.0,  # shown only; label is "not engaged"
}


def reward(action: InteractionAction) -> float:
    """Signed reward for an action; unknown/serve-only actions contribute nothing."""
    return ACTION_REWARD.get(action, 0.0)


def is_positive(action: InteractionAction) -> bool:
    """Whether an action expresses positive intent (a training positive)."""
    return reward(action) > 0.0
