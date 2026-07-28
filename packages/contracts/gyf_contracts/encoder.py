"""Canonical image/text embedding capability contract.

This dependency-light port is shared by ML adapters, catalogue backfills and API
bridges. Model runtimes remain behind the port; this module intentionally imports
neither NumPy, Pillow nor a model package.
"""

from __future__ import annotations

from typing import Protocol

# The production SigLIP2 B/16 index is vector(768). A different width requires
# the separately approved shadow-index/reindex procedure, never a config flip.
EMBEDDING_DIM = 768

# Fallback only for adapters that cannot expose the model's learned temperature.
DEFAULT_LOGIT_SCALE = 100.0


class ImageTextEncoder(Protocol):
    """Map image-like inputs and text into one L2-normalized embedding space."""

    dim: int
    logit_scale: float

    def encode_images(self, images: list[object]) -> object:
        """Return normalized float32 vectors with one row per input image."""
        ...

    def encode_texts(self, texts: list[str]) -> object:
        """Return normalized float32 vectors with one row per input text."""
        ...
