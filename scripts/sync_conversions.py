"""Affiliate statements → the canonical commerce attribution contract.

Cuelinks is a link-conversion service, not a product feed. This job reads its
transaction statement and emits only server-trusted commerce outcomes into the
existing append-only interaction spine:

* ``shop_click`` is emitted by Expo only after a disclosed retailer handoff opens;
  it carries the backend deeplink ``subid``, product placement and a random
  route-local session id.
* ``purchase`` is emitted only for an explicitly confirmed affiliate status.
* ``conversion_reversal`` records a later refund/cancellation/reversal for the
  same transaction. Unknown and pending statuses remain unknown; they are never
  called purchases.

The Cuelinks transaction id makes each outcome idempotent. A conversion can name
an item only when its subid has exactly one clicked item. When several products
shared the recommendation subid, it is honestly attributed to the recommendation
(outfit target), not guessed onto the first served item.

Run:
    GYF_DATABASE_URL=... GYF_CUELINKS_API_TOKEN=... python scripts/sync_conversions.py
"""

from __future__ import annotations

import json
import os
import sys
import urllib.parse
import urllib.request
from datetime import date, timedelta
from typing import Any

_API = "https://www.cuelinks.com/api/v2/transactions.json"
_LOOKBACK_DAYS = 60  # reconciliation windows; outcome identity makes overlap safe
# We do not know a sale occurred until the statement uses one of these explicit
# final states. All other statuses, including blank/pending, are unknown.
_CONFIRMED_STATUSES = frozenset({"approved", "confirmed", "paid", "success", "successful"})
_REVERSED_STATUSES = frozenset(
    {"reversed", "refunded", "cancelled", "canceled", "rejected", "declined", "void", "chargeback"}
)


def fetch_transactions(token: str, start: str, end: str, transport=None) -> list[dict[str, Any]]:
    """All transactions in [start, end], tolerant of paging and empty (HTTP 204)."""
    transport = transport or _http_get
    out: list[dict[str, Any]] = []
    page = 1
    while True:
        query = urllib.parse.urlencode(
            {"start_date": start, "end_date": end, "page": page, "per_page": 100}
        )
        body = transport(f"{_API}?{query}", token)
        if not body:
            break
        batch = json.loads(body).get("transactions", [])
        if not batch:
            break
        out.extend(batch)
        if len(batch) < 100:
            break
        page += 1
    return out


def _http_get(url: str, token: str) -> str:
    req = urllib.request.Request(url, headers={"Authorization": f'Token token="{token}"'})
    with urllib.request.urlopen(req, timeout=30) as resp:  # noqa: S310 — fixed https host
        return "" if resp.status == 204 else resp.read().decode("utf-8")


def _status(tx: dict[str, Any]) -> str:
    return str(tx.get("status") or "").strip().lower()


def _outcome_for(tx: dict[str, Any]) -> str | None:
    status = _status(tx)
    if status in _CONFIRMED_STATUSES:
        return "purchase"
    if status in _REVERSED_STATUSES:
        return "conversion_reversal"
    return None


def _already_recorded(conn, action: str, transaction_id: str) -> bool:
    return bool(
        conn.execute(
            "SELECT 1 FROM interactions WHERE action = %s "
            "AND context ->> 'affiliate_transaction_id' = %s",
            (action, transaction_id),
        ).fetchone()
    )


def _attribution_target(conn, subid: str) -> tuple[str, str, str] | None:
    """Return (user_id, target_type, target_id), abstaining from ambiguous item joins."""
    clicks = conn.execute(
        "SELECT user_id, target_id FROM interactions WHERE action = 'shop_click' "
        "AND context ->> 'subid' = %s ORDER BY ts",
        (subid,),
    ).fetchall()
    distinct_clicks = {(str(user_id), str(item_id)) for user_id, item_id in clicks}
    if len(distinct_clicks) == 1:
        user_id, item_id = distinct_clicks.pop()
        return user_id, "item", item_id

    # The recommendation itself still tells us which authenticated styling
    # session drove the conversion. It does not tell us which of several items
    # was bought, so preserve that uncertainty with an outfit target.
    impression = conn.execute(
        "SELECT user_id FROM interactions WHERE action = 'impression' "
        "AND context ->> 'recommendation_id' = %s ORDER BY ts LIMIT 1",
        (subid,),
    ).fetchone()
    if impression is None:
        return None
    return str(impression[0]), "outfit", subid


def sync(conn, transactions: list[dict[str, Any]]) -> tuple[int, int]:
    """Reconcile final affiliate outcomes without turning clicks/pending into purchases."""
    inserted = skipped = 0
    for tx in transactions:
        transaction_id = str(tx.get("id") or tx.get("transaction_id") or "")
        subid = str(tx.get("sub_id") or tx.get("subid") or "")
        outcome = _outcome_for(tx)
        if not transaction_id or not subid or outcome is None:
            skipped += 1
            continue
        if _already_recorded(conn, outcome, transaction_id):
            skipped += 1
            continue
        attribution = _attribution_target(conn, subid)
        if attribution is None:
            skipped += 1
            continue
        user_id, target_type, target_id = attribution
        context = json.dumps(
            {
                "attribution_version": 1,
                "affiliate_network": "cuelinks",
                "affiliate_transaction_id": transaction_id,
                "subid": subid,
                "recommendation_id": subid if not subid.startswith("catalog_") else None,
                "sale_amount": tx.get("sale_amount"),
                "commission": tx.get("commission"),
                "status": _status(tx),
                "campaign": tx.get("campaign_name") or tx.get("campaign_id"),
                "item_attribution": "exact_click" if target_type == "item" else "recommendation_only",
            }
        )
        conn.execute(
            "INSERT INTO interactions (user_id, target_type, target_id, action, context) "
            "VALUES (%s, %s, %s, %s, %s)",
            (user_id, target_type, target_id, outcome, context),
        )
        inserted += 1
    return inserted, skipped


def main() -> int:
    dsn = os.environ.get("GYF_DATABASE_URL", "")
    token = os.environ.get("GYF_CUELINKS_API_TOKEN", "")
    if not dsn or not token:
        print("GYF_DATABASE_URL and GYF_CUELINKS_API_TOKEN are required", file=sys.stderr)
        return 2
    end = date.today()
    start = end - timedelta(days=_LOOKBACK_DAYS)
    transactions = fetch_transactions(token, start.isoformat(), end.isoformat())
    if not transactions:
        print("no transactions in window — nothing to reconcile")
        return 0
    import psycopg

    with psycopg.connect(dsn) as conn:
        inserted, skipped = sync(conn, transactions)
    print(f"reconciled {inserted} outcomes ({skipped} skipped) from {len(transactions)} transactions")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
