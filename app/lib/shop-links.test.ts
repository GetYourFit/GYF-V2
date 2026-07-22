import { describe, expect, it } from "vitest";

import {
  SHOP_AFFILIATE_DISCLOSURE,
  SHOP_AFFILIATE_DISCLOSURE_COMPACT,
  compactShopDisclosureForUrl,
  safeExternalShopUrl,
  shopDisclosureForUrl,
} from "./shop-links";

describe("shop links", () => {
  it("discloses commission before a user-facing retailer action", () => {
    expect(SHOP_AFFILIATE_DISCLOSURE).toContain("may earn a commission");
    expect(SHOP_AFFILIATE_DISCLOSURE).toContain("never changes your price");
    expect(SHOP_AFFILIATE_DISCLOSURE).toContain("how outfits are ranked");
    expect(shopDisclosureForUrl("https://shop.test/item")).toBe(SHOP_AFFILIATE_DISCLOSURE);
    expect(compactShopDisclosureForUrl("https://shop.test/item")).toBe(
      SHOP_AFFILIATE_DISCLOSURE_COMPACT,
    );
    expect(compactShopDisclosureForUrl("javascript:alert(1)")).toBeNull();
  });

  it("opens only product-serving HTTPS links", () => {
    expect(safeExternalShopUrl("https://shop.test/item")).toBe("https://shop.test/item");
    expect(safeExternalShopUrl("javascript:alert(1)")).toBeNull();
    expect(safeExternalShopUrl("https://clnk.in/BKo4")).toBeNull();
    expect(safeExternalShopUrl("https://ajo.clnk.in/BKo6")).toBeNull();
    expect(
      safeExternalShopUrl(
        "https://linksredirect.com/?cid=274785&source=linkkit&url=https%3A%2F%2Fwww.adidas.com.hk%2F",
      ),
    ).toBeNull();
    expect(
      safeExternalShopUrl(
        "https://ajiogram.ajio.com/?utm_source=cuelinks&utm_medium=affiliate&utm_campaign=cuelinks_274785&utm_term=abc&clickid=click&pid=19&offer_id=18&sub1=cuelinks_274785&sub3=abc&attribution_window=1D&return_cancellation_window=45D",
      ),
    ).toBeNull();
    expect(
      safeExternalShopUrl(
        "https://linksredirect.com/?cid=274785&source=api&subid=catalog&url=https%3A%2F%2Fwww.thehouseofrare.com%2Fproducts%2Ffullsleen-mens-shirt-beige",
      ),
    ).toBe(
      "https://linksredirect.com/?cid=274785&source=api&subid=catalog&url=https%3A%2F%2Fwww.thehouseofrare.com%2Fproducts%2Ffullsleen-mens-shirt-beige",
    );
  });
});
