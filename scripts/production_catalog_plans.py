#!/usr/bin/env python3
"""Capture read-only PostgreSQL plans for the production catalogue hot paths.

The SQL is produced by ``PostgresVectorSearchRepository`` itself.  A recording
pool asks the repository to render each fixed case, then the resulting
parameterised statement is run through ``EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)``
against production.  No bind values or result rows are written to the artifact.

The command intentionally reads ``GYF_PROD_DATABASE_URL`` from the environment;
the DSN is never printed or serialised.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Iterable, Protocol

# The script lives outside the API package but must import the production
# repository rather than copying its SQL.  This also makes invocation from the
# repository root and from ``services/api`` behave identically.
_REPO_ROOT = Path(__file__).resolve().parents[1]
_API_ROOT = _REPO_ROOT / "services" / "api"
if str(_API_ROOT) not in sys.path:
    sys.path.insert(0, str(_API_ROOT))

from app.catalog.retrieval import PostgresVectorSearchRepository  # noqa: E402

EMBEDDING_DIM = 768
STATEMENT_TIMEOUT_MS = 15_000
LOCK_TIMEOUT_MS = 2_000
ARTIFACT_VERSION = "f25-catalog-explain-v1"
EXPECTED_SCHEMA_VERSION = "0023_available_category_browse_order"
_WIDEST_SLOT_CATEGORIES = [
    "jeans",
    "trousers",
    "shorts",
    "skirt",
    "salwar",
    "churidar",
    "palazzo",
    "dhoti",
]


class _Result(Protocol):
    def fetchall(self) -> list[tuple]: ...

    def fetchone(self) -> tuple | None: ...


class _Connection(Protocol):
    def execute(self, sql: str, params: tuple | None = None) -> _Result: ...

    def rollback(self) -> None: ...

    def close(self) -> None: ...


class _Connect(Protocol):
    def __call__(self, dsn: str) -> _Connection: ...


@dataclass(frozen=True)
class CapturedQuery:
    case_id: str
    sql: str
    params: tuple
    setup: tuple[tuple[str, tuple], ...]

    @property
    def sql_sha256(self) -> str:
        return hashlib.sha256(self.sql.encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class _Case:
    case_id: str
    invoke: Callable[[PostgresVectorSearchRepository], None]


class EvidenceCaptureError(RuntimeError):
    """Secret-safe failure metadata plus any plans captured before the failure."""

    def __init__(
        self,
        *,
        stage: str,
        cause: Exception,
        plans: dict[str, str] | None = None,
        schema_version: str = "unknown",
    ) -> None:
        self.stage = re.sub(r"[^A-Za-z0-9_.-]", "_", stage)[:80] or "unknown"
        self.error_type = (
            re.sub(r"[^A-Za-z0-9_.-]", "_", type(cause).__name__)[:80] or "Exception"
        )
        sqlstate = getattr(cause, "sqlstate", None)
        self.sqlstate = (
            str(sqlstate)
            if sqlstate and re.fullmatch(r"[A-Z0-9]{5}", str(sqlstate))
            else "unknown"
        )
        self.plans = dict(plans or {})
        self.schema_version = schema_version
        super().__init__(
            f"stage={self.stage} type={self.error_type} sqlstate={self.sqlstate}"
        )


def _vector() -> list[float]:
    """A deterministic, valid FashionSigLIP-sized probe vector."""
    return [1.0] + [0.0] * (EMBEDDING_DIM - 1)


def _cases() -> tuple[_Case, ...]:
    vector = _vector()
    filters = dict(
        region="IN",
        genders=frozenset({"women", "unisex"}),
        # Exact production `slot=bottom` expansion from the shared taxonomy.
        # This is the widest slot today and prevents a single-category ideal
        # case from falsely approving the filtered/deep production path.
        categories=_WIDEST_SLOT_CATEGORIES,
    )
    return (
        _Case(
            "browse_anonymous",
            lambda repo: repo.browse(
                categories=None, k=24, region="IN", seed="f25-anonymous"
            ),
        ),
        _Case(
            "browse_filtered",
            lambda repo: repo.browse(k=24, offset=0, seed="f25-filtered", **filters),
        ),
        _Case(
            "browse_deep",
            lambda repo: repo.browse(k=24, offset=240, seed="f25-deep", **filters),
        ),
        _Case(
            "browse_taste",
            lambda repo: repo.browse(
                k=24,
                offset=0,
                seed="f25-taste",
                taste_vector=vector,
                **filters,
            ),
        ),
        _Case(
            "search_semantic",
            lambda repo: repo.search_by_vector(vector, k=24, region="IN"),
        ),
        _Case(
            "search_price",
            lambda repo: repo.search_by_vector(
                vector, k=24, region="IN", max_price=5000, sort="price_asc"
            ),
        ),
        _Case(
            "fts_english",
            lambda repo: repo.keyword_search("linen shirt", k=24, region="IN"),
        ),
        _Case(
            "fts_hindi",
            lambda repo: repo.keyword_search("लाल कुर्ता", k=24, region="IN"),
        ),
    )


class _RecordingResult:
    def __iter__(self):
        return iter(())

    def fetchall(self) -> list[tuple]:
        return []

    def fetchone(self) -> tuple | None:
        return None


class _RecordingConnection:
    def __init__(self, owner: "_RecordingPool") -> None:
        self._owner = owner

    def __enter__(self) -> "_RecordingConnection":
        return self

    def __exit__(self, *_exc: object) -> bool:
        return False

    def execute(self, sql: str, params: tuple | None = None) -> _RecordingResult:
        bound = tuple(params or ())
        if "set_config" in sql.lower():
            self._owner.setup.append((sql, bound))
        else:
            self._owner.sql = sql
            self._owner.params = bound
        return _RecordingResult()


class _RecordingPool:
    def __init__(self) -> None:
        self.sql = ""
        self.params: tuple = ()
        self.setup: list[tuple[str, tuple]] = []

    def connection(self) -> _RecordingConnection:
        return _RecordingConnection(self)


def capture_query_matrix(
    *, indexed_browse: bool = True, browse_only: bool = False
) -> tuple[CapturedQuery, ...]:
    """Render every production case through the repository without touching a DB."""
    captured: list[CapturedQuery] = []
    for case in _cases():
        if browse_only and not case.case_id.startswith("browse_"):
            continue
        pool = _RecordingPool()
        repo = PostgresVectorSearchRepository(
            "postgresql://capture.invalid/gyf", pool=pool, indexed_browse=indexed_browse
        )
        case.invoke(repo)
        if not pool.sql:
            raise RuntimeError(f"repository did not render SQL for {case.case_id}")
        captured.append(
            CapturedQuery(case.case_id, pool.sql, pool.params, tuple(pool.setup))
        )
    return tuple(captured)


def _connect(dsn: str) -> _Connection:
    try:
        import psycopg
    except ImportError as exc:  # pragma: no cover - CI installs the postgres extra
        raise RuntimeError(
            "psycopg is required; run with the API postgres extra"
        ) from exc
    return psycopg.connect(dsn)


def _read_schema_version(conn: _Connection) -> str:
    """Read the migration marker in a bounded, read-only transaction."""
    conn.execute("BEGIN TRANSACTION READ ONLY")
    try:
        conn.execute(f"SET LOCAL statement_timeout = '{STATEMENT_TIMEOUT_MS}ms'")
        conn.execute(f"SET LOCAL lock_timeout = '{LOCK_TIMEOUT_MS}ms'")
        row = conn.execute("SELECT version_num FROM alembic_version").fetchone()
        return str(row[0]) if row else "unknown"
    finally:
        conn.rollback()


def run_explains(
    dsn: str,
    queries: Iterable[CapturedQuery],
    *,
    connect: _Connect = _connect,
) -> tuple[dict[str, str], list[str]]:
    """Return every obtainable plan and secret-safe per-case capture errors."""
    try:
        conn = connect(dsn)
    except Exception as exc:
        raise EvidenceCaptureError(stage="connect", cause=exc) from None
    try:
        # Schema identity is evidence metadata, not a user-facing response.
        try:
            schema_version = _read_schema_version(conn)
        except Exception as exc:
            raise EvidenceCaptureError(stage="schema", cause=exc) from None
        plans: dict[str, str] = {}
        capture_errors: list[str] = []
        for query in queries:
            try:
                conn.execute("BEGIN TRANSACTION READ ONLY")
                conn.execute(
                    f"SET LOCAL statement_timeout = '{STATEMENT_TIMEOUT_MS}ms'"
                )
                conn.execute(f"SET LOCAL lock_timeout = '{LOCK_TIMEOUT_MS}ms'")
                for setup_sql, setup_params in query.setup:
                    conn.execute(setup_sql, setup_params)
                rows = conn.execute(
                    "EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) " + query.sql,
                    query.params,
                ).fetchall()
                plans[query.case_id] = "\n".join(str(row[0]) for row in rows)
                conn.rollback()
            except Exception as exc:
                try:
                    conn.rollback()
                except Exception:
                    pass
                failure = EvidenceCaptureError(
                    stage=query.case_id,
                    cause=exc,
                    schema_version=schema_version,
                )
                capture_errors.append(f"capture: {failure}")
                continue
        # Keep schema metadata available to callers without another connection.
        plans["__schema_version__"] = schema_version
        return plans, capture_errors
    finally:
        try:
            conn.close()
        except Exception:
            pass


_SYNTHETIC_LITERALS = (
    "linen",
    "shirt",
    "लाल",
    "कुर्ता",
    "f25-anonymous",
    "f25-filtered",
    "f25-deep",
    "f25-taste",
)


def sanitize_plan(plan: str, *, dsn: str = "") -> str:
    """Remove credentials and probe bind values while retaining planner evidence."""
    clean = plan
    if dsn:
        clean = clean.replace(dsn, "<redacted-dsn>")
    clean = re.sub(r"postgres(?:ql)?://[^\s)'\"]+", "<redacted-dsn>", clean, flags=re.I)
    clean = re.sub(r"(?i)password\s*=\s*[^\s,)]+", "password=<redacted>", clean)
    # PostgreSQL renders bound strings, arrays, UUIDs, tsqueries and vectors as
    # single-quoted literals in EXPLAIN output. The artifact needs node/index
    # names, rows, loops, timings and buffers—not the values used to obtain them.
    clean = re.sub(r"'(?:''|[^'])*'", "<redacted-literal>", clean)
    # Numeric filter values can be rendered without quotes (for example a price
    # ceiling). Restrict this replacement to predicate lines so planner costs and
    # actual row/timing evidence remain intact.
    clean = re.sub(
        r"(?m)^(\s*(?:Filter|Index Cond|Recheck Cond):.*?(?:<=|>=|=|<|>))\s*-?\d+(?:\.\d+)?",
        r"\1 <redacted-number>",
        clean,
    )
    for literal in _SYNTHETIC_LITERALS:
        clean = re.sub(re.escape(literal), "<redacted>", clean, flags=re.I)
    return clean


def validate_plans(
    queries: Iterable[CapturedQuery],
    plans: dict[str, str],
    *,
    schema_version: str = EXPECTED_SCHEMA_VERSION,
    indexed_browse: bool = True,
) -> list[str]:
    """Return gate failures that make captured evidence unsafe to accept."""
    errors: list[str] = []
    query_ids = {query.case_id for query in queries}
    if schema_version != EXPECTED_SCHEMA_VERSION:
        errors.append(
            f"schema: expected {EXPECTED_SCHEMA_VERSION}, found {schema_version or 'unknown'}"
        )
    for case_id in sorted(query_ids):
        plan = plans.get(case_id, "")
        if not plan.strip():
            errors.append(f"{case_id}: empty plan")
        elif "Buffers:" not in plan:
            errors.append(f"{case_id}: missing buffer evidence")

    for case_id in sorted(query_ids & {"fts_english", "fts_hindi"}):
        plan = plans.get(case_id, "")
        if "idx_items_available_title_fts" not in plan:
            errors.append(f"{case_id}: title GIN index not used")
        if re.search(r"\bSeq Scan on items\b", plan):
            errors.append(f"{case_id}: sequential items scan")

    for case_id in sorted(query_ids & {"browse_taste", "search_semantic"}):
        if "idx_item_embeddings_hnsw" not in plans.get(case_id, ""):
            errors.append(f"{case_id}: HNSW index not used")
    if indexed_browse:
        for case_id in sorted(query_ids & {"browse_anonymous"}):
            plan = plans.get(case_id, "")
            if "idx_items_available_browse_order" not in plan:
                errors.append(f"{case_id}: anonymous browse-order index not used")
            if re.search(r"\bSeq Scan on items\b", plan):
                errors.append(f"{case_id}: sequential items scan")
        for case_id in sorted(query_ids & {"browse_filtered", "browse_deep"}):
            plan = plans.get(case_id, "")
            if "idx_items_available_category_browse_order" not in plan:
                errors.append(f"{case_id}: category browse-order index not used")
            if re.search(r"\bSeq Scan on items\b", plan):
                errors.append(f"{case_id}: sequential items scan")
    return errors


def _commit_id() -> str:
    # The workflow deliberately checks out the trusted default branch even when
    # workflow_dispatch targets another ref, so GITHUB_SHA is not authoritative.
    try:
        value = subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=_REPO_ROOT, text=True, timeout=3
        ).strip()
    except (OSError, subprocess.SubprocessError):
        value = "unknown"
    return value if re.fullmatch(r"[0-9a-fA-F]{7,64}", value) else "unknown"


def build_artifact(
    queries: Iterable[CapturedQuery],
    plans: dict[str, str],
    *,
    schema_version: str,
    dsn: str = "",
    browse_mode: str = "indexed",
    validation_errors: Iterable[str] = (),
    commit: str | None = None,
    captured_at: str | None = None,
) -> dict[str, object]:
    """Build a secret-safe, deterministic evidence document."""
    safe_schema = re.sub(r"[^A-Za-z0-9_.-]", "_", str(schema_version))[:80] or "unknown"
    return {
        "artifact_version": ARTIFACT_VERSION,
        "captured_at": captured_at
        or datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "commit": commit or _commit_id(),
        "schema_version": safe_schema,
        "browse_mode": browse_mode,
        "statement_timeout_ms": STATEMENT_TIMEOUT_MS,
        "lock_timeout_ms": LOCK_TIMEOUT_MS,
        "validation": {
            "passed": not (errors := list(validation_errors)),
            "errors": errors,
        },
        "cases": [
            {
                "id": query.case_id,
                "query_sha256": query.sql_sha256,
                "plan": sanitize_plan(plans.get(query.case_id, ""), dsn=dsn),
            }
            for query in queries
        ],
    }


def _write_artifact(path: Path, artifact: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(artifact, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path("f25-catalog-plans.json"))
    parser.add_argument(
        "--legacy-browse",
        action="store_true",
        help="Capture the rollback query instead of the production indexed ring.",
    )
    parser.add_argument(
        "--browse-only",
        action="store_true",
        help="Capture only browse cases; shared search cases are emitted by the indexed run.",
    )
    args = parser.parse_args(argv)
    dsn = os.getenv("GYF_PROD_DATABASE_URL", "")
    if not dsn:
        print("GYF_PROD_DATABASE_URL is not configured", file=sys.stderr)
        return 2
    queries = capture_query_matrix(
        indexed_browse=not args.legacy_browse,
        browse_only=args.browse_only,
    )
    try:
        plans, capture_errors = run_explains(dsn, queries)
    except EvidenceCaptureError as exc:
        error = f"capture: {exc}"
        artifact = build_artifact(
            queries,
            exc.plans,
            schema_version=exc.schema_version,
            dsn=dsn,
            browse_mode="legacy" if args.legacy_browse else "indexed",
            validation_errors=(error,),
        )
        _write_artifact(args.output, artifact)
        print(
            f"production EXPLAIN failed ({exc}; secret details suppressed)",
            file=sys.stderr,
        )
        return 1
    except Exception as exc:  # noqa: BLE001 - never print exception messages or DSNs
        error_type = re.sub(r"[^A-Za-z0-9_.-]", "_", type(exc).__name__)[:80]
        error = f"capture: stage=unexpected type={error_type or 'Exception'} sqlstate=unknown"
        artifact = build_artifact(
            queries,
            {},
            schema_version="unknown",
            dsn=dsn,
            browse_mode="legacy" if args.legacy_browse else "indexed",
            validation_errors=(error,),
        )
        _write_artifact(args.output, artifact)
        print(
            f"production EXPLAIN failed ({error}; secret details suppressed)",
            file=sys.stderr,
        )
        return 1
    schema_version = str(plans.pop("__schema_version__", "unknown"))
    validation_errors = validate_plans(
        queries,
        plans,
        schema_version=schema_version,
        indexed_browse=not args.legacy_browse,
    )
    validation_errors.extend(capture_errors)
    artifact = build_artifact(
        queries,
        plans,
        schema_version=schema_version,
        dsn=dsn,
        browse_mode="legacy" if args.legacy_browse else "indexed",
        validation_errors=validation_errors,
    )
    _write_artifact(args.output, artifact)
    print(f"wrote {len(queries)} sanitized production plans to {args.output}")
    if validation_errors:
        for error in validation_errors:
            print(f"gate failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
