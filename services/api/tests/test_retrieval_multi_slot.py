"""search_text_multi_slot: one embed, N cheap slot scans, round-robin interleaved.

Regression coverage for the Explore default-browse fix (2026-07-08): the client
used to fire one /items/search call per outfit slot (each re-embedding the same
query text). This collapses that into a single embed shared across all slots.
"""

from __future__ import annotations

from app.catalog.retrieval import SearchResult, search_text_multi_slot


class FakeEmbedder:
    def __init__(self) -> None:
        self.calls: list[str] = []

    def embed_query(self, text: str) -> list[float]:
        self.calls.append(text)
        return [1.0, 0.0]


class FakeRepo:
    """Returns a fixed page per category tuple, ignores the embedding value."""

    def __init__(self, pages_by_slot: dict[tuple[str, ...], list[SearchResult]]) -> None:
        self._pages = pages_by_slot
        self.embeddings_seen: list[list[float]] = []

    def search_by_vector(self, embedding, k, region, offset=0, **kwargs):
        self.embeddings_seen.append(embedding)
        categories = tuple(kwargs.get("categories") or ())
        return self._pages.get(categories, [])[:k]


def _hit(item_id: str) -> SearchResult:
    return SearchResult(item_id=item_id, title=item_id, score=1.0)


def test_embeds_once_regardless_of_slot_count():
    embedder = FakeEmbedder()
    repo = FakeRepo({("top",): [_hit("t1")], ("bottom",): [_hit("b1")]})

    search_text_multi_slot(repo, embedder, "fashion", 5, None, 0, [["top"], ["bottom"]])

    assert embedder.calls == ["fashion"]  # one embed, not one per slot
    assert len(repo.embeddings_seen) == 2  # still one DB scan per slot
    assert repo.embeddings_seen[0] == repo.embeddings_seen[1]  # same vector reused


def test_interleaves_round_robin_across_slots():
    embedder = FakeEmbedder()
    repo = FakeRepo(
        {
            ("top",): [_hit("t1"), _hit("t2")],
            ("bottom",): [_hit("b1")],
            ("footwear",): [_hit("f1"), _hit("f2")],
        }
    )

    results = search_text_multi_slot(
        repo, embedder, "fashion", 5, None, 0, [["top"], ["bottom"], ["footwear"]]
    )

    assert [r.item_id for r in results] == ["t1", "b1", "f1", "t2", "f2"]


def test_empty_slot_list_returns_no_results():
    embedder = FakeEmbedder()
    repo = FakeRepo({})

    results = search_text_multi_slot(repo, embedder, "fashion", 5, None, 0, [])

    assert results == []
