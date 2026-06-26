"""Saved-collections tests — save idempotency, enrichment, unknown item, unauth."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.catalog.directory import InMemoryItemDirectory, ItemDetail
from app.collections import InMemoryCollectionRepository
from app.main import app, get_account_repo, get_collection_repo, get_item_directory
from app.profile.account import InMemoryAccountRepository

DEV_USER = "00000000-0000-0000-0000-000000000001"

_ITEM = ItemDetail(
    item_id="item-1",
    title="Navy Oxford Shirt",
    category="shirt",
    slot="top",
    price=49.0,
    currency="USD",
    color="navy",
    buy_url=None,
    image_url="/media/item-1.jpg",
)


def _client(repo=None, directory=None) -> TestClient:
    repo = repo if repo is not None else InMemoryCollectionRepository()
    directory = directory if directory is not None else InMemoryItemDirectory([_ITEM])
    app.dependency_overrides[get_account_repo] = lambda: InMemoryAccountRepository(
        existing={DEV_USER}
    )
    app.dependency_overrides[get_collection_repo] = lambda: repo
    app.dependency_overrides[get_item_directory] = lambda: directory
    return TestClient(app)


def test_save_then_list_enriches_item():
    repo = InMemoryCollectionRepository()
    try:
        client = _client(repo)
        r = client.post("/collections", json={"item_id": "item-1"})
        assert r.status_code == 201
        assert r.json()["title"] == "Navy Oxford Shirt"
        listed = client.get("/collections").json()["items"]
        assert [i["item_id"] for i in listed] == ["item-1"]
        assert listed[0]["image_url"] == "/media/item-1.jpg"
        assert listed[0]["buy_url"] is None  # honest: no buy link in the seed
    finally:
        app.dependency_overrides.clear()


def test_save_is_idempotent():
    repo = InMemoryCollectionRepository()
    try:
        client = _client(repo)
        client.post("/collections", json={"item_id": "item-1"})
        client.post("/collections", json={"item_id": "item-1"})
        assert repo.list_item_ids(DEV_USER) == ["item-1"]  # not duplicated
    finally:
        app.dependency_overrides.clear()


def test_save_unknown_item_404s():
    try:
        client = _client()
        r = client.post("/collections", json={"item_id": "does-not-exist"})
        assert r.status_code == 404
    finally:
        app.dependency_overrides.clear()


def test_delete_is_idempotent_204():
    repo = InMemoryCollectionRepository()
    try:
        client = _client(repo)
        client.post("/collections", json={"item_id": "item-1"})
        assert client.delete("/collections/item-1").status_code == 204
        assert repo.list_item_ids(DEV_USER) == []
        assert client.delete("/collections/item-1").status_code == 204  # idempotent
    finally:
        app.dependency_overrides.clear()


def test_unauth_is_rejected_when_account_deleted():
    accounts = InMemoryAccountRepository(existing={DEV_USER})
    accounts.soft_delete(DEV_USER)
    try:
        app.dependency_overrides[get_account_repo] = lambda: accounts
        app.dependency_overrides[get_collection_repo] = InMemoryCollectionRepository
        app.dependency_overrides[get_item_directory] = lambda: InMemoryItemDirectory([_ITEM])
        client = TestClient(app)
        assert client.get("/collections").status_code == 403
    finally:
        app.dependency_overrides.clear()
