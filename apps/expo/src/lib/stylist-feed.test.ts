import { describe, expect, test } from "bun:test";

import {
  feedbackReceipt,
  feedbackForOutfit,
  normalizedTastePercent,
  replaceOutfitItem,
  safeShopUrl,
  savedOutfitInput,
  shopFeedbackForItem,
  tastePersonalizationMessage,
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
  test("normalizes taste strength to a finite percentage", () => {
    expect(
      [-0.2, 0, 0.456, 1.2, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY].map(
        normalizedTastePercent,
      ),
    ).toEqual([0, 0, 46, 100, 0, 0, 0]);
  });

  test("does not claim consented feedback for a malformed taste signal", () => {
    expect(
      tastePersonalizationMessage(false, true, normalizedTastePercent(Number.POSITIVE_INFINITY)),
    ).toBe("Personalized from your stated profile.");
  });

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

  test("shows the next-look receipt only after save or skip", () => {
    expect(feedbackReceipt(undefined)).toBeNull();
    expect(feedbackReceipt("saved")).toMatchObject({
      accessibilityLabel: "Get the next stylist look",
      cta: "Get next look",
      message: expect.stringContaining("next slate"),
    });
    expect(feedbackReceipt("skipped")?.message).toContain("refine future looks");
  });

  test("joins shop intent to the served slate and rank", () => {
    expect(
      shopFeedbackForItem(
        {
          item_id: "top-1",
          affiliate_url: "https://shop.test/item",
          owned: false,
        } as never,
        "rec-1",
        3,
        "event-cart",
      ),
    ).toEqual({
      event_id: "event-cart",
      target_type: "item",
      target_id: "top-1",
      action: "cart",
      context: { recommendation_id: "rec-1", rank: 3 },
    });
    expect(
      shopFeedbackForItem(
        { item_id: "owned-1", affiliate_url: "https://shop.test/item", owned: true } as never,
        "rec-1",
        0,
        "event-cart",
      ),
    ).toBeNull();
  });
});
