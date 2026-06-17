"""Event sink — the write side of the behavioral spine.

P0 ships a working local sink (append-only JSONL) so /feedback genuinely persists
events end-to-end with no external infra. The broker-backed sink (Kafka/Redpanda)
is selected by configuration once P0 infra is provisioned — same interface.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Protocol

from .config import settings
from .events import InteractionEvent


class EventSink(Protocol):
    def publish(self, event: InteractionEvent) -> None: ...


class LocalFileSink:
    """Append-only JSONL sink for local/dev and tests."""

    def __init__(self, path: str | Path = "data/events.jsonl") -> None:
        self._path = Path(path)
        self._path.parent.mkdir(parents=True, exist_ok=True)

    def publish(self, event: InteractionEvent) -> None:
        with self._path.open("a", encoding="utf-8") as fh:
            fh.write(event.model_dump_json() + "\n")


def get_sink() -> EventSink:
    """Resolve the configured sink. Broker-backed sink wired in P0 infra."""
    # TODO(P0-C/D): return KafkaSink(settings.event_broker_url) when env != local.
    _ = settings.event_broker_url
    return LocalFileSink()
