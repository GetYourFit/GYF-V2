from __future__ import annotations

import json
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


def test_expected_schema_version_matches_the_single_alembic_head() -> None:
    from alembic.config import Config
    from alembic.script import ScriptDirectory

    config = Config(str(evidence._API_ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(evidence._MIGRATIONS_DIR))
    heads = ScriptDirectory.from_config(config).get_heads()

    assert len(heads) == 1
    assert evidence.expected_schema_version() == heads[0]


def test_missing_or_multiple_migration_heads_refuse_evidence() -> None:
    for heads, message in (
        ((), "migration graph has no heads"),
        (("rev-a", "rev-b"), "migration graph has multiple heads: rev-a, rev-b"),
    ):
        try:
            evidence._single_migration_head(heads)
        except evidence.MigrationGraphError as exc:
            assert str(exc) == message
        else:
            raise AssertionError("expected an unsafe migration graph to be rejected")


def test_matrix_is_fixed_and_uses_repository_sql() -> None:
    queries = evidence.capture_query_matrix()

    assert {query.case_id for query in queries} == EXPECTED_CASES
    assert all(
        query.sql.lstrip().lower().startswith(("select", "with")) for query in queries
    )
    by_id = {query.case_id: query for query in queries}
    assert "ORDER BY e.embedding <=>" in by_id["search_semantic"].sql
    assert "price_asc" not in by_id["search_price"].sql
    assert "ORDER BY i.price ASC NULLS LAST" in by_id["search_price"].sql
    assert evidence._WIDEST_SLOT_CATEGORIES in by_id["browse_filtered"].params
    assert "to_tsvector('simple'::regconfig, i.title)" in by_id["fts_english"].sql
    assert "linen:* | shirt:*" in by_id["fts_english"].params
    assert "लाल:* | कुर्ता:*" in by_id["fts_hindi"].params
    assert any(
        "hnsw.ef_search" in setup_sql for setup_sql, _ in by_id["browse_taste"].setup
    )
    assert {
        query.case_id for query in evidence.capture_query_matrix(browse_only=True)
    } == {
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
                [
                    ("Index Scan using idx_items_available_title_fts",),
                    ("Buffers: shared hit=1",),
                ]
            )
        return _FakeResult([])

    def rollback(self) -> None:
        self.rollbacks += 1

    def close(self) -> None:
        self.closed = True


def test_schema_reader_rejects_multiple_deployed_heads() -> None:
    class MultiHeadConnection(_FakeConnection):
        def execute(self, sql: str, params: tuple | None = None) -> _FakeResult:
            self.calls.append((sql, tuple(params or ())))
            if sql.startswith("SELECT version_num"):
                return _FakeResult(
                    [
                        ("0022_catalog_title_search_index",),
                        ("0023_catalog_search_backfill",),
                    ]
                )
            return _FakeResult([])

    connection = MultiHeadConnection()

    try:
        evidence._read_schema_version(connection)
    except RuntimeError as exc:
        assert str(exc) == (
            "deployed schema has multiple heads: "
            "0022_catalog_title_search_index, 0023_catalog_search_backfill"
        )
    else:
        raise AssertionError("expected multiple deployed heads to be rejected")

    assert connection.rollbacks == 1


def test_explains_are_read_only_bounded_and_secret_free() -> None:
    connection = _FakeConnection()
    queries = evidence.capture_query_matrix()
    dsn = "postgresql://postgres:super-secret@example.invalid/gyf"
    plans, capture_errors = evidence.run_explains(
        dsn, queries, connect=lambda _dsn: connection
    )

    assert plans["__schema_version__"] == "0022_catalog_title_search_index"
    assert capture_errors == []
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
    explain_calls = [
        (sql, params) for sql, params in connection.calls if sql.startswith("EXPLAIN")
    ]
    assert len(explain_calls) == len(queries)
    assert all(
        "EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)" in sql for sql, _ in explain_calls
    )

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
    assert artifact["expected_schema_version"] == evidence.expected_schema_version()
    assert artifact["validation"] == {"passed": True, "errors": []}
    assert re.fullmatch(r"[0-9a-f]{64}", artifact["cases"][0]["query_sha256"])


def test_capture_failure_is_classified_without_driver_message() -> None:
    class SecretConnectionError(Exception):
        sqlstate = "08006"

    def fail_connect(_dsn: str):
        raise SecretConnectionError("postgresql://user:secret@example.invalid/gyf")

    try:
        evidence.run_explains(
            "postgresql://user:secret@example.invalid/gyf",
            evidence.capture_query_matrix(),
            connect=fail_connect,
        )
    except evidence.EvidenceCaptureError as exc:
        assert str(exc) == "stage=connect type=SecretConnectionError sqlstate=08006"
        assert "secret" not in str(exc)
        assert exc.plans == {}
        assert exc.schema_version == "unknown"
    else:
        raise AssertionError("expected secret-safe capture failure")


def test_query_failure_preserves_completed_plans_and_continues() -> None:
    class PartialConnection(_FakeConnection):
        def __init__(self) -> None:
            super().__init__()
            self.explain_count = 0

        def execute(self, sql: str, params: tuple | None = None) -> _FakeResult:
            if sql.startswith("EXPLAIN"):
                self.explain_count += 1
                if self.explain_count == 2:
                    raise RuntimeError("password=secret query failed")
            return super().execute(sql, params)

    connection = PartialConnection()
    queries = evidence.capture_query_matrix()
    plans, capture_errors = evidence.run_explains(
        "postgresql://user:secret@example.invalid/gyf",
        queries,
        connect=lambda _dsn: connection,
    )

    assert set(plans) == EXPECTED_CASES - {"browse_filtered"} | {"__schema_version__"}
    assert capture_errors == [
        "capture: stage=browse_filtered type=RuntimeError sqlstate=unknown"
    ]
    assert "secret" not in str(capture_errors)
    assert connection.closed


def test_run_explains_reports_multiple_deployed_heads_clearly() -> None:
    class MultiHeadConnection(_FakeConnection):
        def execute(self, sql: str, params: tuple | None = None) -> _FakeResult:
            self.calls.append((sql, tuple(params or ())))
            if sql.startswith("SELECT version_num"):
                return _FakeResult(
                    [
                        ("0022_catalog_title_search_index",),
                        ("0023_catalog_search_backfill",),
                    ]
                )
            return _FakeResult([])

    try:
        evidence.run_explains(
            "postgresql://user:secret@example.invalid/gyf",
            evidence.capture_query_matrix(),
            connect=lambda _dsn: MultiHeadConnection(),
        )
    except evidence.EvidenceCaptureError as exc:
        assert str(exc) == (
            "stage=schema type=DeployedSchemaError sqlstate=unknown "
            "detail=deployed schema has multiple heads: "
            "0022_catalog_title_search_index, 0023_catalog_search_backfill"
        )
        assert (
            exc.schema_version
            == "0022_catalog_title_search_index+0023_catalog_search_backfill"
        )
        assert exc.plans == {}
    else:
        raise AssertionError("expected deployed multi-head schema to fail capture")


def test_main_writes_diagnostic_artifact_on_capture_failure(
    monkeypatch, tmp_path: Path
) -> None:
    output = tmp_path / "evidence" / "plans.json"
    dsn = "postgresql://user:secret@example.invalid/gyf"
    monkeypatch.setenv("GYF_PROD_DATABASE_URL", dsn)

    def fail(_dsn: str, _queries):
        raise evidence.EvidenceCaptureError(
            stage="schema",
            cause=RuntimeError(f"could not connect to {dsn}"),
        )

    monkeypatch.setattr(evidence, "run_explains", fail)

    assert evidence.main(["--output", str(output)]) == 1
    artifact = json.loads(output.read_text(encoding="utf-8"))
    encoded = json.dumps(artifact)
    assert artifact["validation"] == {
        "passed": False,
        "errors": ["capture: stage=schema type=RuntimeError sqlstate=unknown"],
    }
    assert artifact["expected_schema_version"] == evidence.expected_schema_version()
    assert "secret" not in encoded
    assert "postgresql://" not in encoded
    assert {case["id"] for case in artifact["cases"]} == EXPECTED_CASES


def test_main_refuses_an_unsafe_migration_graph_before_connecting(
    monkeypatch, tmp_path: Path
) -> None:
    output = tmp_path / "evidence" / "plans.json"
    monkeypatch.setenv(
        "GYF_PROD_DATABASE_URL", "postgresql://user:secret@example.invalid/gyf"
    )

    def multiple_heads() -> str:
        raise evidence.MigrationGraphError(
            "migration graph has multiple heads: rev-a, rev-b"
        )

    monkeypatch.setattr(evidence, "expected_schema_version", multiple_heads)

    assert evidence.main(["--output", str(output)]) == 1
    artifact = json.loads(output.read_text(encoding="utf-8"))
    assert artifact["expected_schema_version"] == "unknown"
    assert artifact["validation"] == {
        "passed": False,
        "errors": ["migration: migration graph has multiple heads: rev-a, rev-b"],
    }


def test_validation_requires_buffers_and_hot_path_indexes() -> None:
    queries = evidence.capture_query_matrix()
    plans = {
        query.case_id: (
            "Index Scan using idx_items_available_title_fts on items\nBuffers: shared hit=1"
            if query.case_id.startswith("fts_")
            else "Index Scan using idx_item_embeddings_hnsw on item_embeddings\n"
            "Buffers: shared hit=1"
            if query.case_id in {"browse_taste", "search_semantic"}
            else "Index Scan using idx_items_available_browse_order on items\n"
            "Buffers: shared hit=1"
            if query.case_id == "browse_anonymous"
            else "Index Scan using idx_items_available_category_browse_order on items\n"
            "Buffers: shared hit=1"
        )
        for query in queries
    }
    deployed_schema = evidence.expected_schema_version()
    assert evidence.validate_plans(queries, plans, schema_version=deployed_schema) == []

    plans["fts_english"] = "Seq Scan on items\nBuffers: shared hit=1"
    assert evidence.validate_plans(
        queries, plans, schema_version=deployed_schema
    ) == [
        "fts_english: title GIN index not used",
        "fts_english: sequential items scan",
    ]

    plans["fts_english"] = (
        "Index Scan using idx_items_available_title_fts on items\nBuffers: shared hit=1"
    )
    plans["browse_deep"] = "Seq Scan on items\nBuffers: shared hit=1"
    stale_schema = "0021_catalog_image_count_index"
    assert evidence.validate_plans(
        queries,
        plans,
        schema_version=stale_schema,
    ) == [
        f"schema: expected {evidence.expected_schema_version()}, found {stale_schema}",
        "browse_deep: category browse-order index not used",
        "browse_deep: sequential items scan",
    ]


def test_main_records_multiple_deployed_heads_in_validation_artifact(
    monkeypatch, tmp_path: Path
) -> None:
    output = tmp_path / "evidence" / "plans.json"
    monkeypatch.setenv(
        "GYF_PROD_DATABASE_URL", "postgresql://user:secret@example.invalid/gyf"
    )

    class MultiHeadConnection(_FakeConnection):
        def execute(self, sql: str, params: tuple | None = None) -> _FakeResult:
            self.calls.append((sql, tuple(params or ())))
            if sql.startswith("SELECT version_num"):
                return _FakeResult(
                    [
                        ("0022_catalog_title_search_index",),
                        ("0023_catalog_search_backfill",),
                    ]
                )
            return _FakeResult([])

    original_run_explains = evidence.run_explains
    monkeypatch.setattr(
        evidence, "run_explains", lambda dsn, queries: original_run_explains(
            dsn, queries, connect=lambda _dsn: MultiHeadConnection()
        )
    )

    assert evidence.main(["--output", str(output)]) == 1
    artifact = json.loads(output.read_text(encoding="utf-8"))
    assert (
        artifact["schema_version"]
        == "0022_catalog_title_search_index+0023_catalog_search_backfill"
    )
    assert artifact["validation"] == {
        "passed": False,
        "errors": [
            "capture: stage=schema type=DeployedSchemaError sqlstate=unknown "
            "detail=deployed schema has multiple heads: "
            "0022_catalog_title_search_index, 0023_catalog_search_backfill"
        ],
    }
