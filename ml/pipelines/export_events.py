"""Behavioral-event export — the read side of the flywheel (no data wasted).

Turns the append-only ``interactions`` spine into two versioned artifacts:

1. ``examples.jsonl`` — one training example per served item: the impression
   (rank + propensity score from the recommender) joined with any later
   engagement by the same user on the same item. This is the (context, slate,
   label, propensity) tuple the future two-tower/ranker trains on and the
   IPS/counterfactual promotion gate replays.
2. ``report.md`` — an operator-facing insight report: volume, engagement rates
   by action/occasion/rank, and per-user funnel. Makes the data useful today.

Run against any Postgres with the spine (local stack, prod Supabase):

    GYF_DATABASE_URL=postgresql://... uv run python -m pipelines.export_events

Outputs land in ``ml/data/exports/<max-event-date>/`` — versioned by the data,
not the wall clock, so re-running on the same events is idempotent.
"""

from __future__ import annotations

import json
import os
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterable

# Mirror of services/api/app/recsys/signals.py ACTION_REWARD (the reward
# contract). Kept as strings so ml/ needs no dependency on the API package;
# if the contract changes there, change it here.
ACTION_REWARD: dict[str, float] = {
    "purchase": 1.5,
    "cart": 1.2,
    "save": 1.0,
    "share": 0.8,
    "react": 0.6,
    "follow": 0.5,
    "view": 0.1,
    "skip": -0.6,
    "impression": 0.0,
}

_EXPORT_ROOT = Path(__file__).resolve().parent.parent / "data" / "exports"


def build_examples(rows: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    """Join impressions with later engagements into labelled training examples.

    ``rows`` are interaction dicts (user_id, target_type, target_id, action,
    weight, context, ts — ts as ISO string). An impression becomes one example;
    its label is the strongest signed reward among the same user's later
    non-impression actions on the same item (0.0 = shown, never touched).
    Engagements that never had an impression (organic browsing, wardrobe) are
    exported too, with ``propensity: null`` — usable as extra positives.
    """
    impressions: list[dict[str, Any]] = []
    engagements: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        if row["action"] == "impression":
            impressions.append(row)
        else:
            engagements[(row["user_id"], row["target_id"])].append(row)

    examples: list[dict[str, Any]] = []
    matched: set[int] = set()
    for imp in impressions:
        ctx = imp.get("context") or {}
        later = [
            e
            for e in engagements.get((imp["user_id"], imp["target_id"]), [])
            if e["ts"] >= imp["ts"]
        ]
        # ponytail: strongest-signal label; sequence/dwell modeling when a ranker exists
        best = max(later, key=lambda e: abs(ACTION_REWARD.get(e["action"], 0.0)), default=None)
        matched.update(id(e) for e in later)
        examples.append(
            {
                "user_id": imp["user_id"],
                "item_id": imp["target_id"],
                "recommendation_id": ctx.get("recommendation_id"),
                "occasion": ctx.get("occasion"),
                "goals": ctx.get("goals", []),
                "rank": ctx.get("rank"),
                "propensity": ctx.get("score"),
                "label": ACTION_REWARD.get(best["action"], 0.0) if best else 0.0,
                "engaged_action": best["action"] if best else None,
                "ts": imp["ts"],
            }
        )
    for events in engagements.values():
        for e in events:
            if id(e) in matched or e["target_type"] not in ("item", "outfit"):
                continue
            examples.append(
                {
                    "user_id": e["user_id"],
                    "item_id": e["target_id"],
                    "recommendation_id": (e.get("context") or {}).get("recommendation_id"),
                    "occasion": (e.get("context") or {}).get("occasion"),
                    "goals": [],
                    "rank": None,
                    "propensity": None,
                    "label": ACTION_REWARD.get(e["action"], 0.0),
                    "engaged_action": e["action"],
                    "ts": e["ts"],
                }
            )
    return examples


def build_report(rows: list[dict[str, Any]], examples: list[dict[str, Any]]) -> str:
    """Markdown insight report over the raw events + built examples."""
    actions = Counter(r["action"] for r in rows)
    users = {r["user_id"] for r in rows}
    served = [e for e in examples if e["propensity"] is not None]
    engaged = [e for e in served if e["label"] > 0]
    skipped = [e for e in served if e["label"] < 0]

    def rate(part: list, whole: list) -> str:
        return f"{len(part)}/{len(whole)} ({len(part) / len(whole):.1%})" if whole else "0/0"

    by_occasion: dict[str, list[float]] = defaultdict(list)
    for e in served:
        by_occasion[e["occasion"] or "unknown"].append(e["label"])
    by_rank: dict[int, list[float]] = defaultdict(list)
    for e in served:
        if e["rank"] is not None:
            by_rank[e["rank"]].append(e["label"])

    lines = [
        "# GYF behavioral-data report",
        "",
        f"- **Events:** {len(rows)} across **{len(users)} users** "
        f"({min((r['ts'] for r in rows), default='—')} → {max((r['ts'] for r in rows), default='—')})",
        f"- **Training examples:** {len(examples)} "
        f"({len(served)} impression-labelled, {len(examples) - len(served)} organic positives)",
        f"- **Positive engagement rate on served items:** {rate(engaged, served)}",
        f"- **Explicit skip rate on served items:** {rate(skipped, served)}",
        "",
        "## Events by action",
        "",
        "| action | count |",
        "| --- | --- |",
        *[f"| {a} | {c} |" for a, c in actions.most_common()],
        "",
        "## Engagement by occasion (served items)",
        "",
        "| occasion | served | positive rate |",
        "| --- | --- | --- |",
        *[
            f"| {occ} | {len(ls)} | {sum(1 for x in ls if x > 0) / len(ls):.1%} |"
            for occ, ls in sorted(by_occasion.items())
        ],
        "",
        "## Engagement by slate rank",
        "",
        "| rank | served | positive rate |",
        "| --- | --- | --- |",
        *[
            f"| {rk} | {len(ls)} | {sum(1 for x in ls if x > 0) / len(ls):.1%} |"
            for rk, ls in sorted(by_rank.items())
        ],
        "",
        "_Positive = save/cart/react/share/view per the reward contract "
        "(services/api/app/recsys/signals.py)._",
        "",
    ]
    return "\n".join(lines)


def _fetch_rows(dsn: str) -> list[dict[str, Any]]:
    import psycopg
    from psycopg.rows import dict_row

    with psycopg.connect(dsn, row_factory=dict_row) as conn:
        rows = conn.execute(
            "SELECT user_id::text, target_type, target_id, action, weight, context, ts "
            "FROM interactions ORDER BY ts"
        ).fetchall()
    for r in rows:
        r["ts"] = r["ts"].isoformat()
    return rows


def main() -> int:
    dsn = os.environ.get("GYF_DATABASE_URL", "")
    if not dsn:
        print("GYF_DATABASE_URL is required", file=sys.stderr)
        return 2
    rows = _fetch_rows(dsn)
    if not rows:
        print("no interactions found — nothing to export")
        return 0
    examples = build_examples(rows)
    version = max(r["ts"] for r in rows)[:10]  # versioned by the data's own extent
    out = _EXPORT_ROOT / version
    out.mkdir(parents=True, exist_ok=True)
    with (out / "examples.jsonl").open("w", encoding="utf-8") as fh:
        for ex in examples:
            fh.write(json.dumps(ex) + "\n")
    (out / "report.md").write_text(build_report(rows, examples), encoding="utf-8")
    print(f"exported {len(examples)} examples from {len(rows)} events → {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
