from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import production_catalog_plans as evidence


EXPECTED_CASES = {
    "browse_anonymous",
    "browse_filtered",
    "browse_deep",
    "browse_taste",
    "search_semantic",
    "search_price",
    "fts_english",
    "fts_hindi",
}


def test_matrix_is_fixed_and_uses_repository_sql() -> None:
    queries = evidence.capture_query_matrix()

    assert {query.case_id for query in queries} == EXPECTED_CASES
    assert all(query.sql.lstrip().lower().startswith(("select", "with")) for query in queries)
    by_id = {query.case_id: query for query in queries}
    assert "ORDER BY e.embedding <=>" in by_id["search_semantic"].sql
    assert "price_asc" not in by_id["search_price"].sql
    assert "ORDER BY i.price ASC NULLS LAST" in by_id["search_price"].sql
    assert "to_tsvector('simple'::regconfig, i.title)" in by_id["fts_english"].sql
    assert "linen:* | shirt:*" in by_id["fts_english"].params
    assert "लाल:* | कुर्ता:*" in by_id["fts_hindi"].params
    assert any("hnsw.ef_search" in setup_sql for setup_sql, _ in by_id["browse_taste"].setup)
    assert {query.case_id for query in evidence.capture_query_matrix(browse_only=True)} == {
        "browse_anonymous",
        "browse_filtered",
        "browse_deep",
        "browse_taste",
    }


class _FakeResult:
    def __init__(self, rows: list[tuple]) -> None:
        self.rows = rows

    def fetchall(self) -> list[tuple]:
        return self.rows

    def fetchone(self) -> tuple | None:
        return self.rows[0] if self.rows else None


class _FakeConnection:
    def __init__(self) -> None:
        self.calls: list[tuple[str, tuple]] = []
        self.rollbacks = 0
        self.closed = False

    def execute(self, sql: str, params: tuple | None = None) -> _FakeResult:
        self.calls.append((sql, tuple(params or ())))
        if sql.startswith("SELECT version_num"):
            return _FakeResult([("0022_catalog_title_search_index",)])
        if sql.startswith("EXPLAIN"):
            return _FakeResult(
                [("Index Scan using idx_items_available_title_fts",), ("Buffers: shared hit=1",)]
            )
        return _FakeResult([])

    def rollback(self) -> None:
        self.rollbacks += 1

    def close(self) -> None:
        self.closed = True


def test_explains_are_read_only_bounded_and_secret_free() -> None:
    connection = _FakeConnection()
    queries = evidence.capture_query_matrix()
    dsn = "postgresql://postgres:super-secret@example.invalid/gyf"
    plans = evidence.run_explains(dsn, queries, connect=lambda _dsn: connection)

    assert plans["__schema_version__"] == "0022_catalog_title_search_index"
    assert connection.closed
    assert connection.rollbacks == len(queries) + 1
    statements = [sql for sql, _ in connection.calls]
    assert statements.count("BEGIN TRANSACTION READ ONLY") == len(queries) + 1
    assert all(
        "statement_timeout" in sql
        or "lock_timeout" in sql
        or sql.startswith(("BEGIN", "SELECT", "EXPLAIN"))
        for sql in statements
    )
    explain_calls = [(sql, params) for sql, params in connection.calls if sql.startswith("EXPLAIN")]
    assert len(explain_calls) == len(queries)
    assert all("EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)" in sql for sql, _ in explain_calls)

    artifact = evidence.build_artifact(
        queries,
        {
            case_id: "Index Cond: embedding <=> '[1,0,0]'::vector\n"
            "Filter: region = 'IN' AND price <= 5000 "
            "AND gender = ANY ('{unisex,women}'::text[])\n"
            "dsn=postgresql://postgres:super-secret@example.invalid/gyf"
            for case_id in EXPECTED_CASES
        },
        schema_version=plans["__schema_version__"],
        dsn=dsn,
        commit="a" * 40,
        captured_at="2026-07-16T00:00:00Z",
    )
    encoded = str(artifact)
    assert "super-secret" not in encoded
    assert "postgresql://" not in encoded
    assert "[1,0,0]" not in encoded
    assert "'IN'" not in encoded
    assert "price <= 5000" not in encoded
    assert "unisex" not in encoded
    assert "<redacted-literal>" in encoded
    assert "<redacted-number>" in encoded
    assert artifact["schema_version"] == "0022_catalog_title_search_index"
    assert artifact["validation"] == {"passed": True, "errors": []}
    assert re.fullmatch(r"[0-9a-f]{64}", artifact["cases"][0]["query_sha256"])


def test_validation_requires_buffers_and_hot_path_indexes() -> None:
    queries = evidence.capture_query_matrix()
    plans = {
        query.case_id: (
            "Index Scan using idx_items_available_title_fts on items\nBuffers: shared hit=1"
            if query.case_id.startswith("fts_")
            else "Index Scan using idx_item_embeddings_hnsw on item_embeddings\n"
            "Buffers: shared hit=1"
            if query.case_id in {"browse_taste", "search_semantic"}
            else "Index Scan using idx_items_available_browse_order on items\nBuffers: shared hit=1"
        )
        for query in queries
    }
    assert evidence.validate_plans(queries, plans) == []

    plans["fts_english"] = "Seq Scan on items\nBuffers: shared hit=1"
    assert evidence.validate_plans(queries, plans) == [
        "fts_english: title GIN index not used",
        "fts_english: sequential items scan",
    ]

    plans["fts_english"] = (
        "Index Scan using idx_items_available_title_fts on items\nBuffers: shared hit=1"
    )
    plans["browse_deep"] = "Seq Scan on items\nBuffers: shared hit=1"
    assert evidence.validate_plans(
        queries,
        plans,
        schema_version="0021_catalog_image_count_index",
    ) == [
        "schema: expected 0022_catalog_title_search_index, found 0021_catalog_image_count_index",
        "browse_deep: browse-order index not used",
        "browse_deep: sequential items scan",
    ]
