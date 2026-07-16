from __future__ import annotations

import importlib.util
import sys
from contextlib import contextmanager
from pathlib import Path
from types import ModuleType


MIGRATION = (
    Path(__file__).parents[1]
    / "db"
    / "migrations"
    / "versions"
    / "0023_available_category_browse_order.py"
)


def _load_migration():
    spec = importlib.util.spec_from_file_location("category_browse_migration", MIGRATION)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    previous_alembic = sys.modules.get("alembic")
    previous_sqlalchemy = sys.modules.get("sqlalchemy")
    alembic = ModuleType("alembic")
    alembic.op = object()
    sqlalchemy = ModuleType("sqlalchemy")
    sqlalchemy.text = lambda statement: statement
    sys.modules["alembic"] = alembic
    sys.modules["sqlalchemy"] = sqlalchemy
    try:
        spec.loader.exec_module(module)
    finally:
        if previous_alembic is None:
            del sys.modules["alembic"]
        else:
            sys.modules["alembic"] = previous_alembic
        if previous_sqlalchemy is None:
            del sys.modules["sqlalchemy"]
        else:
            sys.modules["sqlalchemy"] = previous_sqlalchemy
    return module


class _Bind:
    def __init__(self, validity: bool | None) -> None:
        self.validity = validity
        self.calls: list[tuple[object, dict[str, str]]] = []

    def scalar(self, statement: object, params: dict[str, str]) -> bool | None:
        self.calls.append((statement, params))
        return self.validity


class _Context:
    as_sql = False

    def __init__(self, bind: _Bind) -> None:
        self.bind = bind
        self.autocommit_entries = 0

    @contextmanager
    def autocommit_block(self):
        self.autocommit_entries += 1
        yield


class _Op:
    def __init__(self, validity: bool | None) -> None:
        self.bind = _Bind(validity)
        self.context = _Context(self.bind)
        self.executed: list[str] = []

    def get_context(self) -> _Context:
        return self.context

    def get_bind(self) -> _Bind:
        return self.bind

    def execute(self, statement: str) -> None:
        self.executed.append(statement)


def test_valid_filtered_browse_index_is_left_untouched() -> None:
    migration = _load_migration()
    op = _Op(True)
    migration.op = op

    migration.upgrade()

    assert op.context.autocommit_entries == 1
    assert len(op.bind.calls) == 1
    assert op.executed == []


def test_absent_filtered_browse_index_is_created_concurrently() -> None:
    migration = _load_migration()
    op = _Op(None)
    migration.op = op

    migration.upgrade()

    assert op.context.autocommit_entries == 1
    assert op.executed == [migration._CREATE]
    assert "(category, (price IS NOT NULL) DESC, id)" in op.executed[0]


def test_invalid_filtered_browse_index_is_dropped_then_recreated() -> None:
    migration = _load_migration()
    op = _Op(False)
    migration.op = op

    migration.upgrade()

    assert op.context.autocommit_entries == 1
    assert op.executed == [
        "DROP INDEX CONCURRENTLY idx_items_available_category_browse_order",
        migration._CREATE,
    ]


def test_every_alembic_revision_fits_the_version_table() -> None:
    versions = MIGRATION.parent
    overlong: list[tuple[str, str]] = []
    for path in sorted(versions.glob("*.py")):
        source = path.read_text(encoding="utf-8")
        namespace: dict[str, object] = {}
        for line in source.splitlines():
            if line.startswith("revision:"):
                exec(line, {}, namespace)
                revision = str(namespace["revision"])
                if len(revision) > 32:
                    overlong.append((path.name, revision))
                break

    assert overlong == [], "alembic_version.version_num is VARCHAR(32): " + ", ".join(
        f"{name}={revision}" for name, revision in overlong
    )
