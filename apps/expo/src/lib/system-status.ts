import type { ModelRegistryStatus, SystemStatus } from "@gyf/types";

export const CAPABILITY_LABELS: Record<string, string> = {
  outfit_recommendations: "Outfit recommendations",
  text_search: "Catalogue text search",
  photo_body_type: "Photo onboarding — body type",
  photo_skin_tone: "Photo onboarding — skin tone",
  virtual_try_on: "Virtual try-on",
  affiliate_commerce: "Shopping & affiliate links",
};

type Capability = SystemStatus["capabilities"][string];

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
