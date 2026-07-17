"""PostgresSink tests — verify SQL + params via an injected fake pool (no live DB)."""

from __future__ import annotations

from contextlib import contextmanager

from app.events import InteractionEvent
from app.sink import _INSERT_INTERACTIONS, _SET_LOCAL_TIMEOUT, _UPSERT_USER, PostgresSink


class FakeCursor:
    def __init__(self, log: list[tuple[str, list]]):
        self._log = log

    # publish/publish_many batch every statement through executemany.
    def executemany(self, sql: str, params_seq) -> None:
        self._log.append((sql, list(params_seq)))

    def execute(self, sql: str, params) -> None:
        self._log.append((sql, params))

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


class FakeConnection:
    def __init__(self, log: list[tuple[str, list]]):
        self._log = log

    def cursor(self):
        return FakeCursor(self._log)


class FakePool:
    def __init__(self):
        self.log: list[tuple[str, list]] = []

    @contextmanager
    def connection(self, timeout=None):
        self.timeout = timeout
        yield FakeConnection(self.log)


def _event(target_id: str, user_id: str = "11111111-1111-1111-1111-111111111111"):
    return InteractionEvent(
        user_id=user_id,
        target_type="outfit",
        target_id=target_id,
        action="save",
        weight=1.0,
    )


def test_postgres_sink_upserts_user_then_inserts_interaction():
    pool = FakePool()
    sink = PostgresSink(dsn="unused", pool=pool)
    event = _event("o1")
    sink.publish(event)

    assert pool.timeout == 1.0
    assert len(pool.log) == 3  # timeout setup, user upsert, one batched interaction insert
    assert pool.log[0] == (_SET_LOCAL_TIMEOUT, ("1000ms",))
    upsert_sql, upsert_rows = pool.log[1]
    insert_sql, insert_rows = pool.log[2]

    assert upsert_sql == _UPSERT_USER
    assert upsert_rows == [(event.user_id,)]

    assert insert_sql == _INSERT_INTERACTIONS
    assert insert_sql.endswith("ON CONFLICT (event_id) DO NOTHING")
    assert insert_rows == (
        [event.event_id],
        [event.user_id],
        ["outfit"],
        ["o1"],
        ["save"],
        [1.0],
        ["{}"],
        [event.ts],
    )


def test_publish_many_batches_one_checkout_and_dedupes_users(caplog):
    """~40 impressions/recommendation must be one connection checkout + two
    executemany calls, not 40 — and the user upsert dedupes to distinct ids."""
    pool = FakePool()
    sink = PostgresSink(dsn="unused", pool=pool)
    with caplog.at_level("INFO", logger="gyf"):
        sink.publish_many([_event("o1"), _event("o2"), _event("o3")])

    assert len(pool.log) == 3  # NOT 2 per event
    _, upsert_rows = pool.log[1]
    insert_sql, insert_batch = pool.log[2]
    assert upsert_rows == [("11111111-1111-1111-1111-111111111111",)]  # deduped
    assert insert_sql == _INSERT_INTERACTIONS
    assert len(insert_batch[0]) == 3
    assert len(set(insert_batch[0])) == 3  # repeated semantics remain distinct events
    assert insert_batch[3] == ["o1", "o2", "o3"]
    assert any(
        record.getMessage().startswith("event_sink_batch outcome=success ")
        and record.getMessage().endswith("rows=3")
        for record in caplog.records
    )


def test_publish_many_empty_is_noop():
    pool = FakePool()
    PostgresSink(dsn="unused", pool=pool).publish_many([])
    assert pool.log == []
