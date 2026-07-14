// F1b regression: an advertised filter must change the result — occasion/style
// set without a search query used to fall into plain browse and get dropped.
import { describe, expect, it } from "vitest";

import { isPlainBrowse } from "./explore-grid";

const EMPTY = {
  q: "",
  slot: "",
  occasion: "",
  style: "",
  maxPrice: "",
  sort: "relevance",
} as const;

describe("isPlainBrowse", () => {
  it("is true only when no filter is set", () => {
    expect(isPlainBrowse({ ...EMPTY })).toBe(true);
  });

  it("routes to search the moment any filter is set", () => {
    for (const set of [
      { q: "linen shirt" },
      { slot: "top" },
      { occasion: "wedding" },
      { style: "minimal" },
      { maxPrice: "2000" },
      { sort: "price_asc" as const },
    ]) {
      expect(isPlainBrowse({ ...EMPTY, ...set })).toBe(false);
    }
  });
});
