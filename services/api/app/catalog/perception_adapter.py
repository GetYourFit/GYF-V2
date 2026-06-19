"""Adapter exposing the ML perception encoder as a :class:`TextEmbedder`.

This bridges the API to the SigLIP text encoder for query-time text->image search.
It imports the ``gyf-ml`` perception package, so it is only importable where that
runtime (and torch) is installed; ``get_text_embedder`` in app.main catches the
ImportError and returns 503 otherwise.

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
        vec = self._encoder.encode_texts([text])[0]
        return [float(x) for x in vec]


@lru_cache(maxsize=1)
def cached_text_embedder() -> SiglipTextEmbedder:
    """Process-wide singleton so model weights load once."""
    return SiglipTextEmbedder()
