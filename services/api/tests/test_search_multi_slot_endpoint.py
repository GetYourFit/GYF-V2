"""GET /items/search?slots=… — the multi-slot browse path.

Regression for the 2026-07-08 pagination bug: the endpoint divides the GLOBAL
offset by the slot count to advance each slot's own page. If the client's offset
or the server's division is wrong, successive pages re-request the same per-slot
rows and infinite scroll shows duplicates. This pins the per-slot offset the repo
actually receives.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.catalog.retrieval import SearchResult
from app.dependencies import get_item_directory, get_search_repo, get_text_embedder
from app.main import app


class _CapturingRepo:
    """Records the (categories, offset) each slot scan is called with."""

    def __init__(self) -> None:
        self.calls: list[tuple[tuple[str, ...], int]] = []

    def search_by_vector(self, embedding, k, region, offset=0, **kwargs):
        cats = tuple(kwargs.get("categories") or ())
        self.calls.append((cats, offset))
        return [SearchResult(item_id=f"{cats}-{offset}", title="x", score=1.0)]

    def browse(self, categories, k, region, offset=0, genders=None):
        cats = tuple(categories or ())
        self.calls.append((cats, offset))
        return [SearchResult(item_id=f"{cats}-{offset}", title="x", score=0.0)]

    def similar_to_item(self, *a, **k):  # pragma: no cover - unused here
        return []

    def catalog_facets(self, region):  # pragma: no cover - unused here
        raise NotImplementedError


class _FakeEmbedder:
    def embed_query(self, text: str) -> list[float]:
        return [1.0, 0.0]


class _EmptyDirectory:
    def lookup(self, item_ids):
        return {}


def _call(query_string: str, path: str = "/items/search") -> tuple[_CapturingRepo, object]:
    repo = _CapturingRepo()
    app.dependency_overrides[get_search_repo] = lambda: repo
    app.dependency_overrides[get_text_embedder] = _FakeEmbedder
    app.dependency_overrides[get_item_directory] = _EmptyDirectory
    try:
        resp = TestClient(app).get(f"{path}{query_string}")
    finally:
        app.dependency_overrides.clear()
    return repo, resp


def test_page_zero_uses_zero_offset_for_every_slot():
    repo, resp = _call("?q=fashion&slots=top,bottom,full_body,footwear&k=24&offset=0")
    assert resp.status_code == 200
    assert len(repo.calls) == 4  # one scan per slot, one shared embed
    assert all(offset == 0 for _cats, offset in repo.calls)


def test_page_one_advances_each_slot_by_its_own_page_not_by_one():
    # Global offset = one full page (24) across 4 slots → each slot must skip 6,
    # NOT 24 (that would skip 4 pages) and NOT 1 (the bug: re-shows rows 1-5).
    repo, resp = _call("?q=fashion&slots=top,bottom,full_body,footwear&k=24&offset=24")
    assert resp.status_code == 200
    assert all(offset == 6 for _cats, offset in repo.calls), repo.calls


def test_browse_endpoint_embeds_nothing_and_splits_offset_per_slot():
    # /items/browse must NOT call the embedder (no _FakeEmbedder.embed_query) and
    # must advance each slot by its own page: global offset 24 / 4 slots => 6.
    repo, resp = _call("?slots=top,bottom,full_body,footwear&k=24&offset=24", path="/items/browse")
    assert resp.status_code == 200
    assert len(repo.calls) == 4
    assert all(offset == 6 for _cats, offset in repo.calls), repo.calls
    assert resp.headers["Cache-Control"] == "public, max-age=60"


def test_browse_endpoint_single_page_without_slots():
    repo, resp = _call("?k=24&offset=0", path="/items/browse")
    assert resp.status_code == 200
    assert len(repo.calls) == 1  # one mixed page, no per-slot fan-out
    assert repo.calls[0][1] == 0
