import { describe, expect, test } from "bun:test";

import {
  feedbackForOutfit,
  replaceOutfitItem,
  safeShopUrl,
  savedOutfitInput,
} from "./stylist-feed";

const outfit = {
  items: [
    { item_id: "top-1", title: "Linen shirt", category: "shirt", slot: "top", owned: false },
    {
      item_id: "shoe-1",
      title: "Canvas sneakers",
      category: "shoes",
      slot: "footwear",
      owned: true,
    },
  ],
  explanation: "A breathable, easy weekend combination.",
  score: 0.81,
  confidence: 0.74,
  color_harmony: 0.8,
  formality_fit: 0.7,
};

describe("Expo stylist feed model", () => {
  test("attributes one learning event to every garment in a look", () => {
    expect(feedbackForOutfit(outfit, "rec-1", "skip", 2, ["event-top", "event-shoe"])).toEqual([
      {
        event_id: "event-top",
        target_type: "item",
        target_id: "top-1",
        action: "skip",
        context: { recommendation_id: "rec-1", rank: 2 },
      },
      {
        event_id: "event-shoe",
        target_type: "item",
        target_id: "shoe-1",
        action: "skip",
        context: { recommendation_id: "rec-1", rank: 2 },
      },
    ]);
  });

  test("saves a server-compatible snapshot for a whole look", () => {
    expect(savedOutfitInput(outfit, "rec-1", "casual", 0)).toMatchObject({
      outfit_key: "rec-1:0",
      item_ids: ["top-1", "shoe-1"],
      recommendation_id: "rec-1",
      occasion: "casual",
      confidence: 0.74,
    });
  });

  test("swaps exactly the corrected garment without mutating the source look", () => {
    const alternate = {
      item_id: "top-2",
      title: "Oxford shirt",
      category: "shirt",
      slot: "top",
      owned: false,
    } as never;
    const updated = replaceOutfitItem(outfit, "top-1", alternate);
    expect(updated.items.map((item) => item.item_id)).toEqual(["top-2", "shoe-1"]);
    expect(outfit.items[0].item_id).toBe("top-1");
  });

  test("opens only non-owned HTTPS retailer destinations", () => {
    expect(
      safeShopUrl({ owned: false, affiliate_url: "https://shop.test/item", item_id: "1" } as never),
    ).toBe("https://shop.test/item");
    expect(
      safeShopUrl({ owned: true, affiliate_url: "https://shop.test/item", item_id: "1" } as never),
    ).toBeNull();
    expect(
      safeShopUrl({ owned: false, affiliate_url: "javascript:alert(1)", item_id: "1" } as never),
    ).toBeNull();
  });
});
