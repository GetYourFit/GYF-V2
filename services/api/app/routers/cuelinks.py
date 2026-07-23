"""Cuelinks API — campaign registry and link conversion endpoints.

Cuelinks is an Indian affiliate network that wraps product URLs into tracked
deeplinks (linksredirect.com) carrying a subid so each conversion attributes
back to the GYF surface that drove it. This router exposes:

1. Campaign registry (read-only): which merchants support product-level
   deeplinks, their status, and eligibility for catalogue ingestion.
2. Link conversion: wrap a retailer product URL into a Cuelinks deeplink with
   a caller-provided subid, returning None when the URL is not a product page
   or the campaign doesn't allow deeplinks.

All endpoints are read-only and require authentication — campaign data and
affiliate attribution are commercial configuration. Unauthenticated clients
receive a 401.
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from ..affiliate import CuelinksLinker
from ..auth import Principal, get_current_principal
from ..catalog.cuelinks import (
    CuelinksCampaignRegistry,
    load_cuelinks_campaigns,
)
from ..config import settings

router = APIRouter(prefix="/cuelinks", tags=["cuelinks"])

# ─── Campaign registry (loaded once from configured CSV) ────────────────────

_campaign_registry: CuelinksCampaignRegistry | None = None


def get_campaign_registry() -> CuelinksCampaignRegistry:
    """Load the Cuelinks campaign export from the configured path.

    The export must include a `Deeplink` column with Yes/No. Missing config
    returns an empty registry (endpoints return empty lists) rather than
    crashing — the ingestion pipeline has its own strict blocker.
    """
    global _campaign_registry
    if _campaign_registry is not None:
        return _campaign_registry

    path = settings.cuelinks_campaigns_path.strip()
    if not path:
        _campaign_registry = CuelinksCampaignRegistry([])
        return _campaign_registry

    try:
        _campaign_registry = load_cuelinks_campaigns(Path(path))
    except Exception as exc:  # noqa: BLE001 — never 500 on config issues
        # Log and return empty registry; ingestion has its own hard blocker.
        import logging
        logging.getLogger("gyf.cuelinks.api").warning(
            "Failed to load Cuelinks campaigns from %s: %s", path, exc
        )
        _campaign_registry = CuelinksCampaignRegistry([])
    return _campaign_registry


# ─── Response models ──────────────────────────────────────────────────────


class CampaignResponse(BaseModel):
    """One Cuelinks merchant/campaign capability row."""

    merchant_name: str
    campaign_id: Optional[str] = None
    domain: Optional[str] = None
    country: str
    vertical: str
    status: str
    deeplink_enabled: bool
    home_url: Optional[str] = None
    is_active: bool
    is_indian_fashion: bool
    product_deeplink_allowed: bool
    merchant_key: str


class LinkConversionRequest(BaseModel):
    """Request to wrap a product URL into a Cuelinks affiliate deeplink."""

    url: str = Field(..., description="Retailer product URL to wrap")
    subid: str = Field(
        ...,
        description="Attribution subid (e.g. recommendation_id or catalog_<item_id>)",
        min_length=1,
        max_length=64,
    )


class LinkConversionResponse(BaseModel):
    """Result of a link conversion request."""

    affiliate_url: Optional[str] = Field(
        None,
        description="Cuelinks deeplink with subid, or None if URL/campaign ineligible",
    )
    campaign_id: Optional[str] = Field(
        None, description="Campaign ID that would be used for attribution"
    )
    merchant_name: Optional[str] = Field(
        None, description="Merchant name resolved from the URL"
    )
    deeplink_allowed: bool = Field(
        False, description="Whether the campaign permits product-level deeplinks"
    )


class EligibleCampaignResponse(BaseModel):
    """Campaign eligible for product catalogue ingestion."""

    merchant_name: str
    campaign_id: Optional[str] = None
    domain: Optional[str] = None
    country: str
    vertical: str
    status: str
    merchant_key: str


# ─── Endpoints ──────────────────────────────────────────────────────────────


@router.get(
    "/campaigns",
    response_model=list[CampaignResponse],
    summary="List all Cuelinks campaigns from the loaded export",
)
def list_campaigns(
    principal: Principal = Depends(get_current_principal),
    registry: CuelinksCampaignRegistry = Depends(get_campaign_registry),
) -> list[CampaignResponse]:
    """Return every campaign row from the Cuelinks export (active and inactive).

    Requires authentication. Returns an empty list when no campaign export
    is configured (GYF_CUELINKS_CAMPAIGNS_PATH not set).
    """
    campaigns = registry.campaigns
    return [
        CampaignResponse(
            merchant_name=c.merchant_name,
            campaign_id=c.campaign_id,
            domain=c.domain,
            country=c.country,
            vertical=c.vertical,
            status=c.status,
            deeplink_enabled=c.deeplink_enabled,
            home_url=c.home_url,
            is_active=c.is_active,
            is_indian_fashion=c.is_indian_fashion,
            product_deeplink_allowed=c.product_deeplink_allowed,
            merchant_key=c.merchant_key,
        )
        for c in campaigns
    ]


@router.get(
    "/campaigns/eligible",
    response_model=list[EligibleCampaignResponse],
    summary="List campaigns eligible for product catalogue ingestion",
)
def list_eligible_campaigns(
    principal: Principal = Depends(get_current_principal),
    registry: CuelinksCampaignRegistry = Depends(get_campaign_registry),
) -> list[EligibleCampaignResponse]:
    """Return only campaigns where product-level deeplinking is allowed.

    Eligibility requires: Deeplink=Yes, Active status, and Indian Fashion vertical.
    These are the campaigns the ingestion pipeline will import product rows for.
    """
    eligible = registry.eligible_campaigns()
    return [
        EligibleCampaignResponse(
            merchant_name=c.merchant_name,
            campaign_id=c.campaign_id,
            domain=c.domain,
            country=c.country,
            vertical=c.vertical,
            status=c.status,
            merchant_key=c.merchant_key,
        )
        for c in eligible
    ]


@router.get(
    "/campaigns/{merchant_key}",
    response_model=CampaignResponse,
    summary="Get a single campaign by merchant key (slugified merchant name)",
)
def get_campaign(
    merchant_key: str,
    principal: Principal = Depends(get_current_principal),
    registry: CuelinksCampaignRegistry = Depends(get_campaign_registry),
) -> CampaignResponse:
    """Look up a campaign by its slugified merchant name.

    The merchant key is the merchant name lowercased, non-alphanumerics
    replaced with hyphens (e.g., "Columbia Sportswear India" → "columbia-sportswear-india").
    """
    campaign = registry.resolve(merchant_name=merchant_key)
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return CampaignResponse(
        merchant_name=campaign.merchant_name,
        campaign_id=campaign.campaign_id,
        domain=campaign.domain,
        country=campaign.country,
        vertical=campaign.vertical,
        status=campaign.status,
        deeplink_enabled=campaign.deeplink_enabled,
        home_url=campaign.home_url,
        is_active=campaign.is_active,
        is_indian_fashion=campaign.is_indian_fashion,
        product_deeplink_allowed=campaign.product_deeplink_allowed,
        merchant_key=campaign.merchant_key,
    )


@router.post(
    "/links/convert",
    response_model=LinkConversionResponse,
    summary="Convert a retailer product URL into a Cuelinks affiliate deeplink",
)
def convert_link(
    request: LinkConversionRequest,
    principal: Principal = Depends(get_current_principal),
    registry: CuelinksCampaignRegistry = Depends(get_campaign_registry),
) -> LinkConversionResponse:
    """Wrap a product URL into a Cuelinks deeplink with the provided subid.

    The endpoint resolves the merchant from the URL's domain, checks that the
    campaign allows product-level deeplinks, and returns the wrapped URL.
    Returns `affiliate_url: null` with `deeplink_allowed: false` when:
    - The URL is not a valid product page (homepage, shortlink, unsafe scheme)
    - No matching campaign is found
    - The campaign has Deeplink=No, is inactive, or is not Indian fashion

    This is the same wrapping logic used at serve time by the catalogue and
    recommendation surfaces — idempotent and safe to call repeatedly.
    """
    # Validate and extract the product URL (rejects homepages, shortlinks, etc.)
    from ..affiliate import product_serving_url

    product_url = product_serving_url(request.url)
    if product_url is None:
        return LinkConversionResponse(
            affiliate_url=None,
            deeplink_allowed=False,
        )

    # Resolve campaign from the product URL's domain
    from urllib.parse import urlparse

    domain = (urlparse(product_url).hostname or "").lower().rstrip(".")
    campaign = registry.resolve(domain=domain)

    if campaign is None:
        return LinkConversionResponse(
            affiliate_url=None,
            deeplink_allowed=False,
        )

    # Check if campaign permits product deeplinks
    if not campaign.product_deeplink_allowed:
        return LinkConversionResponse(
            affiliate_url=None,
            campaign_id=campaign.campaign_id,
            merchant_name=campaign.merchant_name,
            deeplink_allowed=False,
        )

    # Wrap with the configured Cuelinks channel ID
    cid = settings.cuelinks_cid.strip()
    if not cid:
        return LinkConversionResponse(
            affiliate_url=None,
            campaign_id=campaign.campaign_id,
            merchant_name=campaign.merchant_name,
            deeplink_allowed=True,
        )

    linker = CuelinksLinker(cid)
    affiliate_url = linker.wrap(product_url, request.subid)

    return LinkConversionResponse(
        affiliate_url=affiliate_url,
        campaign_id=campaign.campaign_id,
        merchant_name=campaign.merchant_name,
        deeplink_allowed=True,
    )


@router.get(
    "/links/preview",
    response_model=LinkConversionResponse,
    summary="Preview link conversion without authentication (for client-side preview)",
)
def preview_link_conversion(
    url: str = Query(..., description="Retailer product URL to preview"),
    subid: str = Query("preview", description="Subid to use in the preview link"),
    registry: CuelinksCampaignRegistry = Depends(get_campaign_registry),
) -> LinkConversionResponse:
    """Preview a link conversion without requiring authentication.

    Uses a fixed 'preview' subid by default. Useful for client-side
    "copy link" previews. Rate-limited by the global API rate limiter.
    """
    from ..affiliate import product_serving_url
    from urllib.parse import urlparse

    product_url = product_serving_url(url)
    if product_url is None:
        return LinkConversionResponse(affiliate_url=None, deeplink_allowed=False)

    domain = (urlparse(product_url).hostname or "").lower().rstrip(".")
    campaign = registry.resolve(domain=domain)

    if campaign is None or not campaign.product_deeplink_allowed:
        return LinkConversionResponse(
            affiliate_url=None,
            campaign_id=campaign.campaign_id if campaign else None,
            merchant_name=campaign.merchant_name if campaign else None,
            deeplink_allowed=False,
        )

    cid = settings.cuelinks_cid.strip()
    if not cid:
        return LinkConversionResponse(
            affiliate_url=None,
            campaign_id=campaign.campaign_id,
            merchant_name=campaign.merchant_name,
            deeplink_allowed=True,
        )

    linker = CuelinksLinker(cid)
    affiliate_url = linker.wrap(product_url, subid)

    return LinkConversionResponse(
        affiliate_url=affiliate_url,
        campaign_id=campaign.campaign_id,
        merchant_name=campaign.merchant_name,
        deeplink_allowed=True,
    )