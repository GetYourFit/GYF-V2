import { describe, expect, test } from "bun:test";

import {
  mergePhotoEstimate,
  parseBudgetInput,
  validatePersonalFit,
  type AnalysisState,
  type PersonalFitProfile,
} from "./personal-fit";

const COMPLETE_PROFILE: PersonalFitProfile = {
  skin_tone: { value: "mst4", confirmed: true, source: "manual" },
  body_type: { value: "inverted_triangle", confirmed: true, source: "manual" },
  budget_range: { min: 500, max: 2500, currency: "INR" },
};

describe("personal fit", () => {
  test("accepts canonical confirmed skin-tone and body-type values", () => {
    expect(validatePersonalFit(COMPLETE_PROFILE)).toEqual({});
  });

  test("requires confirmations and canonical server values", () => {
    expect(
      validatePersonalFit({
        ...COMPLETE_PROFILE,
        skin_tone: { value: "medium", confirmed: true, source: "manual" },
        body_type: { value: "rectangle", confirmed: false, source: "photo" },
      }),
    ).toEqual({
      skin_tone: "Choose a skin tone from the available options.",
      body_type: "Confirm or edit your body type.",
    });
  });

  test("parses empty, decimal, negative, and invalid budget input", () => {
    expect(parseBudgetInput("  ")).toBeNull();
    expect(parseBudgetInput("1250.75")).toBe(1250.75);
    expect(parseBudgetInput("-1")).toBeNull();
    expect(parseBudgetInput("not a number")).toBeNull();
  });

  test("rejects a maximum budget below the minimum", () => {
    expect(
      validatePersonalFit({
        ...COMPLETE_PROFILE,
        budget_range: { min: 2500, max: 500, currency: "INR" },
      }),
    ).toEqual({ budget_max: "Maximum budget must be at least the minimum." });
  });

  test("represents partial and abstained analysis without inventing values", () => {
    const states: AnalysisState[] = ["partial", "abstained"];
    const partial = mergePhotoEstimate(
      {
        skin_tone: { value: "mst2", confirmed: false, source: "photo" },
        body_type: { value: "oval", confirmed: false, source: "photo" },
      },
      { body_type: "hourglass" },
    );
    const abstained = mergePhotoEstimate(partial, {
      skin_tone: "unknown",
      body_type: null,
    });

    expect(states).toEqual(["partial", "abstained"]);
    expect(partial).toEqual({
      skin_tone: { value: null, confirmed: false, source: "photo" },
      body_type: { value: "hourglass", confirmed: false, source: "photo" },
    });
    expect(abstained).toEqual({
      skin_tone: { value: null, confirmed: false, source: "photo" },
      body_type: { value: null, confirmed: false, source: "photo" },
    });
  });

  test("a replacement photo replaces unconfirmed estimates", () => {
    const current = {
      skin_tone: { value: "mst2", confirmed: false, source: "photo" },
      body_type: { value: "oval", confirmed: false, source: "photo" },
    } as const;

    expect(mergePhotoEstimate(current, { skin_tone: "mst8", body_type: "triangle" })).toEqual({
      skin_tone: { value: "mst8", confirmed: false, source: "photo" },
      body_type: { value: "triangle", confirmed: false, source: "photo" },
    });
    expect(current.skin_tone.value).toBe("mst2");
  });

  test("a replacement photo preserves user-confirmed values", () => {
    const current = {
      skin_tone: { value: "mst6", confirmed: true, source: "manual" },
      body_type: { value: "rectangle", confirmed: true, source: "photo" },
    } as const;
    const merged = mergePhotoEstimate(current, {
      skin_tone: "mst1",
      body_type: "triangle",
    });

    expect(merged).toEqual(current);
    expect(merged.skin_tone).toBe(current.skin_tone);
    expect(merged.body_type).toBe(current.body_type);
  });
});
