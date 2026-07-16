import { describe, expect, test } from "bun:test";

import { hitSlopFor, MIN_TARGET } from "./touch-target";

// Touch targets below 44pt fail WCAG 2.5.8 and Apple review. Several controls are
// deliberately smaller than MIN_TARGET for visual density and rely on this helper to pad
// the *touch* area back up. If the maths breaks, those controls silently become too small
// to hit and nothing else in the suite would notice.
describe("touch target padding", () => {
  test("pads a smaller control up to the minimum on both axes", () => {
    for (const visual of [36, 40, 42]) {
      const slop = hitSlopFor(visual);
      expect(visual + slop.top + slop.bottom).toBe(MIN_TARGET);
      expect(visual + slop.left + slop.right).toBe(MIN_TARGET);
    }
  });

  test("never shrinks a control that already meets the minimum", () => {
    for (const visual of [MIN_TARGET, 64]) {
      expect(hitSlopFor(visual)).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
    }
  });

  test("the minimum covers both platforms (44pt iOS, 48dp Android)", () => {
    expect(MIN_TARGET).toBeGreaterThanOrEqual(48);
  });
});
