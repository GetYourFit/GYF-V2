"""Map stored image references to served URLs.

Catalog items persist ``image_refs`` as absolute filesystem paths (written by the
ingester). The client needs a fetchable URL instead of a machine-specific path, so
we map each ref to a public URL: by default the local ``/media`` mount (see
main.py), or — when ``GYF_MEDIA_BASE_URL`` is set — an external store such as a
Supabase Storage public bucket. Only the basename is used (the store is flat).
"""

from __future__ import annotations

import os
from collections.abc import Sequence

from .config import settings

_MEDIA_MOUNT = "/media"


def image_url_from_refs(refs: Sequence[str] | None) -> str | None:
    """First image ref as a fetchable URL, or ``None``.

    Uses ``settings.media_base_url`` when configured (external store), else the
    local ``/media/<filename>`` mount. Only the basename is used: the store is
    flat, so the on-disk parent path is irrelevant to the client.
    """
    if not refs:
        return None
    first = refs[0]
    if not first:
        return None
    # Remote catalogs (Shopify/affiliate feeds) store absolute CDN URLs — those
    # are already fetchable and must pass through untouched; only local file
    # refs get rebased onto the media store.
    if first.startswith(("http://", "https://")):
        return first
    base = settings.media_base_url.rstrip("/") or _MEDIA_MOUNT
    return f"{base}/{os.path.basename(first)}"
