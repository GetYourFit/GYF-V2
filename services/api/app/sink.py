"""Event sink — the write side of the behavioral spine.

Two interchangeable backends, chosen by ``GYF_EVENT_SINK``:
- ``local`` (default): append-only JSONL — genuinely persists events end-to-end
  with no external infra (dev, tests).
- ``postgres``: the interactions table — the prod behavioural spine.
"""

from __future__ import annotations

import logging
import time
from pathlib import Path
from typing import Protocol

from .config import settings
from .events import InteractionEvent

logger = logging.getLogger("gyf")

_SINK_TIMEOUT_MS = 1_000
_SET_LOCAL_TIMEOUT = "SELECT set_config('statement_timeout', %s, true)"


class EventSink(Protocol):
    def publish(self, event: InteractionEvent) -> None: ...

    def publish_many(self, events: list[InteractionEvent]) -> None:
        """Persist a batch in one shot. A recommendation emits an impression per
        served item (~40/request); publishing them one-by-one is ~40 DB round
        trips. Backends that can batch (Postgres) override this to a single
        connection/round trip; the rest fall back to per-event publish."""
        ...


class NullEventSink:
    """Drops every event — the sink a user gets when they switch off
    "Learn from my activity" (F3 consent).

    Not a test double: this is the honest implementation of a promise the account
    page makes. Learning events are the *only* thing this sink would carry, so
    withholding consent means we never write them, rather than writing them and
    promising not to look.
    """

    def publish(self, event: InteractionEvent) -> None:
        return None

    def publish_many(self, events: list[InteractionEvent]) -> None:
        return None


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


# SQL kept as module constants so tests can assert against them without a live DB.
_UPSERT_USER = "INSERT INTO users (id) VALUES (%s) ON CONFLICT (id) DO NOTHING"
_INSERT_INTERACTIONS = (
    "INSERT INTO interactions (event_id, user_id, target_type, target_id, action, weight, context, ts) "
    "SELECT event_id, user_id, target_type, target_id, action, weight, context_text::jsonb, ts "
    "FROM unnest(%s::uuid[], %s::uuid[], %s::text[], %s::text[], %s::text[], "
    "%s::double precision[], %s::text[], %s::timestamptz[]) AS batch("
    "event_id, user_id, target_type, target_id, action, weight, context_text, ts) "
    "ON CONFLICT (event_id) DO NOTHING"
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
    def _batch(events: list[InteractionEvent]) -> tuple[list, ...]:
        import json

        return (
            [event.event_id for event in events],
            [event.user_id for event in events],
            [event.target_type.value for event in events],
            [event.target_id for event in events],
            [event.action.value for event in events],
            [event.weight for event in events],
            [json.dumps(event.context) for event in events],
            [event.ts for event in events],
        )

    def publish_many(self, events: list[InteractionEvent]) -> None:
        if not events:
            return
        # One connection checkout for the whole batch, and one round trip per
        # statement. The interactions use one UNNEST-backed INSERT, not one server
        # statement per served item: pipelined executemany still made Postgres
        # execute/index every INSERT separately and spiked to 11.6s in production.
        distinct_users = [(uid,) for uid in {e.user_id for e in events}]
        batch = self._batch(events)
        checkout_start = time.perf_counter()
        checkout_ms = setup_ms = user_upsert_ms = interaction_insert_ms = commit_ms = 0.0
        outcome = "success"
        active_phase = "checkout"
        phase_start = checkout_start
        try:
            with self._pool.connection(timeout=_SINK_TIMEOUT_MS / 1000) as conn:  # type: ignore[attr-defined]
                checkout_ms = (time.perf_counter() - checkout_start) * 1000
                with conn.cursor() as cur:  # type: ignore[attr-defined]
                    active_phase = "setup"
                    phase_start = time.perf_counter()
                    cur.execute(_SET_LOCAL_TIMEOUT, (f"{_SINK_TIMEOUT_MS}ms",))
                    setup_ms = (time.perf_counter() - phase_start) * 1000
                    active_phase = "user_upsert"
                    phase_start = time.perf_counter()
                    cur.executemany(_UPSERT_USER, distinct_users)
                    user_upsert_ms = (time.perf_counter() - phase_start) * 1000
                    active_phase = "interaction_insert"
                    phase_start = time.perf_counter()
                    cur.execute(_INSERT_INTERACTIONS, batch)
                    interaction_insert_ms = (time.perf_counter() - phase_start) * 1000
                active_phase = "commit"
                phase_start = time.perf_counter()
            commit_ms = (time.perf_counter() - phase_start) * 1000
        except BaseException:
            outcome = "error"
            elapsed_ms = (time.perf_counter() - phase_start) * 1000
            if active_phase == "checkout":
                checkout_ms = elapsed_ms
            elif active_phase == "setup":
                setup_ms = elapsed_ms
            elif active_phase == "user_upsert":
                user_upsert_ms = elapsed_ms
            elif active_phase == "interaction_insert":
                interaction_insert_ms = elapsed_ms
            else:
                commit_ms = elapsed_ms
            raise
        finally:
            total_ms = (time.perf_counter() - checkout_start) * 1000
            logger.info(
                "event_sink_batch outcome=%s connection_wait_ms=%.2f setup_ms=%.2f "
                "user_upsert_ms=%.2f interaction_insert_ms=%.2f commit_ms=%.2f "
                "total_ms=%.2f rows=%d",
                outcome,
                checkout_ms,
                setup_ms,
                user_upsert_ms,
                interaction_insert_ms,
                commit_ms,
                total_ms,
                len(events),
            )


def get_sink(pool: object | None = None) -> EventSink:
    """Resolve the configured sink from settings.

    ``pool`` (when given) is the process-wide shared pool the Postgres sink reuses
    instead of opening its own — keeps total connections bounded.
    """
    if settings.event_sink == "postgres":
        return PostgresSink(settings.database_url, pool=pool)
    return LocalFileSink()
