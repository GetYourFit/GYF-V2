import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.events import InteractionEvent
from app.main import app
from app.sink import LocalFileSink

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
