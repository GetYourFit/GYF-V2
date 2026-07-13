"""End-to-end proof of the behavioral event spine (P0-D / P0→P1 gate DoD).

Drives the real path against a live Postgres: an *authenticated* caller POSTs a
feedback event → the API attributes it to the verified principal → ``PostgresSink``
persists it → the row is queryable in the ``interactions`` table.

Unlike the unit tests (which use fakes/JSONL), this exercises auth + HTTP + SQL
together. It runs only when ``GYF_TEST_DATABASE_URL`` points at a reachable
Postgres with the schema loaded (CI provides one; locally:
``docker compose -f infra/docker-compose.yml up -d postgres``). Otherwise it skips.
"""

from __future__ import annotations

import os
import uuid

import jwt
import pytest
from fastapi.testclient import TestClient

psycopg = pytest.importorskip("psycopg")

from app.config import settings  # noqa: E402
from app.main import app  # noqa: E402
from app.sink import PostgresSink  # noqa: E402

DSN = os.environ.get("GYF_TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(
    not DSN, reason="set GYF_TEST_DATABASE_URL to a Postgres with db/schema.sql loaded"
)


@pytest.fixture
def db_conn():
    with psycopg.connect(DSN) as conn:
        yield conn


def test_authenticated_feedback_lands_in_postgres_and_is_queryable(
    db_conn, monkeypatch: pytest.MonkeyPatch
):
    # A real signed token for a fresh user id (a valid UUID for the FK/column).
    secret = "spine-e2e-secret"
    user_id = str(uuid.uuid4())
    monkeypatch.setattr(settings, "supabase_jwt_secret", secret)
    monkeypatch.setattr(settings, "auth_disabled", False)
    monkeypatch.setattr(settings, "env", "staging")  # close the local dev bypass
    token = jwt.encode(
        {"sub": user_id, "email": "e2e@gyf.test", "aud": settings.jwt_audience},
        secret,
        algorithm="HS256",
    )

    # Wire the API to a real Postgres sink for this test. The feedback route reads
    # the sink through ``get_event_sink`` → ``app.dependencies.sink``, so patch there.
    from app import dependencies

    monkeypatch.setattr(dependencies, "sink", PostgresSink(DSN))

    client = TestClient(app)
    payload = {
        "event_id": str(uuid.uuid4()),
        "target_type": "outfit",
        "target_id": "o-e2e",
        "action": "save",
        "weight": 1.0,
        "context": {"recommendation_id": "rec-e2e"},
    }
    res = client.post("/feedback", headers={"Authorization": f"Bearer {token}"}, json=payload)
    assert res.status_code == 202
    assert res.json() == {"status": "accepted", "action": "save"}

    # The event is queryable on the serving side, attributed to the token's subject.
    row = db_conn.execute(
        "SELECT user_id, target_type, target_id, action, weight "
        "FROM interactions WHERE user_id = %s",
        (user_id,),
    ).fetchone()
    assert row is not None, "event did not land in the interactions table"
    assert str(row[0]) == user_id  # attributed to the authenticated principal
    assert (row[1], row[2], row[3], row[4]) == ("outfit", "o-e2e", "save", 1.0)

    # Retrying the same event id is accepted but cannot inflate the spine.
    retry = client.post("/feedback", headers={"Authorization": f"Bearer {token}"}, json=payload)
    assert retry.status_code == 202
    assert (
        db_conn.execute(
            "SELECT count(*) FROM interactions WHERE user_id = %s", (user_id,)
        ).fetchone()[0]
        == 1
    )

    # Auth is enforced end-to-end: no token → 401, nothing persisted.
    unauth = client.post(
        "/feedback", json={"target_type": "item", "target_id": "x", "action": "view"}
    )
    assert unauth.status_code == 401

    # Cleanup so the test is idempotent against a persistent DB.
    db_conn.execute("DELETE FROM interactions WHERE user_id = %s", (user_id,))
    db_conn.execute("DELETE FROM users WHERE id = %s", (user_id,))
    db_conn.commit()
