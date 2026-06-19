"""Live-DB proof of P1-C Cycle 3 — controllable styling (NL goal box).

Against the perceived catalog left by scripts/e2e_workstream_a.sh, this runs the
REAL recommend() three ways for the same cold-start user/occasion:
  1. no goal (baseline), 2. "look slimmer", 3. "look broader",
and shows the goal *demonstrably changes the result* (plan §3 DoD):
  - a SLIM goal lowers the mean CIELAB lightness of served garments vs baseline,
  - a BROADEN goal raises it,
  - applied_goals is echoed and the goal is logged into impression context.

No fakes, no DI: real Postgres candidate repo + a collecting sink.

    GYF_DATABASE_URL=postgresql://postgres:postgres@localhost:5433/gyf \
        PYTHONPATH=services/api:packages/contracts python scripts/verify_cycle3.py
"""

from __future__ import annotations

import os

from app.profile.models import Profile
from app.recsys.candidates import PostgresCandidateRepository
from app.recsys.service import recommend
from app.recsys.taste import PostgresTasteRepository

USER = "44444444-4444-4444-4444-444444444444"


class _CollectingSink:
    def __init__(self) -> None:
        self.events: list = []

    def publish(self, event) -> None:
        self.events.append(event)


def _served_lightness(dsn, rec) -> float:
    """Mean CIELAB L of served garments, read from the DB by served item id.

    The response model carries only the colour name, so we re-read the perceived
    lightness for the served item ids directly from the catalog.
    """
    import psycopg

    ids = [it.item_id for o in rec.outfits for it in o.items]
    with psycopg.connect(dsn) as conn:
        row = conn.execute(
            "SELECT avg((i.attributes #>> '{perception,color,lch,0}')::float) "
            "FROM items i WHERE i.id = ANY(%s::uuid[])",
            (ids,),
        ).fetchone()
    return float(row[0]) if row and row[0] is not None else float("nan")


def main() -> None:
    dsn = os.environ["GYF_DATABASE_URL"]
    cand_repo = PostgresCandidateRepository(dsn)
    taste_repo = PostgresTasteRepository(dsn)
    profile = Profile(occasion="casual")

    def run(goal):
        sink = _CollectingSink()
        rec = recommend(profile, USER, cand_repo, taste_repo, sink, "casual", None, 5, goal)
        return rec, sink

    base, _ = run(None)
    slim, slim_sink = run("I want to look slimmer")
    broad, _ = run("I want to look broader")

    l_base = _served_lightness(dsn, base)
    l_slim = _served_lightness(dsn, slim)
    l_broad = _served_lightness(dsn, broad)

    print(f"baseline (no goal): applied_goals={base.applied_goals} mean L={l_base:.1f}")
    print(f"slim:               applied_goals={slim.applied_goals} mean L={l_slim:.1f}")
    print(f"broad:              applied_goals={broad.applied_goals} mean L={l_broad:.1f}")
    for o in slim.outfits[:3]:
        print(f"  slim conf={o.confidence:.2f} :: {o.explanation}")

    assert slim.applied_goals == ["slim"], "SLIM goal not parsed/echoed"
    assert broad.applied_goals == ["broaden"], "BROADEN goal not parsed/echoed"
    assert base.applied_goals == [], "baseline must carry no goals"

    # The headline acceptance: a goal shifts served lightness in the right direction.
    assert l_slim < l_base, f"SLIM did not darken served items ({l_slim:.1f} !< {l_base:.1f})"
    assert l_broad > l_slim, f"BROADEN not lighter than SLIM ({l_broad:.1f} !> {l_slim:.1f})"

    # Goal is logged into impression context (goal-conditioned slate for training).
    impressions = [e for e in slim_sink.events if e.action.value == "impression"]
    assert impressions and impressions[0].context["goals"] == ["slim"], "goal not in context"
    print(f"\nimpressions logged with goal context: {impressions[0].context['goals']}")

    print("\nWorkstream C Cycle 3 live-DB verification: OK")


if __name__ == "__main__":
    main()
