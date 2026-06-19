"""PostgresSink tests — verify SQL + params via an injected fake pool (no live DB)."""

from __future__ import annotations

from contextlib import contextmanager

from app.events import InteractionEvent
from app.sink import _INSERT_INTERACTION, _UPSERT_USER, PostgresSink


class FakeConnection:
    def __init__(self, log: list[tuple[str, tuple]]):
        self._log = log

    def execute(self, sql: str, params: tuple) -> None:
        self._log.append((sql, params))


class FakePool:
    def __init__(self):
        self.log: list[tuple[str, tuple]] = []

    @contextmanager
    def connection(self):
        yield FakeConnection(self.log)


def test_postgres_sink_upserts_user_then_inserts_interaction():
    pool = FakePool()
    sink = PostgresSink(dsn="unused", pool=pool)

    event = InteractionEvent(
        user_id="11111111-1111-1111-1111-111111111111",
        target_type="outfit",
        target_id="o1",
        action="save",
        weight=1.0,
    )
    sink.publish(event)

    assert len(pool.log) == 2
    upsert_sql, upsert_params = pool.log[0]
    insert_sql, insert_params = pool.log[1]

    assert upsert_sql == _UPSERT_USER
    assert upsert_params == (event.user_id,)

    assert insert_sql == _INSERT_INTERACTION
    assert insert_params == (
        event.user_id,
        "outfit",
        "o1",
        "save",
        1.0,
        "{}",  # context JSONB-serialized (empty by default)
        event.ts,
    )
