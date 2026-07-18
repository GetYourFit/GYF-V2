from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.dependencies import (
    get_account_repo,
    get_candidate_repo,
    get_event_sink,
    get_profile_repo,
    get_taste_repo,
    get_wardrobe_repo,
)
from app.main import app
from app.profile.account import InMemoryAccountRepository
from app.profile.models import Profile
from app.profile.repository import InMemoryProfileRepository
from app.recsys.candidates import Candidate, InMemoryCandidateRepository
from app.recsys.taste import InMemoryTasteRepository
from app.wardrobe import InMemoryWardrobeRepository

DEV_USER = "00000000-0000-0000-0000-000000000001"


class _Sink:
    def publish_many(self, _events) -> None:
        pass


class _FailOnCandidateWork(InMemoryCandidateRepository):
    def candidates_by_slot(self, *args, **kwargs):
        raise AssertionError("candidate work must not run for invalid style")


def _candidate(item_id: str, category: str, slot: str, aesthetic: str) -> Candidate:
    return Candidate(
        item_id=item_id,
        title=item_id,
        category=category,
        slot=slot,
        price=100,
        currency="INR",
        affiliate_url=None,
        lch=(50, 5, 0),
        hue_name="black",
        formality="casual",
        formality_certain=True,
        aesthetic=aesthetic,
    )


def _catalog() -> list[Candidate]:
    return [
        _candidate(f"{style}-{slot}", category, slot, aesthetic)
        for style, aesthetic in (("classic", "vintage"), ("streetwear", "streetwear"))
        for slot, category in (("top", "shirt"), ("bottom", "jeans"), ("footwear", "sneakers"))
    ]


@pytest.fixture(autouse=True)
def _clear_overrides():
    yield
    app.dependency_overrides.clear()


def _client(profile_repo: InMemoryProfileRepository, candidates) -> TestClient:
    app.dependency_overrides[get_profile_repo] = lambda: profile_repo
    app.dependency_overrides[get_account_repo] = lambda: InMemoryAccountRepository(
        existing={DEV_USER}
    )
    app.dependency_overrides[get_candidate_repo] = lambda: candidates
    app.dependency_overrides[get_taste_repo] = lambda: InMemoryTasteRepository()
    app.dependency_overrides[get_event_sink] = lambda: _Sink()
    app.dependency_overrides[get_wardrobe_repo] = lambda: InMemoryWardrobeRepository()
    return TestClient(app)


def test_request_style_overrides_slate_without_mutating_stored_profile():
    profiles = InMemoryProfileRepository()
    stored = Profile(
        occasion="casual",
        style_intent=["classic"],
        source="photo",
        field_confidence={"style_intent": 0.8},
        model_version="photo-v1",
    )
    profiles.upsert(DEV_USER, stored)
    before = stored.model_dump()

    response = _client(profiles, InMemoryCandidateRepository(_catalog())).get(
        "/outfits/recommend", params={"k": 1, "style": "streetwear"}
    )

    assert response.status_code == 200
    assert {
        item["item_id"].split("-", 1)[0] for item in response.json()["outfits"][0]["items"]
    } == {"streetwear"}
    assert profiles.get(DEV_USER) is stored
    assert stored.model_dump() == before


def test_unknown_style_returns_422_before_candidate_work():
    profiles = InMemoryProfileRepository()
    profiles.upsert(DEV_USER, Profile(occasion="casual", style_intent=["classic"]))

    response = _client(profiles, _FailOnCandidateWork([])).get(
        "/outfits/recommend", params={"style": "not-a-style"}
    )

    assert response.status_code == 422


def test_complete_look_style_affects_non_anchor_pieces_without_mutating_stored_profile():
    profiles = InMemoryProfileRepository()
    stored = Profile(
        occasion="casual",
        style_intent=["classic"],
        source="photo",
        field_confidence={"style_intent": 0.8},
        model_version="photo-v1",
    )
    profiles.upsert(DEV_USER, stored)
    before = stored.model_dump()

    response = _client(profiles, InMemoryCandidateRepository(_catalog())).get(
        "/outfits/complete",
        params={"item_id": "classic-top", "k": 1, "style": "streetwear"},
    )

    assert response.status_code == 200
    items = response.json()["outfits"][0]["items"]
    assert {item["item_id"] for item in items if item["slot"] != "top"} == {
        "streetwear-bottom",
        "streetwear-footwear",
    }
    assert profiles.get(DEV_USER) is stored
    assert stored.model_dump() == before


def test_complete_look_unknown_style_returns_422_before_candidate_work():
    profiles = InMemoryProfileRepository()
    profiles.upsert(DEV_USER, Profile(occasion="casual", style_intent=["classic"]))

    response = _client(profiles, _FailOnCandidateWork([])).get(
        "/outfits/complete", params={"item_id": "classic-top", "style": "not-a-style"}
    )

    assert response.status_code == 422
