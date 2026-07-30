import type { ConsentFlags, ProfileInput } from "@gyf/types";

import { secureStorage } from "./storage";

const DRAFT_KEY = "gyf-onboarding-draft-v1";

export type PersonalFitDraft = Readonly<{
  skin_tone: string | null;
  body_type: string | null;
  budget_min: string;
  budget_max: string;
  currency: string;
}>;

export type OnboardingDraft = Readonly<{
  step: "profile" | "personal-fit";
  profile: Partial<ProfileInput>;
  consent: ConsentFlags;
  personal_fit?: PersonalFitDraft;
}>;

export type DraftStorage = Pick<typeof secureStorage, "getItem" | "setItem" | "removeItem">;

function isDraft(value: unknown): value is OnboardingDraft {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<OnboardingDraft>;
  return (
    (candidate.step === "profile" || candidate.step === "personal-fit") &&
    Boolean(candidate.profile) &&
    typeof candidate.profile === "object" &&
    Boolean(candidate.consent) &&
    typeof candidate.consent === "object"
  );
}

/** Drafts contain only editable text/choice fields. Raw photo bytes never enter this store. */
export async function loadOnboardingDraft(
  storage: DraftStorage = secureStorage,
): Promise<OnboardingDraft | null> {
  try {
    const raw = await storage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isDraft(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveOnboardingDraft(
  draft: OnboardingDraft,
  storage: DraftStorage = secureStorage,
): Promise<void> {
  try {
    await storage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // A draft improves resilience but is never a reason to block a successful server save.
  }
}

export async function clearOnboardingDraft(storage: DraftStorage = secureStorage): Promise<void> {
  try {
    await storage.removeItem(DRAFT_KEY);
  } catch {
    // Best effort only; the next successful completion overwrites stale form data.
  }
}

export async function setOnboardingDraftStep(
  step: OnboardingDraft["step"],
  storage: DraftStorage = secureStorage,
): Promise<void> {
  const current = await loadOnboardingDraft(storage);
  if (current) await saveOnboardingDraft({ ...current, step }, storage);
}

export { DRAFT_KEY };
