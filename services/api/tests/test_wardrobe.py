"""Wardrobe tests — catalog reference, freeform classify, unknown item, delete."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.catalog.directory import InMemoryItemDirectory, ItemDetail
from app.main import app, get_account_repo, get_item_directory, get_wardrobe_repo
from app.profile.account import InMemoryAccountRepository
from app.wardrobe import InMemoryWardrobeRepository

DEV_USER = "00000000-0000-0000-0000-000000000001"

_ITEM = ItemDetail(
    item_id="item-1",
    title="Blue Jeans",
    category="jeans",
    slot="bottom",
    price=None,
    currency=None,
    color="indigo",
    buy_url=None,
    image_url="/media/item-1.jpg",
)


def _client(repo=None, directory=None) -> TestClient:
    repo = repo if repo is not None else InMemoryWardrobeRepository()
    directory = directory if directory is not None else InMemoryItemDirectory([_ITEM])
    app.dependency_overrides[get_account_repo] = lambda: InMemoryAccountRepository(
        existing={DEV_USER}
    )
    app.dependency_overrides[get_wardrobe_repo] = lambda: repo
    app.dependency_overrides[get_item_directory] = lambda: directory
    return TestClient(app)


def test_add_catalog_reference_enriches():
    try:
        client = _client()
        r = client.post("/wardrobe/items", json={"item_id": "item-1"})
        assert r.status_code == 201
        body = r.json()
        assert body["title"] == "Blue Jeans"
        assert body["slot"] == "bottom"
        assert body["image_url"] == "/media/item-1.jpg"
    finally:
        app.dependency_overrides.clear()


def test_add_freeform_classifies_category():
    try:
        client = _client()
        r = client.post("/wardrobe/items", json={"title": "My favourite saree"})
        assert r.status_code == 201
        body = r.json()
        assert body["category"] == "saree"  # classified via taxonomy
        assert body["slot"] == "full_body"
        assert body["item_id"] is None
    finally:
        app.dependency_overrides.clear()


def test_add_unknown_item_id_404s():
    try:
        client = _client()
        r = client.post("/wardrobe/items", json={"item_id": "nope"})
        assert r.status_code == 404
    finally:
        app.dependency_overrides.clear()


def test_add_requires_reference_or_title():
    try:
        client = _client()
        assert client.post("/wardrobe/items", json={}).status_code == 422
    finally:
        app.dependency_overrides.clear()


def test_list_and_delete():
    repo = InMemoryWardrobeRepository()
    try:
        client = _client(repo)
        created = client.post("/wardrobe/items", json={"item_id": "item-1"}).json()
        wid = created["id"]
        assert len(client.get("/wardrobe/items").json()["items"]) == 1
        assert client.delete(f"/wardrobe/items/{wid}").status_code == 204
        assert client.get("/wardrobe/items").json()["items"] == []
    finally:
        app.dependency_overrides.clear()


def test_correct_category_reclassifies_and_persists():
    repo = InMemoryWardrobeRepository()
    try:
        client = _client(repo)
        created = client.post("/wardrobe/items", json={"title": "Mystery garment"}).json()
        wid = created["id"]
        r = client.patch(f"/wardrobe/items/{wid}", json={"category": "saree"})
        assert r.status_code == 200
        body = r.json()
        assert body["category"] == "saree"
        assert body["slot"] == "full_body"  # slot follows the corrected category
        assert client.get("/wardrobe/items").json()["items"][0]["category"] == "saree"
    finally:
        app.dependency_overrides.clear()


def test_correct_category_rejects_unknown_and_missing():
    repo = InMemoryWardrobeRepository()
    try:
        client = _client(repo)
        created = client.post("/wardrobe/items", json={"title": "Blue jeans"}).json()
        # A label the taxonomy cannot place is a client error, not a silent "unknown".
        r = client.patch(f"/wardrobe/items/{created['id']}", json={"category": "xyzzy"})
        assert r.status_code == 422
        # Someone else's / vanished row is a 404.
        assert client.patch("/wardrobe/items/nope", json={"category": "saree"}).status_code == 404
    finally:
        app.dependency_overrides.clear()
