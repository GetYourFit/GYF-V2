import { describe, expect, it } from "bun:test";

import { DEFAULT_RATIO, MAX_RATIO, MIN_RATIO, frameRatio } from "./catalog-frame";

describe("frameRatio", () => {
  it("takes the source's own shape when it is reasonable", () => {
    expect(frameRatio(1000, 1200)).toBeCloseTo(1.2, 5);
    expect(frameRatio(800, 800)).toBeCloseTo(1, 5);
  });

  it("clamps a very tall lookbook crop so one card cannot dwarf the row", () => {
    expect(frameRatio(400, 4000)).toBe(MAX_RATIO);
  });

  it("clamps a very wide banner so it still reads as a garment plate", () => {
    expect(frameRatio(4000, 400)).toBe(MIN_RATIO);
  });

  it("falls back rather than dividing by a missing or broken size", () => {
    // expo-image reports nothing until load, and some feeds report zeroes.
    expect(frameRatio(undefined, undefined)).toBe(DEFAULT_RATIO);
    expect(frameRatio(null, null)).toBe(DEFAULT_RATIO);
    expect(frameRatio(0, 500)).toBe(DEFAULT_RATIO);
    expect(frameRatio(500, 0)).toBe(DEFAULT_RATIO);
    expect(frameRatio(-10, 500)).toBe(DEFAULT_RATIO);
    expect(frameRatio(Number.NaN, 500)).toBe(DEFAULT_RATIO);
  });
});
