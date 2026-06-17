from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_ok():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_feedback_accepts_valid_event():
    res = client.post(
        "/feedback",
        json={
            "user_id": "u1",
            "target_type": "outfit",
            "target_id": "o1",
            "action": "save",
        },
    )
    assert res.status_code == 202
    assert res.json() == {"status": "accepted", "action": "save"}


def test_feedback_rejects_invalid_action():
    res = client.post(
        "/feedback",
        json={
            "user_id": "u1",
            "target_type": "outfit",
            "target_id": "o1",
            "action": "nope",
        },
    )
    assert res.status_code == 422
