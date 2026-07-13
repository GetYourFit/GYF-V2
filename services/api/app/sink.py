"""Event sink — the write side of the behavioral spine.

Two interchangeable backends, chosen by ``GYF_EVENT_SINK``:
- ``local`` (default): append-only JSONL — genuinely persists events end-to-end
  with no external infra (dev, tests).
- ``kafka``: publishes to Kafka/Redpanda (``GYF_EVENT_BROKER_URL`` / ``GYF_EVENT_TOPIC``).
  The ``kafka-python`` dependency is imported lazily so the local path needs nothing.
"""

from __future__ import annotations

from pathlib import Path
from typing import Protocol

from .config import settings
from .events import InteractionEvent


class EventSink(Protocol):
    def publish(self, event: InteractionEvent) -> None: ...

    def publish_many(self, events: list[InteractionEvent]) -> None:
        """Persist a batch in one shot. A recommendation emits an impression per
        served item (~40/request); publishing them one-by-one is ~40 DB round
        trips. Backends that can batch (Postgres) override this to a single
        connection/round trip; the rest fall back to per-event publish."""
        ...


class LocalFileSink:
    """Append-only JSONL sink for local/dev and tests."""

    def __init__(self, path: str | Path = "data/events.jsonl") -> None:
        self._path = Path(path)
        self._path.parent.mkdir(parents=True, exist_ok=True)

    def publish(self, event: InteractionEvent) -> None:
        with self._path.open("a", encoding="utf-8") as fh:
            fh.write(event.model_dump_json() + "\n")

    def publish_many(self, events: list[InteractionEvent]) -> None:
        if not events:
            return
        with self._path.open("a", encoding="utf-8") as fh:
            fh.writelines(e.model_dump_json() + "\n" for e in events)


class KafkaSink:
    """Publishes events to Kafka/Redpanda. Lazy dependency so local needs nothing."""

    def __init__(self, broker_url: str, topic: str) -> None:
        from kafka import KafkaProducer  # type: ignore[import-untyped]

        self._topic = topic
        self._producer = KafkaProducer(
            bootstrap_servers=broker_url,
            value_serializer=lambda v: v.encode("utf-8"),
        )

    def publish(self, event: InteractionEvent) -> None:
        self._producer.send(self._topic, event.model_dump_json())

    def publish_many(self, events: list[InteractionEvent]) -> None:
        for event in events:  # producer batches internally; per-send is already async
            self.publish(event)


# SQL kept as module constants so tests can assert against them without a live DB.
_UPSERT_USER = "INSERT INTO users (id) VALUES (%s) ON CONFLICT (id) DO NOTHING"
_INSERT_INTERACTION = (
    "INSERT INTO interactions (event_id, user_id, target_type, target_id, action, weight, context, ts) "
    "VALUES (%s, %s, %s, %s, %s, %s, %s, %s) ON CONFLICT (event_id) DO NOTHING"
)


class PostgresSink:
    """Persists events to the relational ``interactions`` spine (queryable serving side).

    Upserts the user first so the FK holds for principals that exist in Supabase Auth
    but not yet in our ``users`` table. The ``psycopg`` dependency and connection pool
    are created lazily so the local/JSONL path needs nothing. A pool may be injected
    for testing.
    """

    def __init__(self, dsn: str, pool: object | None = None) -> None:
        if pool is None:
            from psycopg_pool import ConnectionPool  # lazy: only when this sink is used

            pool = ConnectionPool(dsn, min_size=0, max_size=4, open=True)
        self._pool = pool

    def publish(self, event: InteractionEvent) -> None:
        self.publish_many([event])

    @staticmethod
    def _row(event: InteractionEvent) -> tuple:
        import json

        return (
            event.event_id,
            event.user_id,
            event.target_type.value,
            event.target_id,
            event.action.value,
            event.weight,
            json.dumps(event.context),
            event.ts,
        )

    def publish_many(self, events: list[InteractionEvent]) -> None:
        if not events:
            return
        # One connection checkout for the whole batch, and one round trip per
        # statement via executemany (psycopg3 pipelines it) — a recommendation's
        # ~40 impressions were ~40 separate checkouts + 80 statements before.
        distinct_users = [(uid,) for uid in {e.user_id for e in events}]
        rows = [self._row(e) for e in events]
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            with conn.cursor() as cur:  # type: ignore[attr-defined]
                cur.executemany(_UPSERT_USER, distinct_users)
                cur.executemany(_INSERT_INTERACTION, rows)


def get_sink(pool: object | None = None) -> EventSink:
    """Resolve the configured sink from settings.

    ``pool`` (when given) is the process-wide shared pool the Postgres sink reuses
    instead of opening its own — keeps total connections bounded.
    """
    if settings.event_sink == "kafka":
        return KafkaSink(settings.event_broker_url, settings.event_topic)
    if settings.event_sink == "postgres":
        return PostgresSink(settings.database_url, pool=pool)
    return LocalFileSink()
