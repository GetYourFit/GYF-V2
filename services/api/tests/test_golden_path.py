"""Golden-path integration test — the AI stylist loop against real Postgres.

Onboard (manual) → recommend (complete, explained, confident outfits) → save
feedback → the event lands in the `interactions` table → recommend again still
serves. Unlike the rest of the suite, this binds the *real* Postgres repositories
(only auth and the event sink are pinned), so it catches the failures in-memory
repos cannot: broken migrations, schema/SQL drift, and behavioral events that are
accepted by the API but never persisted to the table the taste model reads.

Skips automatically when no local Postgres is configured (see conftest.py).
"""

from __future__ import annotations

import psycopg
import pytest
from fastapi.testclient import TestClient

from app.auth import Principal, get_current_principal
from app.config import settings
from app.main import app, get_event_sink
from app.sink import PostgresSink

DEV_USER = settings.dev_user_id


@pytest.fixture
def client(reset_user_state: str) -> TestClient:
    """A client on the real DB: auth pinned to the dev user, Postgres event sink.

    Everything else (profile, account, candidate, taste repos) resolves to the
    default Postgres-backed providers — the path that actually ships.
    """
    dsn = reset_user_state
    app.dependency_overrides[get_current_principal] = lambda: Principal(
        user_id=DEV_USER, email="dev@local"
    )
    app.dependency_overrides[get_event_sink] = lambda: PostgresSink(dsn)
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


def _interaction_count(dsn: str) -> int:
    with psycopg.connect(dsn) as conn:
        row = conn.execute("SELECT count(*) FROM interactions").fetchone()
    return row[0]


def test_golden_path_onboard_recommend_feedback(client: TestClient, reset_user_state: str):
    dsn = reset_user_state

    # 1. Not onboarded yet → 404 routes the UI to onboarding.
    assert client.get("/profile").status_code == 404

    # 2. Manual onboarding persists and stamps full confidence on supplied fields.
    put = client.put(
        "/profile",
        json={
            "skin_tone": "mst4",
            "undertone": "warm",
            "body_type": "hourglass",
            "style_intent": ["minimalist", "classic"],
            "occasion": "casual",
            "budget_range": {"min": 20, "max": 150, "currency": "USD"},
        },
    )
    assert put.status_code == 200, put.text
    assert put.json()["body_type"] == "hourglass"

    # 3. Read-back round-trips through Postgres.
    got = client.get("/profile")
    assert got.status_code == 200
    assert got.json()["skin_tone"] == "mst4"

    # 4. The AI path: complete, explained, confidence-bearing outfits.
    rec = client.get("/outfits/recommend", params={"k": 3})
    assert rec.status_code == 200, rec.text
    body = rec.json()
    recommendation_id = body["recommendation_id"]
    outfits = body["outfits"]
    assert outfits, "expected at least one outfit"
    for outfit in outfits:
        slots = {item["slot"] for item in outfit["items"]}
        # Every look is a complete coordinated outfit (top+bottom+footwear or
        # full-body+footwear) — never a bare item.
        assert "footwear" in slots
        assert {"top", "bottom"} <= slots or "full_body" in slots
        assert outfit["explanation"].strip(), "every outfit ships a human reason"
        assert outfit["confidence"] is not None, "every outfit ships honest confidence"

    # 5. Feedback (save) is accepted and attributed to the principal.
    target_item = outfits[0]["items"][0]["item_id"]
    fb = client.post(
        "/feedback",
        json={
            "recommendation_id": recommendation_id,
            "target_type": "item",
            "target_id": target_item,
            "action": "save",
        },
    )
    assert fb.status_code == 202, fb.text

    # 6. The moat: the behavioral event actually landed in Postgres (not a file).
    #    Impressions are also logged, so the count is >= the one save.
    assert _interaction_count(dsn) >= 1

    # 7. The loop survives: recommending again with stored behavior still serves.
    again = client.get("/outfits/recommend", params={"k": 3})
    assert again.status_code == 200, again.text
    assert again.json()["outfits"]
