"""Cuelinks Publisher API client (server-side only).

The Publisher API is used for operator-side campaign discovery and for converting
known product URLs into Cuelinks-attributed links. It is deliberately not imported
by Expo/Next code and never serializes the API key into responses, logs or errors.

Important catalogue truth boundary: ``/campaigns`` tells GYF which merchants are
available to the publisher account, and ``/links/convert`` wraps a URL GYF already
has. Neither endpoint supplies product-card facts (title, image, price,
availability). Product catalogue rows still need a retailer/product feed or API.
"""

from __future__ import annotations

from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
import json
from typing import Any
from urllib.parse import urlencode, urlparse
from urllib.request import HTTPRedirectHandler

from ..affiliate import product_serving_url, safe_cuelinks_subid
from ..config import settings

_DEFAULT_BASE_URL = "https://developers.cuelinks.com/pub_api/v3"
_USER_AGENT = "GYF-CuelinksPublisherClient/1.0 (+https://www.getyourfit.tech; gyf1ltd@gmail.com)"
_MAX_PER_PAGE = 100
# Official docs cross-check:
# - developers.cuelinks.com/#api (current V3): Authorization: Token <key>,
#   /pub_api/v3/ping, /campaigns, /links/convert, /transactions, /reports/*.
# - cuelinks.docs.apiary.io (legacy V2): Authorization: Token token=<key>,
#   /api/v2/campaigns.json, /links.json, /offers.json, /transactions.json.
DEVELOPER_V3_ENDPOINTS = {
    "ping": ("GET", "/ping", "read:campaigns"),
    "campaigns": ("GET", "/campaigns", "read:campaigns"),
    "links_convert": ("POST", "/links/convert", "write:links"),
    "transactions": ("GET", "/transactions", "read:transactions"),
    "reports_performance": ("GET", "/reports/performance", "read:reports"),
    "reports_campaigns": ("GET", "/reports/campaigns", "read:reports"),
}
APIARY_V2_ENDPOINTS = {
    "campaigns": ("GET", "/v2/campaigns.json", "read:campaigns"),
    "links": ("GET", "/v2/links.json", "write:links"),
    "offers": ("GET", "/v2/offers.json", "read:offers"),
    "transactions": ("GET", "/v2/transactions.json", "read:transactions"),
}
# Captain-confirmed Cuelinks Publisher API permissions for this backend-only integration.
# The implemented PR surface uses campaign discovery + link conversion only; read:offers is the
# follow-up candidate to inspect for product-card rows before any source consolidation.
IMPLEMENTED_PUBLISHER_PERMISSIONS = frozenset({"read:campaigns", "write:links"})
FOLLOW_UP_PUBLISHER_PERMISSIONS = frozenset({"read:offers", "read:reports", "read:transactions"})
_PRODUCT_ROW_ALIASES: Mapping[str, tuple[str, ...]] = {
    "title": ("title", "name", "product_name", "Product Name"),
    "image": ("image", "image_url", "image_link", "Image URL"),
    "price": ("price", "sale_price", "selling_price", "current_price"),
    "availability": ("availability", "stock", "in_stock", "inventory_status"),
    "product_url": (
        "product_url",
        "product_link",
        "Product URL",
        "Product Link",
        "url",
        "link",
        "deep_link",
    ),
}
Transport = Callable[[str, str, Mapping[str, str], bytes | None, float], tuple[int, bytes]]


class _NoRedirectHandler(HTTPRedirectHandler):
    def redirect_request(self, *_args: Any, **_kwargs: Any) -> None:
        return None


class CuelinksPublisherError(RuntimeError):
    """Base class for Cuelinks Publisher API failures."""


class CuelinksPublisherConfigError(CuelinksPublisherError):
    """Raised when the API client is not safely configured."""


class CuelinksPublisherAuthError(CuelinksPublisherError):
    """Raised on a 401/403 from Cuelinks without exposing the token."""


class CuelinksPublisherResponseError(CuelinksPublisherError):
    """Raised when Cuelinks returns an unsupported status or malformed body."""


def _validate_base_url(base_url: str) -> str:
    candidate = base_url.strip().rstrip("/")
    parsed = urlparse(candidate)
    if parsed.scheme != "https" or not parsed.netloc or parsed.query or parsed.fragment:
        raise CuelinksPublisherConfigError(
            "Cuelinks API base URL must be a plain https origin/path"
        )
    return candidate


def _https_url(value: str | None) -> str | None:
    if not value:
        return None
    candidate = value.strip()
    parsed = urlparse(candidate)
    if parsed.scheme != "https" or not parsed.hostname:
        return None
    return candidate


def _json_object(data: bytes, *, context: str) -> Mapping[str, Any]:
    try:
        parsed = json.loads(data.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise CuelinksPublisherResponseError(
            f"Cuelinks {context} response was not valid JSON"
        ) from exc
    if not isinstance(parsed, Mapping):
        raise CuelinksPublisherResponseError(f"Cuelinks {context} response was not a JSON object")
    return parsed


def _extract_collection(payload: Mapping[str, Any], *, context: str) -> Sequence[Mapping[str, Any]]:
    candidates: Any = None
    for key in ("campaigns", "data", "items", "results"):
        value = payload.get(key)
        if isinstance(value, list):
            candidates = value
            break
    if candidates is None:
        raise CuelinksPublisherResponseError(f"Cuelinks {context} response did not contain a list")
    if not all(isinstance(item, Mapping) for item in candidates):
        raise CuelinksPublisherResponseError(f"Cuelinks {context} list contained malformed rows")
    return candidates


def _field(row: Mapping[str, Any], *names: str) -> Any:
    lowered = {str(key).casefold(): value for key, value in row.items()}
    for name in names:
        value = lowered.get(name.casefold())
        if value not in (None, ""):
            return value
    return None


def _boolish(value: Any) -> bool | None:
    if isinstance(value, bool):
        return value
    if value is None:
        return None
    normalized = str(value).strip().casefold()
    if normalized in {"1", "true", "yes", "y", "enabled", "available", "open"}:
        return True
    if normalized in {"0", "false", "no", "n", "disabled", "closed", "unavailable"}:
        return False
    return None


@dataclass(frozen=True)
class CuelinksPublisherCampaign:
    """Normalized campaign row from the Publisher API."""

    campaign_id: str | None
    name: str
    domain: str | None
    access_status: str | None
    deeplink_enabled: bool | None
    countries: tuple[str, ...]
    categories: tuple[str, ...]
    epc_7d: float | None
    raw: Mapping[str, Any]

    @classmethod
    def from_api(cls, row: Mapping[str, Any]) -> "CuelinksPublisherCampaign":
        name = _field(row, "name", "campaign_name", "campaign", "merchant", "merchant_name")
        if not name:
            raise CuelinksPublisherResponseError(
                "Cuelinks campaign row lacked a merchant/campaign name"
            )
        countries = _string_tuple(
            _field(row, "countries", "country", "regions", "market"), mapping_key="iso"
        )
        categories = _string_tuple(
            _field(row, "categories", "category", "verticals", "vertical"), mapping_key="name"
        )
        epc_value = _field(row, "epc_7d", "epc7d", "7_day_epc")
        return cls(
            campaign_id=_optional_str(_field(row, "id", "campaign_id", "campaignId", "offer_id")),
            name=str(name).strip(),
            domain=_optional_str(_field(row, "domain", "url", "website", "merchant_url")),
            access_status=_optional_str(_field(row, "access_status", "status", "approval_status")),
            deeplink_enabled=_boolish(
                _field(
                    row,
                    "deeplink",
                    "deep_link",
                    "deeplink_enabled",
                    "deep_link_enabled",
                    "deeplink_allowed",
                )
            ),
            countries=countries,
            categories=categories,
            epc_7d=_optional_float(epc_value),
            raw=dict(row),
        )


def _optional_str(value: Any) -> str | None:
    if value in (None, ""):
        return None
    return str(value).strip() or None


def _optional_float(value: Any) -> float | None:
    if value in (None, ""):
        return None
    try:
        return float(str(value).strip().replace(",", ""))
    except ValueError:
        return None


def _string_tuple(value: Any, *, mapping_key: str | None = None) -> tuple[str, ...]:
    if value in (None, ""):
        return ()
    if isinstance(value, str):
        parts = value.replace("|", ",").replace(";", ",").split(",")
    elif isinstance(value, (list, tuple)):
        parts = [
            part.get(mapping_key) if mapping_key and isinstance(part, Mapping) else part
            for part in value
        ]
    elif mapping_key and isinstance(value, Mapping):
        parts = [value.get(mapping_key)]
    else:
        parts = [value]
    return tuple(str(part).strip() for part in parts if part and str(part).strip())


@dataclass(frozen=True)
class CuelinksCampaignPage:
    campaigns: tuple[CuelinksPublisherCampaign, ...]
    pagination: Mapping[str, Any]
    raw: Mapping[str, Any]


@dataclass(frozen=True)
class CuelinksConvertedLink:
    url: str
    requested_url: str
    subid: str
    shortened: bool
    affiliated: bool | None
    raw: Mapping[str, Any]


def _urllib_transport(
    method: str, url: str, headers: Mapping[str, str], body: bytes | None, timeout_s: float
) -> tuple[int, bytes]:
    import urllib.error
    import urllib.request

    request = urllib.request.Request(url, data=body, headers=dict(headers), method=method)
    opener = urllib.request.build_opener(_NoRedirectHandler())
    try:
        with opener.open(request, timeout=timeout_s) as response:
            return int(response.status), response.read()
    except urllib.error.HTTPError as exc:
        return int(exc.code), exc.read()


def _payload_rows(payload: Mapping[str, Any]) -> Sequence[Mapping[str, Any]]:
    for key in ("products", "campaigns", "data", "items", "results"):
        value = payload.get(key)
        if isinstance(value, list) and all(isinstance(item, Mapping) for item in value):
            return value
    return ()


def publisher_payload_has_product_rows(payload: Mapping[str, Any]) -> bool:
    """Return true only when a Publisher payload includes product-card row facts.

    Campaign discovery and URL conversion payloads intentionally return false. A future
    Cuelinks product/feed endpoint must return at least title, image, price, availability and a
    product URL before it can replace retailer/catalogue feed sources.
    """

    for row in _payload_rows(payload):
        if all(_field(row, *aliases) for aliases in _PRODUCT_ROW_ALIASES.values()):
            return True
    return False


def campaign_registry_from_publisher_page(page: CuelinksCampaignPage):
    """Adapt discovered Publisher campaigns into the existing ingestion registry.

    The Publisher API's deeplink field is optional/merchant-dependent; missing values fail
    closed (`deeplink_enabled=False`) for product-row ingestion until a capability export proves
    otherwise.
    """

    from .cuelinks import CuelinksCampaign, CuelinksCampaignRegistry

    campaigns = []
    for row in page.campaigns:
        campaigns.append(
            CuelinksCampaign(
                merchant_name=row.name,
                campaign_id=row.campaign_id,
                domain=row.domain,
                country=(row.countries[0] if row.countries else "IN"),
                vertical=(row.categories[0] if row.categories else "fashion"),
                status=row.access_status or "active",
                deeplink_enabled=row.deeplink_enabled is True,
                home_url=row.domain,
            )
        )
    return CuelinksCampaignRegistry(campaigns)


class CuelinksPublisherClient:
    """Small synchronous Publisher API client with injectable transport for tests."""

    def __init__(
        self,
        api_key: str,
        *,
        base_url: str = _DEFAULT_BASE_URL,
        timeout_s: float = 10.0,
        transport: Transport | None = None,
    ) -> None:
        key = api_key.strip()
        if not key:
            raise CuelinksPublisherConfigError("Cuelinks API key is not configured")
        if timeout_s <= 0:
            raise CuelinksPublisherConfigError("Cuelinks API timeout must be positive")
        self._api_key = key
        self._base_url = _validate_base_url(base_url)
        self._timeout_s = timeout_s
        self._transport = transport or _urllib_transport

    def ping(self) -> Mapping[str, Any]:
        return self._request_json("GET", "/ping", context="ping")

    def campaigns(
        self,
        *,
        access_status: str = "open",
        sort: str = "epc_7d",
        order: str = "desc",
        per_page: int = 20,
        page: int | None = None,
    ) -> CuelinksCampaignPage:
        if per_page < 1 or per_page > _MAX_PER_PAGE:
            raise ValueError(f"per_page must be between 1 and {_MAX_PER_PAGE}")
        params: dict[str, str] = {
            "access_status": access_status,
            "sort": sort,
            "order": order,
            "per_page": str(per_page),
        }
        if page is not None:
            if page < 1:
                raise ValueError("page must be >= 1")
            params["page"] = str(page)
        payload = self._request_json("GET", "/campaigns", params=params, context="campaigns")
        rows = _extract_collection(payload, context="campaigns")
        campaigns = tuple(CuelinksPublisherCampaign.from_api(row) for row in rows)
        pagination = payload.get("meta") if isinstance(payload.get("meta"), Mapping) else {}
        if not pagination and isinstance(payload.get("pagination"), Mapping):
            pagination = payload["pagination"]
        return CuelinksCampaignPage(
            campaigns=campaigns, pagination=dict(pagination), raw=payload
        )

    def convert_url(self, url: str, *, subid: str, shorten: bool = True) -> CuelinksConvertedLink:
        product_url = product_serving_url(url)
        if product_url is None:
            raise ValueError("Cuelinks conversion requires a safe https product URL")
        safe_subid = safe_cuelinks_subid(subid)
        payload = self._request_json(
            "POST",
            "/links/convert",
            body={"url": product_url, "subid": safe_subid, "shorten": bool(shorten)},
            context="link conversion",
        )
        converted, affiliated = self._converted_link(payload)
        return CuelinksConvertedLink(
            url=converted,
            requested_url=product_url,
            subid=safe_subid,
            shortened=bool(shorten),
            affiliated=affiliated,
            raw=payload,
        )

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Token {self._api_key}",
            "Accept": "application/json",
            "User-Agent": _USER_AGENT,
        }

    def _request_json(
        self,
        method: str,
        path: str,
        *,
        params: Mapping[str, str] | None = None,
        body: Mapping[str, Any] | None = None,
        context: str,
    ) -> Mapping[str, Any]:
        url = f"{self._base_url}{path}"
        if params:
            url = f"{url}?{urlencode(params)}"
        headers = self._headers()
        data: bytes | None = None
        if body is not None:
            headers["Content-Type"] = "application/json"
            data = json.dumps(body, separators=(",", ":")).encode("utf-8")
        status, response = self._transport(method, url, headers, data, self._timeout_s)
        if status in {401, 403}:
            raise CuelinksPublisherAuthError(f"Cuelinks {context} request was not authorized")
        if status < 200 or status >= 300:
            raise CuelinksPublisherResponseError(
                f"Cuelinks {context} request failed with HTTP {status}"
            )
        return _json_object(response, context=context)

    def _converted_link(self, payload: Mapping[str, Any]) -> tuple[str, bool | None]:
        containers: list[Mapping[str, Any]] = [payload]
        data = payload.get("data")
        if isinstance(data, Mapping):
            containers.append(data)
        affiliated = None
        for container in reversed(containers):
            value = _field(container, "affiliated")
            if value is not None:
                affiliated = _boolish(value)
                break
        for container in containers:
            for key in (
                "tracking_url",
                "url",
                "converted_url",
                "affiliate_url",
                "short_url",
                "shortened_url",
                "link",
            ):
                candidate = _https_url(_optional_str(container.get(key)))
                if candidate:
                    return candidate, affiliated
        raise CuelinksPublisherResponseError(
            "Cuelinks link conversion response lacked an https URL"
        )


def publisher_client_from_settings() -> CuelinksPublisherClient | None:
    """Return the configured Publisher API client, or ``None`` when disabled."""

    key = settings.cuelinks_api_key.strip()
    if not key:
        return None
    return CuelinksPublisherClient(
        key,
        base_url=settings.cuelinks_api_base_url,
        timeout_s=settings.cuelinks_api_timeout_s,
    )


__all__ = [
    "CuelinksCampaignPage",
    "CuelinksConvertedLink",
    "CuelinksPublisherAuthError",
    "CuelinksPublisherCampaign",
    "CuelinksPublisherClient",
    "campaign_registry_from_publisher_page",
    "CuelinksPublisherConfigError",
    "CuelinksPublisherError",
    "CuelinksPublisherResponseError",
    "APIARY_V2_ENDPOINTS",
    "DEVELOPER_V3_ENDPOINTS",
    "FOLLOW_UP_PUBLISHER_PERMISSIONS",
    "IMPLEMENTED_PUBLISHER_PERMISSIONS",
    "publisher_client_from_settings",
    "publisher_payload_has_product_rows",
]
