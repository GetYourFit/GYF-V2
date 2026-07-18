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
