"""Event sink — the write side of the behavioral spine.

Two interchangeable backends, chosen by ``GYF_EVENT_SINK``:
- ``local`` (default): append-only JSONL — genuinely persists events end-to-end
  with no external infra (dev, tests).
- ``kafka``: publishes to Kafka/Redpanda (``GYF_EVENT_BROKER_URL`` / ``GYF_EVENT_TOPIC``).
  The ``kafka-python`` dependency is imported lazily so the local path needs nothing.
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


def get_sink() -> EventSink:
    """Resolve the configured sink from settings."""
    if settings.event_sink == "kafka":
        return KafkaSink(settings.event_broker_url, settings.event_topic)
    return LocalFileSink()
