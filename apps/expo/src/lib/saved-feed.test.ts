import { describe, expect, test } from "bun:test";

import { mergeSavedLists, outfitCoverImage, summariseOutfit } from "./saved-feed";

const item = (slot: string, over: Record<string, unknown> = {}) => ({
  item_id: `${slot}-1`,
  title: slot,
  category: slot,
  slot,
  owned: false,
  ...over,
});

describe("Expo Saved feed model", () => {
  test("summarises a look head-to-toe, de-duplicating repeated slots", () => {
    const items = [
      item("footwear"),
      item("top"),
      item("bottom"),
      item("top", { item_id: "top-2" }),
    ];
    expect(summariseOutfit(items as never)).toBe("Top · Bottom · Footwear");
  });

  test("cover image skips items without an image and follows slot order", () => {
    const items = [
      item("footwear", { image_url: "https://x/shoe.jpg" }),
      item("top", { image_url: null }),
      item("bottom", { image_url: "https://x/pant.jpg" }),
    ];
    // top has no image, so bottom (next in order) wins over the footwear.
    expect(outfitCoverImage(items as never)).toBe("https://x/pant.jpg");
  });

  test("each saved list degrades independently; only both-failed is an error", () => {
    const ok = <T>(value: T): PromiseSettledResult<T> => ({ status: "fulfilled", value });
    const bad = (): PromiseSettledResult<never> => ({ status: "rejected", reason: new Error("x") });

    expect(mergeSavedLists(bad(), ok([item("top")] as never))).toEqual({
      looks: [],
      items: [item("top")] as never,
    });
    expect(mergeSavedLists(bad(), bad())).toBeNull();
  });
});
