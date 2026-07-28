import type { FeedbackRequest } from "./api";

import { safeExternalShopUrl } from "./shop-links";

/**
 * Canonical, privacy-minimal commerce event context. It joins the recommendation
 * that placed a product to the backend-owned deeplink subid and its later
 * affiliate statement. A session id is random and route-local; it is never an
 * account identifier and is not persisted by the client.
 */
export const COMMERCE_ATTRIBUTION_VERSION = 1;
export const COMMERCE_PLACEMENTS = ["stylist_outfit", "product_detail"] as const;
export type CommercePlacement = (typeof COMMERCE_PLACEMENTS)[number];

export function catalogSubid(itemId: string): string {
  return `catalog_${itemId}`;
}

export function shopClickFeedback(
  item: { affiliate_url?: string | null; item_id: string; owned?: boolean },
  {
    eventId,
    placement,
    recommendationId,
    rank,
    sessionId,
  }: {
    eventId: string;
    placement: CommercePlacement;
    recommendationId?: string;
    rank?: number;
    sessionId: string;
  },
): FeedbackRequest | null {
  if (item.owned || !safeExternalShopUrl(item.affiliate_url)) return null;
  const subid = recommendationId ?? catalogSubid(item.item_id);
  return {
    event_id: eventId,
    target_type: "item",
    target_id: item.item_id,
    action: "shop_click",
    context: {
      attribution_version: COMMERCE_ATTRIBUTION_VERSION,
      placement,
      recommendation_id: recommendationId,
      rank,
      session_id: sessionId,
      subid,
    },
  };
}
