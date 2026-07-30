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
    await saveOnboardingDraft("account-a", DRAFT, draftStorage);
    await expect(loadOnboardingDraft("account-a", draftStorage)).resolves.toEqual(DRAFT);
    expect(JSON.stringify(DRAFT)).not.toMatch(/photo|base64|uri/i);
  });

  test("changes the resume step without changing the saved choices", async () => {
    const draftStorage = storage();
    await saveOnboardingDraft("account-a", DRAFT, draftStorage);
    await setOnboardingDraftStep("account-a", "profile", draftStorage);
    await expect(loadOnboardingDraft("account-a", draftStorage)).resolves.toEqual({
      ...DRAFT,
      step: "profile",
    });
  });

  test("clear is idempotent", async () => {
    const draftStorage = storage();
    await saveOnboardingDraft("account-a", DRAFT, draftStorage);
    await clearOnboardingDraft("account-a", draftStorage);
    await clearOnboardingDraft("account-a", draftStorage);
    await expect(loadOnboardingDraft("account-a", draftStorage)).resolves.toBeNull();
  });

  test("isolates drafts by authenticated account", async () => {
    const draftStorage = storage();
    await saveOnboardingDraft("account-a", DRAFT, draftStorage);
    await expect(loadOnboardingDraft("account-b", draftStorage)).resolves.toBeNull();
  });

  test("a queued save cannot recreate a cleared draft", async () => {
    const values = new Map<string, string>();
    let releaseSave = () => {};
    const saveBlocked = new Promise<void>((resolve) => {
      releaseSave = resolve;
    });
    const draftStorage: DraftStorage = {
      getItem: async (key) => values.get(key) ?? null,
      removeItem: async (key) => {
        values.delete(key);
      },
      setItem: async (key, value) => {
        await saveBlocked;
        values.set(key, value);
      },
    };
    const saving = saveOnboardingDraft("account-a", DRAFT, draftStorage);
    const clearing = clearOnboardingDraft("account-a", draftStorage);
    releaseSave();
    await Promise.all([saving, clearing]);
    await expect(loadOnboardingDraft("account-a", draftStorage)).resolves.toBeNull();
  });
});
