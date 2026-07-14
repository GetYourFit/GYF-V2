"""Live-Postgres proof of the F2 data-portability export.

Runs against a real Postgres with all migrations applied (CI's real-PG lane;
locally a pgvector container). Seeds two users with profiles + interactions and
proves the export returns every owned row for the caller and none of the other
user's — the read-side counterpart of the RLS isolation proof in test_rls.py.
"""

from __future__ import annotations

import os
import uuid

import pytest

psycopg = pytest.importorskip("psycopg")

DSN = os.environ.get("GYF_TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(
    not DSN, reason="set GYF_TEST_DATABASE_URL to a Postgres with migrations applied"
)


def test_export_covers_owned_rows_and_only_owned_rows():
    from app.profile.account import _EXPORT_TABLES, PostgresAccountRepository

    user_a = str(uuid.uuid4())
    user_b = str(uuid.uuid4())

    with psycopg.connect(DSN, autocommit=True) as conn:
        conn.execute("INSERT INTO users (id) VALUES (%s), (%s)", (user_a, user_b))
        conn.execute("INSERT INTO profiles (user_id) VALUES (%s), (%s)", (user_a, user_b))
        for uid, action in ((user_a, "save"), (user_a, "skip"), (user_b, "save")):
            conn.execute(
                "INSERT INTO interactions (user_id, action, target_type, target_id) "
                "VALUES (%s, %s, 'item', %s)",
                (uid, action, str(uuid.uuid4())),
            )

    export = PostgresAccountRepository(DSN).export_data(user_a)

    # Every owned table appears, even when empty — the export shape is total.
    assert set(export) == {table for table, _ in _EXPORT_TABLES}
    assert [row["id"] for row in export["users"]] == [user_a]
    assert [row["user_id"] for row in export["profiles"]] == [user_a]
    assert len(export["interactions"]) == 2
    assert all(row["user_id"] == user_a for row in export["interactions"])
    assert export["collections"] == []
