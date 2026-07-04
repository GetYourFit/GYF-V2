import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.events import InteractionEvent
from app.main import app, get_account_repo
from app.profile.account import InMemoryAccountRepository
from app.sink import LocalFileSink

DEV_USER = "00000000-0000-0000-0000-000000000001"

client = TestClient(app)


@pytest.fixture(autouse=True)
def _account_repo_override():
    """Apply the in-memory account repo per test, so the suite is order-independent.

    ``/feedback`` gates on ``require_active_principal``, which needs an account repo
    to reject tombstoned users. A module-level override would be wiped by any other
    test calling ``dependency_overrides.clear()`` in teardown; applying it (and
    restoring the prior state) per test keeps these tests passing regardless of run
    order.
    """
    previous = app.dependency_overrides.get(get_account_repo)
    app.dependency_overrides[get_account_repo] = lambda: InMemoryAccountRepository(
        existing={DEV_USER}
    )
    try:
        yield
    finally:
        if previous is None:
            app.dependency_overrides.pop(get_account_repo, None)
        else:
            app.dependency_overrides[get_account_repo] = previous


def test_health_ok():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_feedback_accepts_valid_event():
    # No bearer token in local mode → resolves to the dev principal.
    res = client.post(
        "/feedback",
        json={"target_type": "outfit", "target_id": "o1", "action": "save"},
    )
    assert res.status_code == 202
    assert res.json() == {"status": "accepted", "action": "save"}


def test_local_sink_appends_event(tmp_path: Path):
    sink = LocalFileSink(tmp_path / "events.jsonl")
    sink.publish(
        InteractionEvent(user_id="u1", target_type="outfit", target_id="o1", action="save")
    )
    lines = (tmp_path / "events.jsonl").read_text().strip().splitlines()
    assert len(lines) == 1
    assert json.loads(lines[0])["action"] == "save"


def test_feedback_rejects_invalid_action():
    res = client.post(
        "/feedback",
        json={"target_type": "outfit", "target_id": "o1", "action": "nope"},
    )
    assert res.status_code == 422


def test_feedback_rejects_server_only_actions():
    # impression/purchase are trusted training labels (recommender-emitted /
    # affiliate-synced); a client-forged one would poison the taste model.
    for action in ("impression", "purchase"):
        res = client.post(
            "/feedback",
            json={"target_type": "item", "target_id": "i1", "action": action},
        )
        assert res.status_code == 422, action
