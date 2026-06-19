"""Live-DB proof of P1-C Cycle 2 — online taste model + impression logging.

Against the perceived catalog left by scripts/e2e_workstream_a.sh, this:
  1. seeds SAVE interactions for a test user on a single-hue cluster of items,
  2. builds the taste vector with the REAL PostgresTasteRepository,
  3. runs the REAL recommend() cold (no history) vs warm (with history) and shows
     the warm run is personalized with positive taste affinity on served items,
  4. confirms impressions are logged with recommendation context (the training
     tuple for the future two-tower/ranker).

No fakes, no DI: real Postgres repos + a collecting sink.

    GYF_DATABASE_URL=postgresql://postgres:postgres@localhost:5433/gyf \
        PYTHONPATH=services/api:packages/contracts python scripts/verify_taste_cycle2.py
"""

from __future__ import annotations

import os
import uuid

import psycopg

from app.profile.models import Profile
from app.recsys.candidates import PostgresCandidateRepository
from app.recsys.service import recommend
from app.recsys.taste import PostgresTasteRepository, build_taste

HUE = "blue"
WARM_USER = "22222222-2222-2222-2222-222222222222"
COLD_USER = "33333333-3333-3333-3333-333333333333"


class _CollectingSink:
    def __init__(self) -> None:
        self.events: list = []

    def publish(self, event) -> None:
        self.events.append(event)


def main() -> None:
    dsn = os.environ["GYF_DATABASE_URL"]
    _seed_saves(dsn, WARM_USER, HUE)

    taste_repo = PostgresTasteRepository(dsn)
    cand_repo = PostgresCandidateRepository(dsn)

    # 1) Real taste vector from the seeded saves.
    taste = build_taste(taste_repo.engagements(WARM_USER, 200))
    print(f"taste: has_signal={taste.has_signal} strength={taste.strength} "
          f"positives={taste.positive_count}")
    assert taste.has_signal, "saves did not produce a taste vector"

    # 2) Cold vs warm recommendation through the real service.
    profile = Profile(occasion="casual")
    cold = recommend(profile, COLD_USER, cand_repo, taste_repo, _CollectingSink(),
                     "casual", None, 3)
    sink = _CollectingSink()
    warm = recommend(profile, WARM_USER, cand_repo, taste_repo, sink, "casual", None, 3)

    print(f"\ncold:  cold_start={cold.cold_start} taste_strength={cold.taste_strength} "
          f"outfits={len(cold.outfits)}")
    print(f"warm:  cold_start={warm.cold_start} taste_strength={warm.taste_strength} "
          f"outfits={len(warm.outfits)}")
    for o in warm.outfits:
        print(f"  conf={o.confidence:.2f} :: {o.explanation}")

    assert cold.cold_start and cold.taste_strength == 0.0, "cold user must be cold-start"
    assert not warm.cold_start and warm.taste_strength > 0.0, "warm user must be personalized"

    # 3) Served warm items skew toward the saved hue's affinity (positive).
    affinity = _served_affinity(dsn, taste.vector, warm)
    print(f"\nmean taste affinity of served warm items: {affinity:.3f}")
    assert affinity > 0.0, "personalized run did not surface taste-aligned items"

    # 4) Impressions logged with the recommendation context (training tuple).
    impressions = [e for e in sink.events if e.action.value == "impression"]
    print(f"impressions logged: {len(impressions)} "
          f"(sample context: {impressions[0].context})")
    assert impressions, "no impressions logged"
    ctx = impressions[0].context
    assert ctx["recommendation_id"] == warm.recommendation_id
    assert "rank" in ctx and "score" in ctx, "propensity (rank/score) not captured"

    print("\nWorkstream C Cycle 2 live-DB verification: OK")


def _seed_saves(dsn: str, user_id: str, hue: str, n: int = 6) -> None:
    """Insert SAVE interactions for the user on items of the given hue."""
    with psycopg.connect(dsn) as conn:
        conn.execute("INSERT INTO users (id) VALUES (%s) ON CONFLICT DO NOTHING", (user_id,))
        conn.execute("DELETE FROM interactions WHERE user_id = %s", (user_id,))
        rows = conn.execute(
            "SELECT id FROM items WHERE attributes #>> '{perception,color,hue_name}' = %s LIMIT %s",
            (hue, n),
        ).fetchall()
        for (item_id,) in rows:
            conn.execute(
                "INSERT INTO interactions (user_id, target_type, target_id, action, weight, context)"
                " VALUES (%s, 'item', %s, 'save', 1.0, '{}')",
                (user_id, str(item_id)),
            )
        conn.commit()
        print(f"seeded {len(rows)} '{hue}' SAVE interactions for {user_id[:8]}…")


def _served_affinity(dsn: str, taste_vec: list[float], rec) -> float:
    """Mean cosine affinity of served items to the taste vector (computed in pgvector)."""
    item_ids = [str(uuid.UUID(it.item_id)) for o in rec.outfits for it in o.items]
    vec = "[" + ",".join(repr(float(x)) for x in taste_vec) + "]"
    with psycopg.connect(dsn) as conn:
        rows = conn.execute(
            "SELECT avg(1 - (e.embedding <=> %s::vector)) FROM item_embeddings e "
            "WHERE e.item_id = ANY(%s::uuid[])",
            (vec, item_ids),
        ).fetchone()
    return float(rows[0]) if rows and rows[0] is not None else 0.0


if __name__ == "__main__":
    main()
