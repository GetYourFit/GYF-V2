"""Affiliate attribution — the revenue seam (doctrine D1: a capability port).

Every retailer link the product surfaces passes through an :class:`AffiliateLinker`
before it reaches a client. The Cuelinks lane wraps product URLs into tracked
deeplinks (``linksredirect.com``) carrying a ``subid`` so each conversion
attributes back to the surface — and, for stylist recommendations, to the exact
``recommendation_id`` that drove it. That joins purchases to impression slates
in the behavioral spine: the strongest possible training label, and revenue,
from the same click.

Unset config (no ``GYF_CUELINKS_CID``) degrades to the null linker: safe product
links pass through untouched and the surface keeps working — a baseline always
sits behind the port (doctrine invariant 5). Unsafe, homepage-only, or
Cuelinks-shortened aggregator/home links return ``None`` so clients hide the
shop action instead of sending users to a broken or misleading retailer handoff.
"""

from __future__ import annotations

from hashlib import sha256
import re
from typing import Protocol
from urllib.parse import parse_qsl, parse_qs, quote, urlparse

from .config import settings

_DEEPLINK_BASE = "https://linksredirect.com/"
_DEEPLINK_HOSTS = {"linksredirect.com", "www.linksredirect.com"}
_CUELINKS_SHORT_HOST = "clnk.in"
# Cuelinks accepts alphanumerics, hyphen and underscore in subids. Anything else
# is hashed, not merely stripped, so an accidental email/free-text subid cannot
# leak user data into an outbound affiliate URL.
_SUBID_SAFE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
_SUBID_HASH_PREFIX = "h_"
_SUBID_HASH_HEX = 32
_TRACKING_HOME_QUERY_KEYS = {
    "aff_sub",
    "aff_sub2",
    "aff_sub3",
    "aff_sub4",
    "aff_sub5",
    "attribution_window",
    "campaign_id",
    "clickid",
    "cm_mmc",
    "offer_id",
    "p1",
    "pid",
    "pub_id",
    "ranappid",
    "raneaid",
    "ranmid",
    "ransiteid",
    "return_cancellation_window",
    "source",
    "sub1",
    "sub2",
    "sub3",
    "sub4",
    "sub5",
    "sub_id",
    "subid",
    "u1",
    "u2",
    "u3",
    "u4",
    "u5",
}


class AffiliateLinker(Protocol):
    """Port: turn a retailer product URL into a monetized, attributed link."""

    def wrap(self, url: str | None, subid: str) -> str | None: ...


def _host(url: str) -> str:
    return (urlparse(url).hostname or "").lower().rstrip(".")


def _is_cuelinks_short_host(host: str) -> bool:
    return host == _CUELINKS_SHORT_HOST or host.endswith(f".{_CUELINKS_SHORT_HOST}")


def _is_tracking_only_query(query: str) -> bool:
    params = parse_qsl(query, keep_blank_values=True)
    if not params:
        return True
    for key, _ in params:
        normalized = key.lower()
        if normalized.startswith("utm_"):
            continue
        if normalized not in _TRACKING_HOME_QUERY_KEYS:
            return False
    return True


def _homepage_only(url: str) -> bool:
    parsed = urlparse(url)
    path = parsed.path or "/"
    return path == "/" and _is_tracking_only_query(parsed.query)


def _embedded_linksredirect_target(url: str) -> str | None:
    parsed = urlparse(url)
    if (parsed.hostname or "").lower().rstrip(".") not in _DEEPLINK_HOSTS:
        return None
    target = (parse_qs(parsed.query).get("url") or [None])[0]
    return target.strip() if target else None


def product_serving_url(url: str | None) -> str | None:
    """Return a safe product-serving URL, or ``None`` when no shop action is honest.

    Cuelinks shortlinks such as ``https://clnk.in/...`` and ``https://ajo.clnk.in/...``
    are not product data: resolving them requires a network hop and may end at a
    retailer homepage. Catalogue rows must carry the retailer/product URL (or an
    affiliate deeplink whose embedded target is product-level) before GYF shows a
    shop action.
    """
    if not url:
        return None
    candidate = url.strip()
    if not candidate:
        return None
    parsed = urlparse(candidate)
    if parsed.scheme != "https" or not parsed.hostname:
        return None

    host = _host(candidate)
    if _is_cuelinks_short_host(host):
        return None

    embedded = _embedded_linksredirect_target(candidate)
    if embedded is not None:
        return candidate if product_serving_url(embedded) else None

    if _homepage_only(candidate):
        return None
    return candidate


def _safe_subid(subid: str) -> str:
    if _SUBID_SAFE.fullmatch(subid):
        return subid
    digest = sha256(subid.encode("utf-8")).hexdigest()[:_SUBID_HASH_HEX]
    return f"{_SUBID_HASH_PREFIX}{digest}"


class NullAffiliateLinker(AffiliateLinker):
    """Baseline: pass safe product links through untouched (no network configured)."""

    def wrap(self, url: str | None, subid: str) -> str | None:
        return product_serving_url(url)


class CuelinksLinker(AffiliateLinker):
    """Cuelinks deeplink lane: ``linksredirect.com/?cid=<channel>&subid=…&url=…``.

    Idempotent for GYF-built deeplinks and conservative everywhere else:
    invalid URLs, Cuelinks shortlink/home aggregators and naked retailer
    homepages return ``None`` so clients hide the shop CTA rather than creating a
    broken redirect. Product-level pre-existing Cuelinks deeplinks are unwrapped
    to their retailer URL and rewrapped with GYF's requested ``subid`` so tracking
    is never silently lost.
    """

    def __init__(self, cid: str) -> None:
        self._cid = cid

    def wrap(self, url: str | None, subid: str) -> str | None:
        product_url = product_serving_url(url)
        if product_url is None:
            return None
        safe_subid = _safe_subid(subid)
        if _host(product_url) in _DEEPLINK_HOSTS:
            if self._is_gyf_deeplink(product_url, safe_subid):
                return product_url  # idempotent — never double-wrap our own link
            embedded = _embedded_linksredirect_target(product_url)
            product_url = product_serving_url(embedded)
            if product_url is None:
                return None
        return (
            f"{_DEEPLINK_BASE}?cid={self._cid}&source=api"
            f"&subid={safe_subid}&url={quote(product_url, safe='')}"
        )

    def _is_gyf_deeplink(self, url: str, subid: str) -> bool:
        parsed = urlparse(url)
        params = parse_qs(parsed.query)
        return (
            (params.get("cid") or [None])[0] == self._cid
            and (params.get("source") or [None])[0] == "api"
            and (params.get("subid") or [None])[0] == subid
        )


def linker_from_settings() -> AffiliateLinker:
    """The configured lane: Cuelinks when ``GYF_CUELINKS_CID`` is set, else null."""
    cid = settings.cuelinks_cid.strip()
    return CuelinksLinker(cid) if cid else NullAffiliateLinker()
