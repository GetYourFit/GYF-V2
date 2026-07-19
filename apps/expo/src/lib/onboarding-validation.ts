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
  personalization: false,
  photo_storage: false,
  marketing: false,
} as const;

export function isOnboardingReady(profile: ProfileInput): boolean {
  return Boolean(profile.gender?.trim());
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
