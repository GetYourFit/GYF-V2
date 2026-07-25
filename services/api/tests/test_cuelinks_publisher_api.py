import json
import logging
import urllib.request
from urllib.parse import parse_qs, urlparse

import pytest

from app.catalog import cuelinks_api
from app.catalog.cuelinks_api import (
    CuelinksPublisherAuthError,
    CuelinksPublisherClient,
    CuelinksPublisherConfigError,
    CuelinksPublisherResponseError,
    APIARY_V2_ENDPOINTS,
    DEVELOPER_V3_ENDPOINTS,
    FOLLOW_UP_PUBLISHER_PERMISSIONS,
    IMPLEMENTED_PUBLISHER_PERMISSIONS,
    campaign_registry_from_publisher_page,
    publisher_payload_has_product_rows,
)


class FakeTransport:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []

    def __call__(self, method, url, headers, body, timeout_s):
        self.calls.append((method, url, dict(headers), body, timeout_s))
        if not self.responses:
            raise AssertionError("unexpected Cuelinks API call")
        return self.responses.pop(0)


def _body(call):
    return json.loads(call[3].decode("utf-8"))


def test_captain_granted_permissions_are_scoped_to_this_pr_and_follow_up() -> None:
    captain_granted = {
        "read:campaigns",
        "read:reports",
        "read:transactions",
        "read:offers",
        "write:links",
    }

    assert IMPLEMENTED_PUBLISHER_PERMISSIONS == {"read:campaigns", "write:links"}
    assert FOLLOW_UP_PUBLISHER_PERMISSIONS == {
        "read:offers",
        "read:reports",
        "read:transactions",
    }
    assert IMPLEMENTED_PUBLISHER_PERMISSIONS | FOLLOW_UP_PUBLISHER_PERMISSIONS == captain_granted


def test_official_docs_endpoint_shapes_are_cross_checked() -> None:
    assert DEVELOPER_V3_ENDPOINTS["ping"] == ("GET", "/ping", "any")
    assert DEVELOPER_V3_ENDPOINTS["campaigns"] == ("GET", "/campaigns", "read:campaigns")
    assert DEVELOPER_V3_ENDPOINTS["offers"] == ("GET", "/offers", "read:offers")
    assert DEVELOPER_V3_ENDPOINTS["links_convert"] == (
        "POST",
        "/links/convert",
        "write:links",
    )
    assert DEVELOPER_V3_ENDPOINTS["transactions"] == (
        "GET",
        "/transactions",
        "read:transactions",
    )
    assert DEVELOPER_V3_ENDPOINTS["reports_performance"] == (
        "GET",
        "/reports/performance",
        "read:reports",
    )
    assert APIARY_V2_ENDPOINTS["offers"] == ("GET", "/v2/offers.json", "read:offers")
    assert APIARY_V2_ENDPOINTS["links"] == ("GET", "/v2/links.json", "write:links")


def test_ping_uses_token_authorization_without_exposing_secret() -> None:
    transport = FakeTransport([(200, b'{"status":"ok"}')])
    client = CuelinksPublisherClient("unit-secret", transport=transport)

    assert client.ping() == {"status": "ok"}

    method, url, headers, body, timeout_s = transport.calls[0]
    assert method == "GET"
    assert url == "https://developers.cuelinks.com/pub_api/v3/ping"
    assert headers["Authorization"] == "Token unit-secret"
    assert body is None
    assert timeout_s == 10.0


def test_campaign_listing_normalizes_success_response_and_query_params() -> None:
    payload = {
        "campaigns": [
            {
                "id": 42,
                "name": "Flipkart",
                "domain": "https://www.flipkart.com",
                "access_status": "open",
                "deeplink_enabled": "Yes",
                "countries": ["IN"],
                "categories": "Fashion, Footwear",
                "epc_7d": "12.50",
            }
        ],
        "pagination": {"page": 1, "total_pages": 5},
    }
    transport = FakeTransport([(200, json.dumps(payload).encode("utf-8"))])
    client = CuelinksPublisherClient("test-token", transport=transport)

    page = client.campaigns(access_status="open", sort="epc_7d", order="desc", per_page=20)

    assert page.pagination == {"page": 1, "total_pages": 5}
    assert len(page.campaigns) == 1
    campaign = page.campaigns[0]
    assert campaign.campaign_id == "42"
    assert campaign.name == "Flipkart"
    assert campaign.deeplink_enabled is True
    assert campaign.countries == ("IN",)
    assert campaign.categories == ("Fashion", "Footwear")
    assert campaign.epc_7d == 12.5
    registry = campaign_registry_from_publisher_page(page)
    registry_row = registry.resolve(campaign_id="42")
    assert registry_row is not None
    assert registry_row.product_deeplink_allowed is True
    parsed = urlparse(transport.calls[0][1])
    assert parsed.path == "/pub_api/v3/campaigns"
    assert parse_qs(parsed.query) == {
        "access_status": ["open"],
        "sort": ["epc_7d"],
        "order": ["desc"],
        "per_page": ["20"],
    }
    assert publisher_payload_has_product_rows(payload) is False


def test_campaign_listing_normalizes_documented_v3_rows_and_meta_pagination() -> None:
    payload = {
        "data": [
            {
                "id": 42,
                "name": "Flipkart",
                "domain": "https://www.flipkart.com",
                "access_status": "open",
                "deeplink_allowed": True,
                "countries": [{"iso": "IN", "name": "India"}],
                "categories": [{"name": "Fashion"}],
            }
        ],
        "meta": {"page": 1, "next_page": 2, "total": 43},
    }
    transport = FakeTransport([(200, json.dumps(payload).encode("utf-8"))])

    page = CuelinksPublisherClient("test-token", transport=transport).campaigns()

    campaign = page.campaigns[0]
    assert campaign.countries == ("IN",)
    assert campaign.categories == ("Fashion",)
    assert campaign.deeplink_enabled is True
    assert page.pagination == {"page": 1, "next_page": 2, "total": 43}
    registry_row = campaign_registry_from_publisher_page(page).resolve(campaign_id="42")
    assert registry_row is not None
    assert registry_row.product_deeplink_allowed


def test_campaign_listing_defaults_to_all_accessible_campaigns_at_v3_page_limit() -> None:
    transport = FakeTransport([(200, b'{"campaigns":[]}')])
    client = CuelinksPublisherClient("test-token", transport=transport)

    client.campaigns(per_page=500)

    query = parse_qs(urlparse(transport.calls[0][1]).query)
    assert "access_status" not in query
    assert query["per_page"] == ["500"]
    with pytest.raises(ValueError, match="between 1 and 500"):
        client.campaigns(per_page=501)


def test_publisher_product_row_probe_requires_full_product_card_fields() -> None:
    campaign_only = {
        "campaigns": [
            {
                "id": 42,
                "name": "Flipkart",
                "domain": "https://www.flipkart.com",
                "deeplink_enabled": "Yes",
            }
        ]
    }
    conversion_only = {"data": {"url": "https://linksredirect.com/?cid=123"}}
    product_rows = {
        "products": [
            {
                "Product Name": "Cotton Shirt",
                "Image URL": "https://cdn.example/shirt.jpg",
                "Price": "1299",
                "Availability": "in stock",
                "Product URL": "https://merchant.example/products/cotton-shirt",
            }
        ]
    }

    assert publisher_payload_has_product_rows(campaign_only) is False
    assert publisher_payload_has_product_rows(conversion_only) is False
    assert publisher_payload_has_product_rows(product_rows) is True


def test_convert_url_posts_safe_product_url_subid_and_shorten_flag() -> None:
    converted_payload = {
        "url": (
            "https://linksredirect.com/?cid=123&subid=blog_471"
            "&url=https%3A%2F%2Fflipkart.com%2Fproduct%2Fxyz"
        )
    }
    transport = FakeTransport([(200, json.dumps(converted_payload).encode("utf-8"))])
    client = CuelinksPublisherClient("test-token", transport=transport)

    converted = client.convert_url(
        "https://flipkart.com/product/xyz?pid=abc", subid="blog_471", shorten=True
    )

    assert converted.url.startswith("https://linksredirect.com/")
    assert converted.requested_url == "https://flipkart.com/product/xyz?pid=abc"
    assert converted.subid == "blog_471"
    method, url, headers, _, _ = transport.calls[0]
    assert method == "POST"
    assert url == "https://developers.cuelinks.com/pub_api/v3/links/convert"
    assert headers["Authorization"] == "Token test-token"
    assert headers["Content-Type"] == "application/json"
    assert _body(transport.calls[0]) == {
        "url": "https://flipkart.com/product/xyz?pid=abc",
        "subid": "blog_471",
        "shorten": True,
    }


def test_convert_url_reads_documented_v3_tracking_url_and_affiliation_status() -> None:
    payload = {
        "data": {
            "tracking_url": "https://linksredirect.com/?cid=123&url=https%3A%2F%2Fflipkart.com%2Fp%2F1",
        },
        "affiliated": False,
    }
    transport = FakeTransport([(200, json.dumps(payload).encode("utf-8"))])

    converted = CuelinksPublisherClient("test-token", transport=transport).convert_url(
        "https://flipkart.com/p/1", subid="safe"
    )

    assert converted.url.startswith("https://linksredirect.com/")
    assert converted.affiliated is False


def test_default_transport_disables_redirects(monkeypatch) -> None:
    handlers = []

    class Opener:
        def open(self, *_args, **_kwargs):
            raise AssertionError("network call was not expected")

    def build_opener(*provided_handlers):
        handlers.extend(provided_handlers)
        return Opener()

    monkeypatch.setattr(urllib.request, "build_opener", build_opener)

    with pytest.raises(AssertionError, match="network call was not expected"):
        cuelinks_api._urllib_transport(
            "GET", "https://developers.cuelinks.com/ping", {}, None, 1
        )

    assert len(handlers) == 1
    assert (
        handlers[0].redirect_request(None, None, 302, "Found", {}, "https://other.example")
        is None
    )


def test_convert_url_rejects_unsafe_or_non_product_urls_before_network() -> None:
    transport = FakeTransport([])
    client = CuelinksPublisherClient("test-token", transport=transport)

    for unsafe in (
        "javascript:alert(1)",
        "http://flipkart.com/product/xyz",
        "https://clnk.in/abc",
        "https://flipkart.com/",
    ):
        with pytest.raises(ValueError, match="safe https product URL"):
            client.convert_url(unsafe, subid="safe")

    assert transport.calls == []


def test_subid_handling_hashes_pii_like_or_long_values_before_conversion() -> None:
    transport = FakeTransport([(200, b'{"data":{"short_url":"https://clnk.in/safe"}}')])
    client = CuelinksPublisherClient("test-token", transport=transport)

    converted = client.convert_url("https://flipkart.com/product/xyz", subid="user@example.com")

    assert converted.subid.startswith("h_")
    assert "example" not in converted.subid
    assert _body(transport.calls[0])["subid"] == converted.subid


def test_auth_failure_raises_redacted_error() -> None:
    transport = FakeTransport([(401, b'{"error":"bad token"}')])
    client = CuelinksPublisherClient("placeholder-secret", transport=transport)

    with pytest.raises(CuelinksPublisherAuthError) as excinfo:
        client.campaigns()

    assert "placeholder-secret" not in str(excinfo.value)
    assert "bad token" not in str(excinfo.value)


@pytest.mark.parametrize(
    "response,match",
    [
        (b"not-json", "not valid JSON"),
        (b"[]", "not a JSON object"),
        (b'{"campaigns":{"bad":"shape"}}', "did not contain a list"),
        (b'{"campaigns":[{"id":1}]}', "lacked a merchant"),
        (b'{"data":{"url":"javascript:alert(1)"}}', "lacked an https URL"),
    ],
)
def test_malformed_responses_fail_closed(response: bytes, match: str) -> None:
    transport = FakeTransport([(200, response)])
    client = CuelinksPublisherClient("test-token", transport=transport)

    with pytest.raises(CuelinksPublisherResponseError, match=match):
        if b"url" in response:
            client.convert_url("https://flipkart.com/product/xyz", subid="safe")
        else:
            client.campaigns()


def test_no_secret_logging_on_failures(caplog) -> None:
    caplog.set_level(logging.DEBUG)
    transport = FakeTransport([(500, b'{"error":"server saw unit-secret"}')])
    client = CuelinksPublisherClient("unit-secret", transport=transport)

    with pytest.raises(CuelinksPublisherResponseError) as excinfo:
        client.ping()

    assert "unit-secret" not in str(excinfo.value)
    assert "server saw" not in str(excinfo.value)
    assert "unit-secret" not in caplog.text
    assert "server saw" not in caplog.text


def test_base_url_requires_https_without_query_or_fragment() -> None:
    with pytest.raises(CuelinksPublisherConfigError):
        CuelinksPublisherClient("test-token", base_url="http://developers.cuelinks.com/pub_api/v3")
    with pytest.raises(CuelinksPublisherConfigError):
        CuelinksPublisherClient(
            "test-token", base_url="https://developers.cuelinks.com/pub_api/v3?x=1"
        )
