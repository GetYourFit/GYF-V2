"""Saved-outfits tests — save/enrich, idempotent per outfit_key, snapshot update,
delete idempotency, stale-item tolerance, and auth enforcement."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.catalog.directory import InMemoryItemDirectory, ItemDetail
from app.main import app, get_account_repo, get_item_directory, get_saved_outfit_repo
from app.profile.account import InMemoryAccountRepository
from app.saved_outfits import InMemorySavedOutfitRepository

DEV_USER = "00000000-0000-0000-0000-000000000001"

_TOP = ItemDetail(
    item_id="top-1",
    title="Navy Oxford Shirt",
    category="shirt",
    slot="top",
    price=49.0,
    currency="USD",
    color="navy",
    buy_url=None,
    image_url="/media/top-1.jpg",
)
_SHOE = ItemDetail(
    item_id="shoe-1",
    title="White Leather Sneaker",
    category="sneakers",
    slot="footwear",
    price=89.0,
    currency="USD",
    color="white",
    buy_url=None,
    image_url="/media/shoe-1.jpg",
)


def _client(repo=None, directory=None) -> TestClient:
    repo = repo if repo is not None else InMemorySavedOutfitRepository()
    directory = directory if directory is not None else InMemoryItemDirectory([_TOP, _SHOE])
    app.dependency_overrides[get_account_repo] = lambda: InMemoryAccountRepository(
        existing={DEV_USER}
    )
    app.dependency_overrides[get_saved_outfit_repo] = lambda: repo
    app.dependency_overrides[get_item_directory] = lambda: directory
    return TestClient(app)


def _look(**over) -> dict:
    body = {
        "outfit_key": "rec-1:0",
        "item_ids": ["top-1", "shoe-1"],
        "occasion": "casual",
        "explanation": "Clean monochrome pairing",
        "score": 0.91,
        "confidence": 0.78,
        "recommendation_id": "rec-1",
    }
    body.update(over)
    return body


def test_save_then_list_enriches_look():
    try:
        client = _client()
        r = client.post("/collections/outfits", json=_look())
        assert r.status_code == 201
        body = r.json()
        assert body["occasion"] == "casual"
        assert body["confidence"] == 0.78
        assert [i["item_id"] for i in body["items"]] == ["top-1", "shoe-1"]
        assert body["items"][0]["image_url"] == "/media/top-1.jpg"

        listed = client.get("/collections/outfits").json()["outfits"]
        assert len(listed) == 1
        assert listed[0]["explanation"] == "Clean monochrome pairing"
    finally:
        app.dependency_overrides.clear()


def test_save_is_idempotent_per_key_and_updates_snapshot():
    repo = InMemorySavedOutfitRepository()
    try:
        client = _client(repo)
        first = client.post("/collections/outfits", json=_look()).json()["id"]
        # Same outfit_key, new snapshot -> same row, updated fields.
        second = client.post(
            "/collections/outfits",
            json=_look(item_ids=["top-1"], occasion="formal"),
        ).json()["id"]
        assert first == second
        looks = repo.list(DEV_USER)
        assert len(looks) == 1
        assert looks[0].occasion == "formal"
        assert looks[0].item_ids == ["top-1"]
    finally:
        app.dependency_overrides.clear()


def test_stale_item_is_dropped_not_crashed():
    try:
        client = _client()
        r = client.post(
            "/collections/outfits",
            json=_look(outfit_key="k2", item_ids=["does-not-exist", "top-1"]),
        )
        assert r.status_code == 201
        assert [i["item_id"] for i in r.json()["items"]] == ["top-1"]
    finally:
        app.dependency_overrides.clear()


def test_delete_is_idempotent_204():
    repo = InMemorySavedOutfitRepository()
    try:
        client = _client(repo)
        oid = client.post("/collections/outfits", json=_look()).json()["id"]
        assert client.delete(f"/collections/outfits/{oid}").status_code == 204
        assert repo.list(DEV_USER) == []
        assert client.delete(f"/collections/outfits/{oid}").status_code == 204  # idempotent
    finally:
        app.dependency_overrides.clear()


def test_unauth_is_rejected_when_account_deleted():
    accounts = InMemoryAccountRepository(existing={DEV_USER})
    accounts.soft_delete(DEV_USER)
    try:
        app.dependency_overrides[get_account_repo] = lambda: accounts
        app.dependency_overrides[get_saved_outfit_repo] = InMemorySavedOutfitRepository
        app.dependency_overrides[get_item_directory] = lambda: InMemoryItemDirectory([_TOP])
        client = TestClient(app)
        assert client.get("/collections/outfits").status_code == 403
    finally:
        app.dependency_overrides.clear()
