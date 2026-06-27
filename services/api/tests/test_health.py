import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.events import InteractionEvent
from app.main import app, get_account_repo
from app.profile.account import InMemoryAccountRepository
from app.sink import LocalFileSink

# /feedback now gates on require_active_principal, which needs an account repo to
# reject tombstoned users. Override with an in-memory repo holding the dev user.
DEV_USER = "00000000-0000-0000-0000-000000000001"
app.dependency_overrides[get_account_repo] = lambda: InMemoryAccountRepository(existing={DEV_USER})

client = TestClient(app)


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
