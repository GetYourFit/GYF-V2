export const SHOP_AFFILIATE_DISCLOSURE =
  "Affiliate disclosure: GYF may earn a commission if you buy after opening this retailer " +
  "link. It never changes your price or how outfits are ranked.";

export function safeExternalShopUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function shopDisclosureForUrl(url: string | null | undefined): string | null {
  return safeExternalShopUrl(url) ? SHOP_AFFILIATE_DISCLOSURE : null;
}
