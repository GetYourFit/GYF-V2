"""Support surface — the contact/grievance forms must actually transmit."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.dependencies import get_support_repo, require_active_principal
from app.main import app
from app.auth import Principal
from app.support import SupportMessageRequest


class InMemorySupportRepo:
    def __init__(self) -> None:
        self.messages: list[tuple[str, SupportMessageRequest]] = []

    def create(self, user_id: str, req: SupportMessageRequest) -> str:
        self.messages.append((user_id, req))
        return "msg-1"


def _client(repo: InMemorySupportRepo) -> TestClient:
    app.dependency_overrides[get_support_repo] = lambda: repo
    app.dependency_overrides[require_active_principal] = lambda: Principal(
        user_id="u-1", email="u@example.com"
    )
    return TestClient(app)


def teardown_function() -> None:
    app.dependency_overrides.clear()


def test_contact_message_persisted() -> None:
    repo = InMemorySupportRepo()
    resp = _client(repo).post(
        "/support/messages",
        json={"kind": "contact", "message": "hello", "reply_email": "me@x.com"},
    )
    assert resp.status_code == 201
    assert resp.json()["status"] == "received"
    user_id, req = repo.messages[0]
    assert user_id == "u-1"
    assert req.kind == "contact"


def test_grievance_with_category() -> None:
    repo = InMemorySupportRepo()
    resp = _client(repo).post(
        "/support/messages",
        json={"kind": "grievance", "category": "billing", "message": "issue"},
    )
    assert resp.status_code == 201
    assert repo.messages[0][1].category == "billing"


def test_rejects_bad_kind_and_empty_message() -> None:
    repo = InMemorySupportRepo()
    c = _client(repo)
    assert c.post("/support/messages", json={"kind": "other", "message": "x"}).status_code == 422
    assert c.post("/support/messages", json={"kind": "contact", "message": ""}).status_code == 422
    assert repo.messages == []


def test_rejects_bad_email() -> None:
    repo = InMemorySupportRepo()
    resp = _client(repo).post(
        "/support/messages",
        json={"kind": "contact", "message": "x", "reply_email": "not-an-email"},
    )
    assert resp.status_code == 422


def test_postgres_repo_accepts_shared_pool_and_inserts() -> None:
    """Regression: dependencies constructs PostgresSupportRepository(dsn, pool=...);
    the old __init__(database_url) took no pool, so every real /support call 500'd
    (the in-memory fake above hid it). This exercises the real repo against a fake
    pool — asserts the pool kwarg is accepted and create() runs the INSERT on it."""
    from app.support import PostgresSupportRepository

    calls: list[tuple[str, tuple]] = []

    class _Conn:
        def execute(self, sql, params=None):
            calls.append((sql, params))

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

    class _Pool:
        def connection(self):
            return _Conn()

    repo = PostgresSupportRepository("postgresql://unused", pool=_Pool())
    mid = repo.create("u-1", SupportMessageRequest(kind="contact", message="hi"))
    assert mid
    assert len(calls) == 1
    assert "INSERT INTO support_messages" in calls[0][0]
    assert calls[0][1][1] == "u-1"  # user_id bound
