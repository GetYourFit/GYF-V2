import type { ModelRegistryStatus, SystemStatus } from "@gyf/types";

export const CAPABILITY_LABELS: Record<string, string> = {
  outfit_recommendations: "Outfit recommendations",
  text_search: "Catalogue text search",
  photo_body_type: "Photo onboarding — body type",
  photo_skin_tone: "Photo onboarding — skin tone",
  virtual_try_on: "Virtual try-on",
  profile_avatar: "Profile picture",
  affiliate_commerce: "Shopping & affiliate links",
};

type Capability = SystemStatus["capabilities"][string];

const USABLE = new Set(["live", "beta"]);

/**
 * Whether a `/system/status` capability is usable, failing **closed** on anything
 * unexpected — a missing key, an unknown status, or a status GYF could not read.
 *
 * Failing open is right when a capability's absence just means "fall back to the manual
 * path". It is wrong wherever the UI would otherwise ask for something sensitive it may
 * not be able to honour: for `profile_avatar` the ask is a photo of the user's face, and
 * GYF only offers it when it can also prove it can erase it. A status blip must never be
 * the reason GYF solicits one. Same rule as the F8 try-on surface.
 */
export function capabilityUsable(status: SystemStatus | null | undefined, key: string): boolean {
  return USABLE.has(status?.capabilities?.[key]?.status ?? "");
}

export function capabilityLabel(key: string): string {
  return CAPABILITY_LABELS[key] ?? key.replaceAll("_", " ");
}

export function stateLabel(status: Capability["status"]): string {
  return {
    live: "LIVE",
    beta: "BETA",
    shadow: "SHADOW",
    degraded: "DEGRADED",
    planned: "PLANNED",
  }[status];
}

export function modelEligibility(model: ModelRegistryStatus["models"][number]): {
  label: string;
  blockers: string[];
} {
  return {
    label:
      model.runtime_servable == null
        ? "NOT CHECKED"
        : model.runtime_servable
          ? "ELIGIBLE"
          : "BLOCKED",
    blockers: [...model.blockers, ...model.runtime_blockers],
  };
}
