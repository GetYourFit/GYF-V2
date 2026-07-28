"""Profitability evidence — conversion, repeat-use and contribution margin.

Reads the same ``interactions`` spine that ``scripts/sync_conversions.py`` writes
purchases into, and reports the minimum honest monetization measurement for a
period:

1. **Conversion rate**: disclosed outbound handoffs (``action='shop_click'`` —
   emitted only after Expo opens the retailer link) versus explicitly confirmed
   affiliate statements (``action='purchase'``), excluding transaction ids that
   later receive ``conversion_reversal`` reconciliation.
2. **Repeat-use rate**: the fraction of users active on a core engagement action
   (save/skip/swap/cart/tryon) in the period who are active on at least one
   other calendar day in that same period. This approximates the plan's D1/D7/D30
   "repeated save, correction or wardrobe decision" definition
   (docs/plans/gyf-launch-refactor-plan.md) using what the spine actually
   captures today; wardrobe-item mutations are not yet joined into
   ``interactions``, so this is a lower bound, not the full definition.
3. **Contribution-margin estimate**: parameterized by a merchant commission rate
   and a hosting-cost allocation, both read from env with placeholder defaults
   clearly labeled as such — see ``main()``. The formula:

       estimated_commission_inr = confirmed_sale_amount_inr * commission_rate
       hosting_cost_allocation_inr = hosting_cost_month_inr * period_days / 30
       contribution_margin_estimate_inr = estimated_commission_inr - hosting_cost_allocation_inr

   This mirrors the illustrative statement in
   docs/plans/gyf-launch-refactor-plan.md's "Profitability and scaling" section
   and becomes an accurate number the moment real commission-rate and
   hosting-cost-allocation inputs replace the placeholders.

Never fabricates: every count/rate that cannot be computed from what is
actually observed is reported as "insufficient data", not a guessed number.

Run:

    GYF_DATABASE_URL=postgresql://... python scripts/report_profitability.py \\
        --start 2026-06-28 --end 2026-07-27 --out docs/evidence/report.md
"""

from __future__ import annotations

import argparse
import os
import sys
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Any

# Core engagement actions used for the repeat-use proxy. Impressions and
# purchases are server-only ground truth, not user engagement signals, and are
# excluded here.
_CORE_ENGAGEMENT_ACTIONS = frozenset({"save", "skip", "swap", "cart", "shop_click", "tryon"})

# Cuelinks/affiliate-network status values that mean "not a confirmed sale".
# Kept permissive (case-insensitive substring-free exact match) since the
# ingested vocabulary here is a placeholder — see the status note in main().
_REVERSED_STATUSES = frozenset(
    {"reversed", "refunded", "cancelled", "canceled", "rejected", "declined", "void", "chargeback"}
)
_CONFIRMED_STATUSES = frozenset({"approved", "confirmed", "paid", "success", "successful"})


def _status_of(row: dict[str, Any]) -> str:
    context = row.get("context") or {}
    return str(context.get("status") or "").strip().lower()


def _is_confirmed_purchase(row: dict[str, Any]) -> bool:
    # The sync worker only creates purchases from this final vocabulary. Legacy
    # rows without it remain unknown rather than inflating conversion/profit.
    return _status_of(row) in _CONFIRMED_STATUSES


def _transaction_id(row: dict[str, Any]) -> str | None:
    value = (row.get("context") or {}).get("affiliate_transaction_id")
    return str(value) if value else None


def _confirmed_purchases(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    reversed_ids = {
        transaction_id
        for row in rows
        if row["action"] == "conversion_reversal"
        for transaction_id in [_transaction_id(row)]
        if transaction_id
    }
    return [
        row
        for row in rows
        if row["action"] == "purchase"
        and _is_confirmed_purchase(row)
        and _transaction_id(row) not in reversed_ids
    ]


def _numeric(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


@dataclass
class ConversionMetrics:
    outbound_clicks: int
    confirmed_conversions: int
    reversed_conversions: int
    conversion_rate: float | None  # None = insufficient data (no clicks observed)


@dataclass
class RepeatUseMetrics:
    active_users: int
    repeat_users: int
    repeat_use_rate: float | None  # None = insufficient data (no active users)


@dataclass
class ContributionMargin:
    period_days: int
    commission_rate: float
    commission_rate_source: str
    hosting_cost_month_inr: float
    hosting_cost_source: str
    confirmed_sale_amount_inr: float
    reversed_sale_amount_inr: float
    actual_reported_commission_inr: float | None  # sum of context.commission when present
    estimated_commission_inr: float
    hosting_cost_allocation_inr: float
    contribution_margin_estimate_inr: float


def compute_conversion_metrics(rows: list[dict[str, Any]]) -> ConversionMetrics:
    clicks = [r for r in rows if r["action"] == "shop_click"]
    confirmed = _confirmed_purchases(rows)
    reversed_ = [r for r in rows if r["action"] == "conversion_reversal"]
    rate = (len(confirmed) / len(clicks)) if clicks else None
    return ConversionMetrics(
        outbound_clicks=len(clicks),
        confirmed_conversions=len(confirmed),
        reversed_conversions=len(reversed_),
        conversion_rate=rate,
    )


def compute_repeat_use_metrics(rows: list[dict[str, Any]]) -> RepeatUseMetrics:
    days_by_user: dict[str, set[str]] = defaultdict(set)
    for row in rows:
        if row["action"] not in _CORE_ENGAGEMENT_ACTIONS:
            continue
        ts = row["ts"]
        day = ts[:10] if isinstance(ts, str) else ts.date().isoformat()
        days_by_user[row["user_id"]].add(day)
    active_users = len(days_by_user)
    repeat_users = sum(1 for days in days_by_user.values() if len(days) >= 2)
    rate = (repeat_users / active_users) if active_users else None
    return RepeatUseMetrics(
        active_users=active_users,
        repeat_users=repeat_users,
        repeat_use_rate=rate,
    )


def compute_contribution_margin(
    rows: list[dict[str, Any]],
    *,
    period_days: int,
    commission_rate: float,
    commission_rate_source: str,
    hosting_cost_month_inr: float,
    hosting_cost_source: str,
) -> ContributionMargin:
    confirmed = _confirmed_purchases(rows)
    reversed_ = [r for r in rows if r["action"] == "conversion_reversal"]

    confirmed_sale_amount_inr = sum(
        v for v in (_numeric((p.get("context") or {}).get("sale_amount")) for p in confirmed) if v
    )
    reversed_sale_amount_inr = sum(
        v for v in (_numeric((p.get("context") or {}).get("sale_amount")) for p in reversed_) if v
    )
    reported_commissions = [
        v
        for v in (_numeric((p.get("context") or {}).get("commission")) for p in confirmed)
        if v is not None
    ]
    actual_reported_commission_inr = sum(reported_commissions) if reported_commissions else None

    hosting_cost_allocation_inr = hosting_cost_month_inr * period_days / 30
    estimated_commission_inr = confirmed_sale_amount_inr * commission_rate
    contribution_margin_estimate_inr = estimated_commission_inr - hosting_cost_allocation_inr

    return ContributionMargin(
        period_days=period_days,
        commission_rate=commission_rate,
        commission_rate_source=commission_rate_source,
        hosting_cost_month_inr=hosting_cost_month_inr,
        hosting_cost_source=hosting_cost_source,
        confirmed_sale_amount_inr=confirmed_sale_amount_inr,
        reversed_sale_amount_inr=reversed_sale_amount_inr,
        actual_reported_commission_inr=actual_reported_commission_inr,
        estimated_commission_inr=estimated_commission_inr,
        hosting_cost_allocation_inr=hosting_cost_allocation_inr,
        contribution_margin_estimate_inr=contribution_margin_estimate_inr,
    )


def _rate_str(rate: float | None) -> str:
    if rate is None:
        return "insufficient data (denominator is zero)"
    return f"{rate:.1%}"


def build_report(
    rows: list[dict[str, Any]],
    *,
    start: date,
    end: date,
    conversion: ConversionMetrics,
    repeat_use: RepeatUseMetrics,
    margin: ContributionMargin,
    data_source_note: str,
) -> str:
    lines = [
        "# GYF profitability evidence report",
        "",
        f"Period: **{start.isoformat()} → {end.isoformat()}** ({margin.period_days} days).",
        "",
        data_source_note,
        "",
        "## 1. Conversion rate — disclosed retailer handoffs → confirmed affiliate conversions",
        "",
        f"- Outbound shop clicks (`action='shop_click'`): **{conversion.outbound_clicks}**",
        f"- Confirmed conversions (`action='purchase'`, no later reversal): **{conversion.confirmed_conversions}**",
        f"- Reversal/refund reconciliations (`action='conversion_reversal'`): **{conversion.reversed_conversions}**",
        f"- Conversion rate: **{_rate_str(conversion.conversion_rate)}**",
        "",
        "## 2. Repeat-use rate",
        "",
        "Definition: of users active on a core engagement action "
        "(save/skip/swap/cart/shop_click/tryon) in the period, the fraction active on a "
        "second distinct calendar day within the same period. Approximates the "
        "plan's D1/D7/D30 repeat-save/correction/wardrobe-decision definition "
        "(docs/plans/gyf-launch-refactor-plan.md); wardrobe-item edits are not yet "
        "joined into `interactions`, so this is a lower bound.",
        "",
        f"- Active users in period: **{repeat_use.active_users}**",
        f"- Repeat-active users (2+ distinct days): **{repeat_use.repeat_users}**",
        f"- Repeat-use rate: **{_rate_str(repeat_use.repeat_use_rate)}**",
        "",
        "## 3. Contribution-margin estimate (parameterized)",
        "",
        "Formula (correct the moment real inputs replace the placeholders below):",
        "",
        "```",
        "estimated_commission_inr = confirmed_sale_amount_inr * commission_rate",
        "hosting_cost_allocation_inr = hosting_cost_month_inr * period_days / 30",
        "contribution_margin_estimate_inr = estimated_commission_inr - hosting_cost_allocation_inr",
        "```",
        "",
        f"- Confirmed sale amount (INR, summed from `context.sale_amount`): "
        f"**{margin.confirmed_sale_amount_inr:.2f}**",
        f"- Reversed sale amount (INR, excluded above): **{margin.reversed_sale_amount_inr:.2f}**",
        f"- Commission rate: **{margin.commission_rate:.2%}** ({margin.commission_rate_source})",
        f"- Estimated commission (INR): **{margin.estimated_commission_inr:.2f}**",
        f"- Actual reported commission from Cuelinks `context.commission`, when present "
        f"(INR): **{'insufficient data' if margin.actual_reported_commission_inr is None else f'{margin.actual_reported_commission_inr:.2f}'}**",
        f"- Hosting-cost allocation for the period (INR): **{margin.hosting_cost_allocation_inr:.2f}** "
        f"({margin.hosting_cost_source}, prorated from a monthly figure of "
        f"{margin.hosting_cost_month_inr:.2f})",
        f"- **Contribution-margin estimate (INR): {margin.contribution_margin_estimate_inr:.2f}**",
        "",
        "## Status note for the captain (not a blocker)",
        "",
        "The commission rate and hosting-cost allocation above are placeholder "
        "defaults (see `GYF_COMMISSION_RATE_PLACEHOLDER` / "
        "`GYF_HOSTING_COST_ALLOCATION_INR_PLACEHOLDER` in `main()`), not the "
        "merchant's actual contracted commission rate or GYF's actual per-period "
        "hosting-cost allocation. The captain must supply the exact commission-rate "
        "and cost-allocation inputs before this contribution-margin number can be "
        "treated as a real business figure rather than an illustrative estimate.",
        "",
    ]
    return "\n".join(lines)


def _fetch_rows(dsn: str, start: date, end: date) -> list[dict[str, Any]]:
    import psycopg
    from psycopg.rows import dict_row

    actions = (*_CORE_ENGAGEMENT_ACTIONS, "purchase", "conversion_reversal")
    with psycopg.connect(dsn, row_factory=dict_row) as conn:
        rows = conn.execute(
            "SELECT i.user_id::text, i.target_type, i.target_id, i.action, i.context, i.ts "
            "FROM interactions i JOIN users u ON u.id = i.user_id "
            "WHERE u.deleted_at IS NULL AND i.action = ANY(%s) "
            "AND i.ts >= %s AND i.ts < %s "
            "ORDER BY i.ts",
            (
                list(actions),
                datetime.combine(start, datetime.min.time(), tzinfo=timezone.utc),
                datetime.combine(end + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc),
            ),
        ).fetchall()
    for r in rows:
        r["ts"] = r["ts"].isoformat()
    return rows


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    today = datetime.now(timezone.utc).date()
    parser.add_argument("--start", type=date.fromisoformat, default=today - timedelta(days=30))
    parser.add_argument("--end", type=date.fromisoformat, default=today)
    parser.add_argument("--out", default=None, help="Write the report markdown to this path.")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv if argv is not None else sys.argv[1:])
    start, end = args.start, args.end
    period_days = (end - start).days + 1

    commission_rate_env = os.environ.get("GYF_COMMISSION_RATE_PLACEHOLDER")
    commission_rate = float(commission_rate_env) if commission_rate_env else 0.05
    commission_rate_source = (
        "from GYF_COMMISSION_RATE_PLACEHOLDER env"
        if commission_rate_env
        else "PLACEHOLDER default (5%, illustrative — see gyf-launch-refactor-plan.md)"
    )

    hosting_cost_env = os.environ.get("GYF_HOSTING_COST_ALLOCATION_INR_PLACEHOLDER")
    hosting_cost_month_inr = float(hosting_cost_env) if hosting_cost_env else 3000.0
    hosting_cost_source = (
        "from GYF_HOSTING_COST_ALLOCATION_INR_PLACEHOLDER env"
        if hosting_cost_env
        else "PLACEHOLDER default (₹3,000/month — the NFR-3 hosting+GPU ceiling, not an actual allocation)"
    )

    dsn = os.environ.get("GYF_DATABASE_URL", "")
    if not dsn:
        rows: list[dict[str, Any]] = []
        data_source_note = (
            "**Data source: none.** `GYF_DATABASE_URL` was not configured in this "
            "execution environment, so no query ran against the `interactions` "
            "spine. Every count below is honestly zero because no data was "
            "observed, not because zero conversions occurred in production — "
            "re-run this script with `GYF_DATABASE_URL` set against the "
            "production/Supabase database to get a real reading for this period."
        )
    else:
        rows = _fetch_rows(dsn, start, end)
        data_source_note = (
            f"**Data source:** `interactions` table via `GYF_DATABASE_URL`, "
            f"{len(rows)} rows in period."
        )

    conversion = compute_conversion_metrics(rows)
    repeat_use = compute_repeat_use_metrics(rows)
    margin = compute_contribution_margin(
        rows,
        period_days=period_days,
        commission_rate=commission_rate,
        commission_rate_source=commission_rate_source,
        hosting_cost_month_inr=hosting_cost_month_inr,
        hosting_cost_source=hosting_cost_source,
    )

    report = build_report(
        rows,
        start=start,
        end=end,
        conversion=conversion,
        repeat_use=repeat_use,
        margin=margin,
        data_source_note=data_source_note,
    )

    if args.out:
        from pathlib import Path

        Path(args.out).write_text(report, encoding="utf-8")
        print(f"wrote report to {args.out}")
    else:
        print(report)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
