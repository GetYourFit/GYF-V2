"""The "Learn from my activity" switch must actually switch learning off (F3).

The account page promises: turning it off "keeps styling on your stated preferences
only". Before this gate the toggle wrote to `users.consent_flags` and nothing read
it — feedback was still stored and the taste vector was still built from it. These
tests hold both halves of the promise: nothing is written, and nothing is read.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app import dependencies as deps
from app.dependencies import behavioral_learning_allowed, get_account_repo, get_event_sink
from app.events import InteractionEvent
from app.main import app
from app.profile.account import InMemoryAccountRepository
from app.recsys.taste import NoTasteRepository
from app.sink import NullEventSink

# The principal the open-auth dev lane authenticates as (mirrors test_recsys.py).
DEV_USER = "00000000-0000-0000-0000-000000000001"


class _CollectingSink:
    def __init__(self) -> None:
        self.events: list[InteractionEvent] = []

    def publish(self, event: InteractionEvent) -> None:
        self.events.append(event)

    def publish_many(self, events: list[InteractionEvent]) -> None:
        self.events.extend(events)


def _repo(consent: dict[str, bool]) -> InMemoryAccountRepository:
    repo = InMemoryAccountRepository(existing={DEV_USER})
    repo.update_consent(DEV_USER, consent)
    return repo


class _Principal:
    user_id = DEV_USER


def test_opt_out_blocks_the_sink_and_the_taste_history():
    assert behavioral_learning_allowed(_Principal(), _repo({"behavioral_learning": False})) is False
    assert isinstance(get_event_sink(allowed=False), NullEventSink)
    assert isinstance(deps.get_taste_repo(allowed=False), NoTasteRepository)
    assert deps.get_taste_repo(allowed=False).engagements(DEV_USER, 100) == []


def test_absent_flag_still_learns_and_anonymous_never_does():
    """Accounts that predate the switch keep learning; only an explicit opt-out stops it."""
    assert behavioral_learning_allowed(_Principal(), _repo({})) is True
    assert behavioral_learning_allowed(_Principal(), _repo({"behavioral_learning": True})) is True
    assert behavioral_learning_allowed(None, _repo({})) is False


@pytest.mark.parametrize(
    ("consent", "expected_events"),
    [({"behavioral_learning": False}, 0), ({"behavioral_learning": True}, 1)],
)
def test_feedback_route_honours_the_switch(monkeypatch, consent, expected_events):
    """End-to-end wiring, not just the provider: POST /feedback must store nothing
    for an opted-out user — via the real ``get_event_sink``, not an override."""
    collected = _CollectingSink()
    monkeypatch.setattr(deps, "sink", collected)
    app.dependency_overrides[get_account_repo] = lambda: _repo(consent)
    try:
        response = TestClient(app).post(
            "/feedback",
            json={"target_type": "item", "target_id": "item-1", "action": "save"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 202  # accepted either way — the user is never told off
    assert len(collected.events) == expected_events
