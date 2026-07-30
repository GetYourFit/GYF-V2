import type { ProfileInput } from "@gyf/types";

export const EMPTY_PROFILE: ProfileInput = {
  skin_tone: "",
  undertone: "",
  body_type: "",
  gender: "",
  style_intent: [],
  occasion: "",
  budget_range: { min: 0, max: null, currency: "INR" },
};

export const DEFAULT_CONSENT = {
  data_processing: true,
  behavioral_learning: false,
  photo_storage: false,
  marketing: false,
} as const;

const VALID_SKIN_TONES = new Set(Array.from({ length: 10 }, (_, index) => `mst${index + 1}`));
const VALID_BODY_TYPES = new Set([
  "rectangle",
  "triangle",
  "inverted_triangle",
  "hourglass",
  "oval",
]);

/** The first step is complete when the server can scope the adult catalogue honestly. */
export function hasAudienceContext(profile: ProfileInput): boolean {
  return Boolean(profile.gender?.trim());
}

/**
 * The Stylist/Explore readiness contract. Photo input is never required: these
 * values may all be entered manually, but a partial profile must not be treated as
 * complete after a refresh or a deep link.
 */
export function isOnboardingReady(profile: ProfileInput): boolean {
  const budget = profile.budget_range;
  if (!budget) return false;
  const max = budget.max ?? null;
  return (
    hasAudienceContext(profile) &&
    VALID_SKIN_TONES.has(profile.skin_tone ?? "") &&
    VALID_BODY_TYPES.has(profile.body_type ?? "") &&
    Number.isFinite(budget.min) &&
    budget.min >= 0 &&
    (max === null || (Number.isFinite(max) && max >= budget.min)) &&
    /^[A-Za-z]{3}$/.test(budget.currency.trim())
  );
}

/**
 * Sign-in routing decision: send the session to `/onboarding` only when the
 * server profile is known and incomplete. An unknown profile (fetch failure)
 * fails open — the Stylist's `isNotOnboarded` error path covers the miss.
 */
export function needsOnboarding(profile: ProfileInput | null): boolean {
  return profile !== null && !isOnboardingReady(profile);
}

export function mergeProfile(profile: Partial<ProfileInput>): ProfileInput {
  return {
    ...EMPTY_PROFILE,
    ...profile,
    style_intent: profile.style_intent ?? [],
    budget_range: profile.budget_range
      ? { ...profile.budget_range, currency: profile.budget_range.currency.trim().toUpperCase() }
      : EMPTY_PROFILE.budget_range,
  };
}
