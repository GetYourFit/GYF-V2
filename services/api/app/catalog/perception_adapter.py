"""Adapter exposing the ML perception encoder as a :class:`TextEmbedder`.

This bridges the API to the SigLIP text encoder for query-time text->image search.
It imports the ``gyf-ml`` perception package, so it is only importable where that
runtime (and torch) is installed; ``get_text_embedder`` catches the ImportError
and returns ``None`` otherwise, so ``/items/search`` falls back to keyword search.

Architectural note: the product surface and the ML platform communicate via
contracts (plan §1/§3). For the beta this in-process adapter is the simplest
functional bridge; at scale it should be replaced by a perception inference
service client behind the same :class:`TextEmbedder` protocol — no call-site change.
"""

from __future__ import annotations

from functools import lru_cache


class SiglipTextEmbedder:
    """Embeds free-text queries with the shared Marqo-FashionSigLIP text encoder."""

    def __init__(self) -> None:
        # Import here (not at module load) so the import error surfaces only when
        # this embedder is actually constructed.
        from perception.model import default_encoder

        self._encoder = default_encoder()

    def embed_query(self, text: str) -> list[float]:
        return list(_cached_query_vec(self._encoder, text))

    def consume_timings(self) -> dict[str, float | str | None] | None:
        consume = getattr(self._encoder, "consume_timings", None)
        return consume() if callable(consume) else None


@lru_cache(maxsize=512)
def _cached_query_vec(encoder, text: str) -> tuple[float, ...]:
    """Query-embedding cache. One text encode costs seconds on the free-tier CPU
    lane and a full Space round-trip on the remote lane — and Explore fires the
    same default query on every visit. Cache the vector, not just the model.
    Keyed on the encoder instance (a process-wide singleton) + query text;
    tuple-valued so cached entries are immutable."""
    return tuple(float(x) for x in encoder.encode_texts([text])[0])


@lru_cache(maxsize=1)
def cached_text_embedder() -> SiglipTextEmbedder:
    """Process-wide singleton so model weights load once."""
    return SiglipTextEmbedder()
