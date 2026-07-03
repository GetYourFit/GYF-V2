"""Affiliate attribution — the revenue seam (doctrine D1: a capability port).

Every retailer link the product surfaces passes through an :class:`AffiliateLinker`
before it reaches a client. The Cuelinks lane wraps URLs into tracked deeplinks
(``linksredirect.com``) carrying a ``subid`` so each conversion attributes back to
the surface — and, for stylist recommendations, to the exact ``recommendation_id``
that drove it. That joins purchases to impression slates in the behavioral spine:
the strongest possible training label, and revenue, from the same click.

Unset config (no ``GYF_CUELINKS_CID``) degrades to the null linker: links pass
through untouched and the surface keeps working — a baseline always sits behind
the port (doctrine invariant 5).
"""

from __future__ import annotations

import re
from typing import Protocol
from urllib.parse import quote

from .config import settings

_DEEPLINK_BASE = "https://linksredirect.com/"
# Cuelinks accepts alphanumerics, hyphen and underscore in subids; anything else
# (and over-long values) is stripped so a hostile subid can't corrupt the link.
_SUBID_SAFE = re.compile(r"[^A-Za-z0-9_-]")
_SUBID_MAX = 64


class AffiliateLinker(Protocol):
    """Port: turn a retailer product URL into a monetized, attributed link."""

    def wrap(self, url: str | None, subid: str) -> str | None: ...


class NullAffiliateLinker:
    """Baseline: pass links through untouched (no affiliate network configured)."""

    def wrap(self, url: str | None, subid: str) -> str | None:
        return url


class CuelinksLinker:
    """Cuelinks deeplink lane: ``linksredirect.com/?cid=<channel>&subid=…&url=…``.

    Idempotent (already-wrapped links pass through) and conservative (anything
    that is not a plain http(s) URL passes through unwrapped rather than being
    mangled into a broken redirect).
    """

    def __init__(self, cid: str) -> None:
        self._cid = cid

    def wrap(self, url: str | None, subid: str) -> str | None:
        if not url or not url.startswith(("http://", "https://")):
            return url
        if url.startswith(_DEEPLINK_BASE):
            return url  # idempotent — never double-wrap
        safe_subid = _SUBID_SAFE.sub("", subid)[:_SUBID_MAX]
        return (
            f"{_DEEPLINK_BASE}?cid={self._cid}&source=api"
            f"&subid={safe_subid}&url={quote(url, safe='')}"
        )


def linker_from_settings() -> AffiliateLinker:
    """The configured lane: Cuelinks when ``GYF_CUELINKS_CID`` is set, else null."""
    cid = settings.cuelinks_cid.strip()
    return CuelinksLinker(cid) if cid else NullAffiliateLinker()
