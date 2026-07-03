"""Cuelinks conversions → the behavioral spine (closing the revenue loop).

Pulls confirmed transactions from the Cuelinks publisher API and writes each as
a ``purchase`` interaction — the ground-truth commerce label. The deeplink subid
carries the ``recommendation_id`` a link was served under (see app/affiliate.py),
so a conversion joins back to the exact impression slate: the recommender learns
from real money, not just clicks.

Idempotent: a transaction lands at most once (keyed by its Cuelinks id in the
event context). Attribution: subid → the impression with that recommendation_id
→ that impression's user + item. Non-recommendation subids ("catalog") land as
user-less revenue records only in Cuelinks — they are skipped here, honestly,
rather than guessed at.

Run (nightly via .github/workflows/data-export.yml, or by hand):

    GYF_DATABASE_URL=... GYF_CUELINKS_API_TOKEN=... python scripts/sync_conversions.py

Requires: psycopg (the API service extra). Read-only against Cuelinks; inserts
into ``interactions`` only.
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
_LOOKBACK_DAYS = 60  # cookie windows + validation delays; idempotency makes overlap free


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


def sync(conn, transactions: list[dict[str, Any]]) -> tuple[int, int]:
    """Insert unseen recommendation-attributed transactions as purchase events.

    Returns (inserted, skipped). Tolerant of field naming across API revisions
    (sub_id/subid, transaction id under id/transaction_id).
    """
    inserted = skipped = 0
    for tx in transactions:
        tx_id = str(tx.get("id") or tx.get("transaction_id") or "")
        subid = str(tx.get("sub_id") or tx.get("subid") or "")
        if not tx_id or not subid or subid == "catalog":
            skipped += 1
            continue
        seen = conn.execute(
            "SELECT 1 FROM interactions WHERE action = 'purchase' "
            "AND context ->> 'cuelinks_transaction_id' = %s",
            (tx_id,),
        ).fetchone()
        if seen:
            skipped += 1
            continue
        # subid = recommendation_id → the impression carries user + item.
        imp = conn.execute(
            "SELECT user_id, target_id FROM interactions WHERE action = 'impression' "
            "AND context ->> 'recommendation_id' = %s ORDER BY ts LIMIT 1",
            (subid,),
        ).fetchone()
        if imp is None:
            skipped += 1  # not one of ours (foreign/stale subid) — never guess
            continue
        user_id, item_id = imp
        context = json.dumps(
            {
                "recommendation_id": subid,
                "cuelinks_transaction_id": tx_id,
                "sale_amount": tx.get("sale_amount"),
                "commission": tx.get("commission"),
                "status": tx.get("status"),
                "campaign": tx.get("campaign_name") or tx.get("campaign_id"),
            }
        )
        conn.execute(
            "INSERT INTO interactions (user_id, target_type, target_id, action, context) "
            "VALUES (%s, 'item', %s, 'purchase', %s)",
            (user_id, item_id, context),
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
        print("no transactions in window — nothing to sync")
        return 0
    import psycopg

    with psycopg.connect(dsn) as conn:
        inserted, skipped = sync(conn, transactions)
    print(f"synced {inserted} purchases ({skipped} skipped) from {len(transactions)} transactions")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
