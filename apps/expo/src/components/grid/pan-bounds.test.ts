import { describe, expect, it } from "bun:test";

import { panLimit } from "./pan-bounds";

describe("panLimit", () => {
  it("is zero when the content fits the viewport", () => {
    expect(panLimit(400, 400, 1)).toBe(0);
    expect(panLimit(400, 200, 1)).toBe(0);
  });

  it("allows dragging to each edge of overflowing content", () => {
    expect(panLimit(400, 800, 1)).toBe(200);
    expect(panLimit(400, 400, 2)).toBe(200);
  });
});
