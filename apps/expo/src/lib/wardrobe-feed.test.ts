import { describe, expect, test } from "bun:test";

import { resolveWardrobeFilter, visibleWardrobe, wardrobeCategories } from "./wardrobe-feed";

const item = (category: string, id = category) => ({
  id,
  title: id,
  category,
  slot: category,
});

describe("Expo Wardrobe filter model", () => {
  const items = [item("top"), item("footwear"), item("top", "top-2")] as never;

  test("categories are distinct and sorted", () => {
    expect(wardrobeCategories(items)).toEqual(["footwear", "top"]);
  });

  test("visible garments honour the active filter", () => {
    expect(visibleWardrobe(items, "top")).toHaveLength(2);
    expect(visibleWardrobe(items, "all")).toHaveLength(3);
  });

  test("a filter whose category vanished falls back to ALL", () => {
    expect(resolveWardrobeFilter("bottom", ["top", "footwear"])).toBe("all");
    expect(resolveWardrobeFilter("top", ["top", "footwear"])).toBe("top");
  });
});

describe("manual category correction", () => {
  const rows = [item("top", "a"), item("footwear", "b")];

  test("a corrected garment replaces its row immutably, order preserved", async () => {
    const { mergeCorrectedItem } = await import("./wardrobe-feed");
    const updated = { ...rows[0]!, category: "kurta", slot: "top" };
    const next = mergeCorrectedItem(rows as never, updated as never);
    expect(next.map((row) => row.id)).toEqual(["a", "b"]);
    expect(next[0]!.category).toBe("kurta");
    expect(rows[0]!.category).toBe("top");
  });

  test("an unknown id changes nothing", async () => {
    const { mergeCorrectedItem } = await import("./wardrobe-feed");
    const next = mergeCorrectedItem(rows as never, { ...rows[0]!, id: "ghost" } as never);
    expect(next).toEqual(rows as never);
  });
});
