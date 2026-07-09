"""PostgresSink tests — verify SQL + params via an injected fake pool (no live DB)."""

from __future__ import annotations

from contextlib import contextmanager

from app.events import InteractionEvent
from app.sink import _INSERT_INTERACTION, _UPSERT_USER, PostgresSink


class FakeCursor:
    def __init__(self, log: list[tuple[str, list]]):
        self._log = log

    # publish/publish_many batch every statement through executemany.
    def executemany(self, sql: str, params_seq) -> None:
        self._log.append((sql, list(params_seq)))

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
    def connection(self):
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

    assert len(pool.log) == 2  # one executemany for users, one for interactions
    upsert_sql, upsert_rows = pool.log[0]
    insert_sql, insert_rows = pool.log[1]

    assert upsert_sql == _UPSERT_USER
    assert upsert_rows == [(event.user_id,)]

    assert insert_sql == _INSERT_INTERACTION
    assert insert_rows == [
        (event.user_id, "outfit", "o1", "save", 1.0, "{}", event.ts)
    ]


def test_publish_many_batches_one_checkout_and_dedupes_users():
    """~40 impressions/recommendation must be one connection checkout + two
    executemany calls, not 40 — and the user upsert dedupes to distinct ids."""
    pool = FakePool()
    sink = PostgresSink(dsn="unused", pool=pool)
    sink.publish_many([_event("o1"), _event("o2"), _event("o3")])

    assert len(pool.log) == 2  # NOT 2 per event
    _, upsert_rows = pool.log[0]
    _, insert_rows = pool.log[1]
    assert upsert_rows == [("11111111-1111-1111-1111-111111111111",)]  # deduped
    assert len(insert_rows) == 3


def test_publish_many_empty_is_noop():
    pool = FakePool()
    PostgresSink(dsn="unused", pool=pool).publish_many([])
    assert pool.log == []
