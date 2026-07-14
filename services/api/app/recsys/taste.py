"""Online taste model — a per-user taste vector in the item-embedding space.

The learned half of P1-C. Each engaged item has a SigLIP embedding (Workstream A);
we combine a user's engagements into one vector that points at "the kind of thing
they like", then bias composition toward catalog items near it. No training, no new
model: it works from the first interaction and compounds as more arrive — the
"matures like a fine wine" behaviour (CLAUDE.md §1), with a clean upgrade path to a
trained two-tower ranker on the *same* reward contract (:mod:`signals`).

Two knobs make it honest:

- **Recency decay** — older actions count less (exponential half-life), so taste
  tracks who the user is *now*.
- **Saturating strength** — how far to trust taste over cold start grows with the
  volume of positive signal and saturates, so one save doesn't hijack the ranker
  and the 50th matters less than the 2nd. At zero engagement strength is 0 and the
  recommender is exactly cold-start (no regression for new users).

Pure-Python vector math (a handful of 768-d sums per request) keeps the API free
of a numpy dependency; the heavy per-candidate affinity is computed in pgvector.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Protocol

from ..events import InteractionAction
from .signals import is_positive, reward

# Half-life of an engagement's influence, in days. ~3 weeks: recent taste leads,
# but a month-old save still counts.
_HALF_LIFE_DAYS = 21.0

# Positive-reward mass at which taste is ~63% trusted; saturating thereafter. Set
# so a few genuine saves already meaningfully personalize without one action
# dominating. Tune against real engagement before any online promotion.
_STRENGTH_SCALE = 4.0

# Below this L2 norm the weighted sum has no coherent direction (e.g. positives and
# negatives cancel) — treat as "no taste yet" rather than emit a noise vector.
_MIN_NORM = 1e-6


@dataclass(frozen=True)
class EngagedItem:
    """One engaged item: its embedding, the action taken, and how long ago."""

    embedding: list[float]
    action: InteractionAction
    age_days: float


@dataclass(frozen=True)
class TasteProfile:
    """A user's taste vector and how much to trust it.

    ``vector`` is L2-normalized (or ``None`` when there is no coherent signal yet);
    ``strength`` in [0, 1] is the blend weight against cold start.
    """

    vector: list[float] | None
    strength: float
    positive_count: int

    @property
    def has_signal(self) -> bool:
        return self.vector is not None and self.strength > 0.0


class TasteRepository(Protocol):
    def engagements(self, user_id: str, limit: int) -> list[EngagedItem]:
        """Most-recent engaged items (with embeddings) for a user; excludes impressions."""
        ...


def _decay(age_days: float) -> float:
    return 0.5 ** (max(age_days, 0.0) / _HALF_LIFE_DAYS)


def build_taste(engagements: list[EngagedItem]) -> TasteProfile:
    """Combine engagements into a recency- and reward-weighted taste vector."""
    if not engagements:
        return TasteProfile(vector=None, strength=0.0, positive_count=0)

    dim = len(engagements[0].embedding)
    acc = [0.0] * dim
    total_positive = 0.0
    positive_count = 0
    for item in engagements:
        r = reward(item.action)
        if r == 0.0:
            continue
        weight = r * _decay(item.age_days)
        for i, v in enumerate(item.embedding):
            acc[i] += weight * v
        if is_positive(item.action):
            total_positive += r * _decay(item.age_days)
            positive_count += 1

    norm = math.sqrt(sum(v * v for v in acc))
    if norm < _MIN_NORM or total_positive <= 0.0:
        return TasteProfile(vector=None, strength=0.0, positive_count=positive_count)

    vector = [v / norm for v in acc]
    strength = 1.0 - math.exp(-total_positive / _STRENGTH_SCALE)
    return TasteProfile(vector=vector, strength=round(strength, 4), positive_count=positive_count)


def parse_vector(raw: object) -> list[float]:
    """Parse a pgvector value (text ``[a,b,...]`` or a list) into floats."""
    if isinstance(raw, (list, tuple)):
        return [float(x) for x in raw]
    return [float(x) for x in str(raw).strip().strip("[]").split(",") if x]


# Engagements over items *and* outfits (each outfit attributed to its member items),
# joined to embeddings, newest first. Impressions are excluded — they are negatives
# for the future ranker, not taste signal. ``age_days`` lets the caller decay.
_ENGAGEMENTS = """
SELECT embedding, action, age_days FROM (
    SELECT e.embedding, i.action,
           EXTRACT(EPOCH FROM (now() - i.ts)) / 86400.0 AS age_days, i.ts
    FROM interactions i
    JOIN item_embeddings e ON e.item_id = i.target_id::uuid
    WHERE i.user_id = %s AND i.target_type = 'item' AND i.action <> 'impression'
    UNION ALL
    SELECT e.embedding, i.action,
           EXTRACT(EPOCH FROM (now() - i.ts)) / 86400.0 AS age_days, i.ts
    FROM interactions i
    JOIN outfits o ON o.id = i.target_id::uuid
    JOIN item_embeddings e ON e.item_id = ANY(o.item_ids)
    WHERE i.user_id = %s AND i.target_type = 'outfit' AND i.action <> 'impression'
) eng
ORDER BY ts DESC
LIMIT %s
"""


class PostgresTasteRepository:
    """Reads a user's engaged-item embeddings. Lazy pool, injectable for tests."""

    def __init__(self, dsn: str, pool: object | None = None) -> None:
        if pool is None:
            from psycopg_pool import ConnectionPool  # lazy

            pool = ConnectionPool(dsn, min_size=0, max_size=4, open=True)
        self._pool = pool

    def engagements(self, user_id: str, limit: int) -> list[EngagedItem]:
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            return [
                EngagedItem(
                    embedding=parse_vector(row[0]),
                    action=InteractionAction(row[1]),
                    age_days=float(row[2]),
                )
                for row in conn.execute(_ENGAGEMENTS, (user_id, user_id, limit))
            ]


class NoTasteRepository:
    """Reports no engagement history — the taste repo a user gets when they switch
    off "Learn from my activity" (F3 consent).

    The account page promises that turning it off "keeps styling on your stated
    preferences only". This is that promise in code: recommendations and the Explore
    feed fall back to the profile-conditioned cold-start path, which already works
    without any behaviour (invariant #5).
    """

    def engagements(self, user_id: str, limit: int) -> list[EngagedItem]:
        return []


class InMemoryTasteRepository:
    """List-backed taste repo for tests."""

    def __init__(self, by_user: dict[str, list[EngagedItem]] | None = None) -> None:
        self._by_user = by_user or {}

    def engagements(self, user_id: str, limit: int) -> list[EngagedItem]:
        return self._by_user.get(user_id, [])[:limit]
