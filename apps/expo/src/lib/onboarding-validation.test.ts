import { describe, expect, test } from "bun:test";

import {
  DEFAULT_CONSENT,
  EMPTY_PROFILE,
  isOnboardingReady,
  mergeProfile,
  needsOnboarding,
} from "./onboarding-validation";

describe("onboarding validation", () => {
  test("requires the complete manual readiness contract, not only gender", () => {
    expect(isOnboardingReady(EMPTY_PROFILE)).toBe(false);
    expect(isOnboardingReady({ ...EMPTY_PROFILE, gender: "unisex" })).toBe(false);
    expect(
      isOnboardingReady({
        ...EMPTY_PROFILE,
        body_type: "rectangle",
        gender: "unisex",
        skin_tone: "mst4",
      }),
    ).toBe(true);
  });
  test("merges saved profile data without dropping defaults", () => {
    expect(mergeProfile({ gender: "women" }).budget_range).toEqual({
      min: 0,
      max: null,
      currency: "INR",
    });
  });
  test("normalizes currency without converting source amounts", () => {
    expect(
      mergeProfile({ budget_range: { min: 12.5, max: 99.95, currency: " usd " } }).budget_range,
    ).toEqual({ min: 12.5, max: 99.95, currency: "USD" });
  });
  test("routes unonboarded profiles to onboarding, fails open when profile is unknown", () => {
    expect(needsOnboarding(EMPTY_PROFILE)).toBe(true);
    expect(needsOnboarding({ ...EMPTY_PROFILE, gender: "men" })).toBe(true);
    expect(
      needsOnboarding({
        ...EMPTY_PROFILE,
        body_type: "rectangle",
        gender: "men",
        skin_tone: "mst4",
      }),
    ).toBe(false);
    // Fetch failure must not trap a working session behind onboarding; the
    // Stylist's isNotOnboarded error path already covers the miss honestly.
    expect(needsOnboarding(null)).toBe(false);
  });
  test("requires processing consent and starts optional flags off", () => {
    expect(DEFAULT_CONSENT).toEqual({
      data_processing: true,
      behavioral_learning: false,
      photo_storage: false,
      marketing: false,
    });
  });
});
