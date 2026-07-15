import { describe, expect, test } from "bun:test";
import type { ModelRegistryStatus } from "@gyf/types";

import { capabilityLabel, modelEligibility, stateLabel } from "./system-status";

const MODEL: ModelRegistryStatus["models"][number] = {
  name: "siglip",
  capability: "encoder",
  provider: "local",
  lane: "production",
  license: "Apache-2.0",
  promotable: true,
  runtime_servable: false,
  blockers: ["evaluation missing"],
  runtime_blockers: ["identity mismatch"],
  eval_report: null,
  model_version: null,
};

describe("Expo system-status presentation", () => {
  test("uses product labels while safely humanizing new capabilities", () => {
    expect(capabilityLabel("virtual_try_on")).toBe("Virtual try-on");
    expect(capabilityLabel("future_signal")).toBe("future signal");
  });

  test("keeps every runtime state explicit", () => {
    const states = ["live", "beta", "shadow", "degraded", "planned"] as const;
    expect(states.map(stateLabel)).toEqual(["LIVE", "BETA", "SHADOW", "DEGRADED", "PLANNED"]);
  });

  test("calls policy eligibility blocked without claiming serving state", () => {
    expect(modelEligibility(MODEL)).toEqual({
      label: "BLOCKED",
      blockers: ["evaluation missing", "identity mismatch"],
    });
    expect(modelEligibility({ ...MODEL, runtime_servable: true }).label).toBe("ELIGIBLE");
    expect(modelEligibility({ ...MODEL, runtime_servable: null }).label).toBe("NOT CHECKED");
  });
});
