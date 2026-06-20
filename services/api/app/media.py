"""Map stored image references to served URLs.

Catalog items persist ``image_refs`` as absolute filesystem paths (written by the
ingester). The API serves the images directory under ``/media`` (see main.py), so
clients receive a stable relative URL — ``/media/<filename>`` — instead of a
machine-specific path they can't fetch.
"""

from __future__ import annotations

import os
from collections.abc import Sequence

_MEDIA_MOUNT = "/media"


def image_url_from_refs(refs: Sequence[str] | None) -> str | None:
    """First image ref as a served ``/media/<filename>`` URL, or ``None``.

    Only the basename is used: the images directory is mounted flat, so the
    on-disk parent path is irrelevant to the client.
    """
    if not refs:
        return None
    first = refs[0]
    if not first:
        return None
    return f"{_MEDIA_MOUNT}/{os.path.basename(first)}"
