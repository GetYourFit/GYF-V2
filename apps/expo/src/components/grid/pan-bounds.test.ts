import { describe, expect, it } from "bun:test";

import { MAX_SCALE, MIN_SCALE, panLimit, zoomByWheel } from "./pan-bounds";

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

describe("zoomByWheel", () => {
  it("zooms in on scroll up and out on scroll down", () => {
    expect(zoomByWheel(1, -100)).toBeGreaterThan(1);
    expect(zoomByWheel(1, 100)).toBeLessThan(1);
  });

  it("returns to where it started after equal travel both ways", () => {
    expect(zoomByWheel(zoomByWheel(1, -120), 120)).toBeCloseTo(1, 10);
  });

  it("never leaves the scale range", () => {
    expect(zoomByWheel(MAX_SCALE, -5000)).toBe(MAX_SCALE);
    expect(zoomByWheel(MIN_SCALE, 5000)).toBe(MIN_SCALE);
  });
});
