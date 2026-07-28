import sys
from importlib import import_module
from types import SimpleNamespace

from app.db import psycopg_connection_kwargs, psycopg_pool_kwargs


def test_psycopg_connection_kwargs_disable_prepared_statements():
    assert psycopg_connection_kwargs() == {"prepare_threshold": None}


def test_psycopg_pool_kwargs_disable_prepared_statements():
    assert psycopg_pool_kwargs() == {"kwargs": {"prepare_threshold": None}}


def test_shared_pool_uses_configured_transaction_pool_size(monkeypatch):
    monkeypatch.setitem(
        sys.modules,
        "psycopg",
        SimpleNamespace(errors=SimpleNamespace(QueryCanceled=Exception)),
    )
    monkeypatch.setitem(sys.modules, "psycopg.errors", SimpleNamespace(QueryCanceled=Exception))

    dependencies = import_module("app.dependencies")
    settings = import_module("app.config").settings

    dependencies.shared_pool.cache_clear()
    original_size = settings.db_pool_max_size
    settings.db_pool_max_size = 12

    calls: list[tuple[str, dict[str, object]]] = []

    class FakeConnectionPool:
        def __init__(self, dsn, **kwargs):
            calls.append((dsn, kwargs))

    monkeypatch.setitem(
        sys.modules,
        "psycopg_pool",
        SimpleNamespace(ConnectionPool=FakeConnectionPool),
    )

    try:
        dependencies.shared_pool("postgresql://pooler.example:6543/postgres")
    finally:
        settings.db_pool_max_size = original_size
        dependencies.shared_pool.cache_clear()
        sys.modules.pop("psycopg_pool", None)

    assert calls == [
        (
            "postgresql://pooler.example:6543/postgres",
            {
                "min_size": 12,
                "max_size": 12,
                "timeout": 3.0,
                "kwargs": {"prepare_threshold": None},
                "open": True,
            },
        )
    ]


def test_database_ready_uses_transaction_safe_connection_settings(monkeypatch):
    observability = import_module("app.observability")
    executed: list[str] = []
    connect_calls: list[tuple[str, dict[str, object]]] = []

    class FakeCursor:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def execute(self, sql):
            executed.append(sql)

        def fetchone(self):
            return (1,)

    class FakeConnection:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def cursor(self):
            return FakeCursor()

    def fake_connect(dsn, **kwargs):
        connect_calls.append((dsn, kwargs))
        return FakeConnection()

    monkeypatch.setitem(sys.modules, "psycopg", SimpleNamespace(connect=fake_connect))

    assert observability.database_ready("postgresql://pooler.example:6543/postgres") is True
    assert connect_calls == [
        (
            "postgresql://pooler.example:6543/postgres",
            {"connect_timeout": 2, "prepare_threshold": None},
        )
    ]
    assert executed == ["SET LOCAL statement_timeout = 1000", "SELECT 1"]
