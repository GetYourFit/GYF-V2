import { describe, expect, it } from "bun:test";

import { splitColumns } from "./masonry-columns";

describe("splitColumns", () => {
  it("deals across columns so neighbours sit side by side", () => {
    expect(splitColumns([1, 2, 3, 4, 5, 6], 2)).toEqual([
      [1, 3, 5],
      [2, 4, 6],
    ]);
  });

  it("keeps columns within one item of each other", () => {
    const columns = splitColumns([1, 2, 3, 4, 5], 2);
    expect(Math.abs(columns[0].length - columns[1].length)).toBeLessThanOrEqual(1);
  });

  it("loses nothing and duplicates nothing", () => {
    const items = Array.from({ length: 23 }, (_, i) => i);
    expect(
      splitColumns(items, 3)
        .flat()
        .sort((a, b) => a - b),
    ).toEqual(items);
  });

  it("still returns usable columns for empty input and nonsense counts", () => {
    expect(splitColumns([], 2)).toEqual([[], []]);
    // A zero or negative column count would otherwise produce no buckets and
    // silently render nothing.
    expect(splitColumns([1, 2], 0)).toEqual([[1, 2]]);
    expect(splitColumns([1, 2], -3)).toEqual([[1, 2]]);
  });
});
