import type { ConsentFlags, ProfileInput } from "@gyf/types";

import { secureStorage } from "./storage";

const DRAFT_KEY = "gyf-onboarding-draft-v1";
const pendingOperations = new WeakMap<DraftStorage, Map<string, Promise<void>>>();

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

function draftKey(accountId: string): string {
  if (!accountId) throw new Error("An authenticated account is required for onboarding drafts.");
  return `${DRAFT_KEY}:${encodeURIComponent(accountId)}`;
}

function operationsFor(storage: DraftStorage): Map<string, Promise<void>> {
  const existing = pendingOperations.get(storage);
  if (existing) return existing;
  const operations = new Map<string, Promise<void>>();
  pendingOperations.set(storage, operations);
  return operations;
}

function enqueue(storage: DraftStorage, key: string, operation: () => Promise<void>): Promise<void> {
  const operations = operationsFor(storage);
  const pending = operations.get(key) ?? Promise.resolve();
  const next = pending.catch(() => undefined).then(operation);
  operations.set(key, next);
  void next.finally(() => {
    if (operations.get(key) === next) operations.delete(key);
  });
  return next;
}

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
  accountId: string,
  storage: DraftStorage = secureStorage,
): Promise<OnboardingDraft | null> {
  try {
    const key = draftKey(accountId);
    await operationsFor(storage).get(key);
    const raw = await storage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isDraft(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveOnboardingDraft(
  accountId: string,
  draft: OnboardingDraft,
  storage: DraftStorage = secureStorage,
): Promise<void> {
  const key = draftKey(accountId);
  await enqueue(storage, key, async () => {
    try {
      await storage.setItem(key, JSON.stringify(draft));
    } catch {
      // A draft improves resilience but is never a reason to block a successful server save.
    }
  });
}

export async function clearOnboardingDraft(
  accountId: string | null,
  storage: DraftStorage = secureStorage,
): Promise<void> {
  const keys = accountId ? [draftKey(accountId), DRAFT_KEY] : [DRAFT_KEY];
  await Promise.all(
    keys.map((key) =>
      enqueue(storage, key, async () => {
        try {
          await storage.removeItem(key);
        } catch {
          // Best effort only; a later clear can safely retry.
        }
      }),
    ),
  );
}

export async function setOnboardingDraftStep(
  accountId: string,
  step: OnboardingDraft["step"],
  storage: DraftStorage = secureStorage,
): Promise<void> {
  const current = await loadOnboardingDraft(accountId, storage);
  if (current) await saveOnboardingDraft(accountId, { ...current, step }, storage);
}

export { DRAFT_KEY };
