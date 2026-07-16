import { describe, expect, it } from "bun:test";

import { collectionView } from "./collection-state";

const items = ["a", "b", "c", "d", "e", "f"];

describe("collectionView", () => {
  it("collapsed shows the preview and counts the rest", () => {
    const view = collectionView(items, false, 4);
    expect(view.visible).toEqual(["a", "b", "c", "d"]);
    expect(view.hiddenCount).toBe(2);
    expect(view.revealFrom).toBe(-1);
  });

  it("expanded shows everything and staggers only the newly revealed", () => {
    const view = collectionView(items, true, 4);
    expect(view.visible).toEqual(items);
    expect(view.hiddenCount).toBe(0);
    expect(view.revealFrom).toBe(4);
  });

  it("handles fewer items than the preview", () => {
    const view = collectionView(["a"], false, 4);
    expect(view.visible).toEqual(["a"]);
    expect(view.hiddenCount).toBe(0);
  });

  it("clamps a negative preview count", () => {
    expect(collectionView(items, false, -2).visible).toEqual([]);
  });
});
