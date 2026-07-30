import { describe, expect, test } from "bun:test";

import {
  clearOnboardingDraft,
  loadOnboardingDraft,
  saveOnboardingDraft,
  setOnboardingDraftStep,
  type DraftStorage,
  type OnboardingDraft,
} from "./onboarding-draft";

function storage(): DraftStorage {
  const values = new Map<string, string>();
  return {
    getItem: async (key) => values.get(key) ?? null,
    removeItem: async (key) => {
      values.delete(key);
    },
    setItem: async (key, value) => {
      values.set(key, value);
    },
  };
}

const DRAFT: OnboardingDraft = {
  consent: { data_processing: true, behavioral_learning: false },
  personal_fit: {
    body_type: null,
    budget_max: "2500",
    budget_min: "0",
    currency: "INR",
    skin_tone: null,
  },
  profile: { gender: "women", occasion: "casual" },
  step: "personal-fit",
};

describe("onboarding draft", () => {
  test("round-trips editable fields but has no photo slot", async () => {
    const draftStorage = storage();
    await saveOnboardingDraft(DRAFT, draftStorage);
    await expect(loadOnboardingDraft(draftStorage)).resolves.toEqual(DRAFT);
    expect(JSON.stringify(DRAFT)).not.toMatch(/photo|base64|uri/i);
  });

  test("changes the resume step without changing the saved choices", async () => {
    const draftStorage = storage();
    await saveOnboardingDraft(DRAFT, draftStorage);
    await setOnboardingDraftStep("profile", draftStorage);
    await expect(loadOnboardingDraft(draftStorage)).resolves.toEqual({
      ...DRAFT,
      step: "profile",
    });
  });

  test("clear is idempotent", async () => {
    const draftStorage = storage();
    await saveOnboardingDraft(DRAFT, draftStorage);
    await clearOnboardingDraft(draftStorage);
    await clearOnboardingDraft(draftStorage);
    await expect(loadOnboardingDraft(draftStorage)).resolves.toBeNull();
  });
});
