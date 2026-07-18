import type { BudgetRange, ProfileInput } from "@gyf/types";

export type AnalysisState =
  | "not_requested"
  | "selected"
  | "consent_required"
  | "uploading"
  | "analysing"
  | "completed"
  | "partial"
  | "abstained"
  | "failed"
  | "removed";

export type ConfirmedField<T> = Readonly<{
  value: T | null;
  confirmed: boolean;
  source: "manual" | "photo";
}>;

type ProfileValue<Key extends keyof ProfileInput> = NonNullable<ProfileInput[Key]>;

export type PersonalFitFields = Readonly<{
  skin_tone: ConfirmedField<ProfileValue<"skin_tone">>;
  body_type: ConfirmedField<ProfileValue<"body_type">>;
}>;

export type PersonalFitProfile = PersonalFitFields &
  Readonly<{
    budget_range: BudgetRange | null;
  }>;

export type PersonalFitErrors = Partial<
  Record<"skin_tone" | "body_type" | "budget_min" | "budget_max" | "currency", string>
>;

const SKIN_TONES = new Set(Array.from({ length: 10 }, (_, index) => `mst${index + 1}`));
const BODY_TYPES = new Set(["rectangle", "triangle", "inverted_triangle", "hourglass", "oval"]);

export function parseBudgetInput(value: string): number | null {
  const input = value.trim();
  if (!/^\d+(?:\.\d+)?$/.test(input)) return null;
  const amount = Number(input);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

export function validatePersonalFit(profile: PersonalFitProfile): PersonalFitErrors {
  const errors: PersonalFitErrors = {};
  if (!profile.skin_tone.value || !SKIN_TONES.has(profile.skin_tone.value))
    errors.skin_tone = "Choose a skin tone from the available options.";
  else if (!profile.skin_tone.confirmed) errors.skin_tone = "Confirm or edit your skin tone.";

  if (!profile.body_type.value || !BODY_TYPES.has(profile.body_type.value))
    errors.body_type = "Choose a body type from the available options.";
  else if (!profile.body_type.confirmed) errors.body_type = "Confirm or edit your body type.";

  const budget = profile.budget_range;
  if (!budget) {
    errors.budget_min = "Enter a valid minimum budget.";
    errors.currency = "Choose a currency.";
  } else {
    const maximum = budget.max ?? null;
    if (!Number.isFinite(budget.min) || budget.min < 0)
      errors.budget_min = "Enter a valid minimum budget.";
    if (maximum !== null && (!Number.isFinite(maximum) || maximum < 0))
      errors.budget_max = "Enter a valid maximum budget.";
    else if (maximum !== null && maximum < budget.min)
      errors.budget_max = "Maximum budget must be at least the minimum.";
    if (!/^[A-Za-z]{3}$/.test(budget.currency.trim())) errors.currency = "Choose a currency.";
  }
  return errors;
}

export function mergePhotoEstimate(
  current: PersonalFitFields,
  estimate: Pick<ProfileInput, "skin_tone" | "body_type">,
): PersonalFitFields {
  return {
    skin_tone: mergeField(current.skin_tone, estimate.skin_tone, SKIN_TONES),
    body_type: mergeField(current.body_type, estimate.body_type, BODY_TYPES),
  };
}

function mergeField(
  current: ConfirmedField<string>,
  estimate: string | null | undefined,
  vocabulary: ReadonlySet<string>,
): ConfirmedField<string> {
  return current.confirmed
    ? current
    : {
        value: estimate && vocabulary.has(estimate) ? estimate : null,
        confirmed: false,
        source: "photo",
      };
}
