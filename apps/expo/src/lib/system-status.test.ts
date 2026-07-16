import { describe, expect, test } from "bun:test";
import type { ModelRegistryStatus } from "@gyf/types";

import { capabilityLabel, capabilityUsable, modelEligibility, stateLabel } from "./system-status";

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

  // A surface that asks for the user's face must not open on a missing key, an unknown
  // status, or a status GYF could not read. Only an explicit live/beta opens it.
  test("capability use fails closed on anything but an explicit live or beta", () => {
    const withStatus = (status: string) =>
      ({ capabilities: { profile_avatar: { status } } }) as never;
    expect(capabilityUsable(withStatus("live"), "profile_avatar")).toBe(true);
    expect(capabilityUsable(withStatus("beta"), "profile_avatar")).toBe(true);
    for (const status of ["degraded", "planned", "shadow", "", "LIVE", "unknown"]) {
      expect(capabilityUsable(withStatus(status), "profile_avatar")).toBe(false);
    }
    expect(capabilityUsable(null, "profile_avatar")).toBe(false);
    expect(capabilityUsable(undefined, "profile_avatar")).toBe(false);
    expect(capabilityUsable({ capabilities: {} } as never, "profile_avatar")).toBe(false);
    expect(capabilityUsable(withStatus("live"), "missing_key")).toBe(false);
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
