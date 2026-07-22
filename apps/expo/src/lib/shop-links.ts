const CUELINKS_SHORT_HOST = "clnk.in";
const DEEPLINK_HOSTS = new Set(["linksredirect.com", "www.linksredirect.com"]);
const TRACKING_HOME_QUERY_KEYS = new Set([
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
]);

export const SHOP_AFFILIATE_DISCLOSURE =
  "Affiliate disclosure: GYF may earn a commission if you buy after opening this retailer link. It never changes your price or how outfits are ranked.";

export const SHOP_AFFILIATE_DISCLOSURE_COMPACT =
  "Affiliate: GYF may earn a commission; price and ranking stay unchanged.";

function isCuelinksShortHost(host: string): boolean {
  return host === CUELINKS_SHORT_HOST || host.endsWith(`.${CUELINKS_SHORT_HOST}`);
}

function trackingOnlySearchParams(params: URLSearchParams): boolean {
  for (const key of params.keys()) {
    const normalized = key.toLowerCase();
    if (normalized.startsWith("utm_")) continue;
    if (!TRACKING_HOME_QUERY_KEYS.has(normalized)) return false;
  }
  return true;
}

function isHomepageOnly(parsed: URL): boolean {
  const path = parsed.pathname || "/";
  return path === "/" && trackingOnlySearchParams(parsed.searchParams);
}

function safeExternalShopUrlInternal(url: string | null | undefined, depth: number): string | null {
  if (!url || depth > 3) return null;
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.toLowerCase().replace(/\.$/, "");
    if (parsed.protocol !== "https:" || !host) return null;
    if (isCuelinksShortHost(host)) return null;
    if (DEEPLINK_HOSTS.has(host)) {
      const embeddedTarget = parsed.searchParams.get("url");
      return safeExternalShopUrlInternal(embeddedTarget, depth + 1) ? parsed.toString() : null;
    }
    if (isHomepageOnly(parsed)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function safeExternalShopUrl(url: string | null | undefined): string | null {
  return safeExternalShopUrlInternal(url, 0);
}

export function shopDisclosureForUrl(url: string | null | undefined): string | null {
  return safeExternalShopUrl(url) ? SHOP_AFFILIATE_DISCLOSURE : null;
}

export function compactShopDisclosureForUrl(url: string | null | undefined): string | null {
  return safeExternalShopUrl(url) ? SHOP_AFFILIATE_DISCLOSURE_COMPACT : null;
}
