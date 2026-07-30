import { describe, expect, test } from "bun:test";

import { isReviewSurfaceEnabled } from "./review-surface";

describe("review surface release gate", () => {
  test("allows local development and explicit non-production review", () => {
    expect(isReviewSurfaceEnabled({ nodeEnv: "development", dev: true, optIn: undefined })).toBe(
      true,
    );
    expect(isReviewSurfaceEnabled({ nodeEnv: "staging", dev: false, optIn: "true" })).toBe(true);
  });

  test("rejects review fixtures in production, including an accidental opt-in", () => {
    expect(isReviewSurfaceEnabled({ nodeEnv: "production", dev: true, optIn: "true" })).toBe(false);
  });
});
