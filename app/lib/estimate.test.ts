import { describe, expect, it } from "vitest";

import { mergeEstimated } from "./estimate";
import type { Profile } from "@gyf/types";

function profile(overrides: Partial<Profile>): Profile {
  return { source: "photo", ...overrides } as Profile;
}

describe("mergeEstimated", () => {
  it("applies every field the photo module produced a valid value for", () => {
    const { patch, applied, missing } = mergeEstimated(
      profile({ skin_tone: "mst5", undertone: "warm", body_type: "hourglass" }),
    );
    expect(patch).toMatchObject({ skin_tone: "mst5", undertone: "warm", body_type: "hourglass" });
    expect(applied).toEqual(["skin tone", "undertone", "body type"]);
    expect(missing).toEqual([]);
  });

  it("reports a field as missing when the module abstained (absent value)", () => {
    const { patch, applied, missing } = mergeEstimated(profile({ skin_tone: "mst5" }));
    expect(patch.body_type).toBeUndefined();
    expect(applied).toEqual(["skin tone"]);
    expect(missing).toEqual(["undertone", "body_type"]);
  });

  it("reports a field as missing when the value is outside the display vocab", () => {
    // e.g. an "unknown" sentinel from a zero-confidence guess.
    const { applied, missing } = mergeEstimated(
      profile({ skin_tone: "mst5", body_type: "unknown" }),
    );
    expect(applied).toEqual(["skin tone"]);
    expect(missing).toContain("body_type");
  });

  it("adopts measurements whenever the body module produced any", () => {
    const { patch } = mergeEstimated(profile({ measurements: { shoulder_hip_ratio: 1.1 } }));
    expect(patch.measurements).toEqual({ shoulder_hip_ratio: 1.1 });
  });
});
