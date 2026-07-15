import { describe, expect, test } from "bun:test";

import {
  DEFAULT_CONSENT,
  EMPTY_PROFILE,
  isOnboardingReady,
  mergeProfile,
} from "./onboarding-validation";

describe("onboarding validation", () => {
  test("requires an explicit catalogue gender slice", () => {
    expect(isOnboardingReady(EMPTY_PROFILE)).toBe(false);
    expect(isOnboardingReady({ ...EMPTY_PROFILE, gender: "unisex" })).toBe(true);
  });
  test("merges saved profile data without dropping defaults", () => {
    expect(mergeProfile({ gender: "women" }).budget_range).toEqual({
      min: 0,
      max: null,
      currency: "USD",
    });
  });
  test("requires processing consent and starts optional flags off", () => {
    expect(DEFAULT_CONSENT).toEqual({
      data_processing: true,
      personalization: false,
      photo_storage: false,
      marketing: false,
    });
  });
});
