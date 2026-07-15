export const GRIEVANCE_CATEGORIES = [
  "Account & access",
  "Catalogue & accuracy",
  "Recommendation & AI",
  "Privacy & safety",
  "Performance & reliability",
  "Other",
] as const;

export type GrievanceCategory = (typeof GRIEVANCE_CATEGORIES)[number];
export type GrievanceDraft = {
  category: GrievanceCategory | "";
  email: string;
  message: string;
};

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function grievanceErrors(
  draft: GrievanceDraft,
): Partial<Record<keyof GrievanceDraft, string>> {
  return {
    ...(!GRIEVANCE_CATEGORIES.some((category) => category === draft.category)
      ? { category: "Choose the area that best matches your concern." }
      : {}),
    ...(!EMAIL.test(draft.email.trim()) ? { email: "Enter a valid reply email." } : {}),
    ...(!draft.message.trim() ? { message: "Describe what happened before submitting." } : {}),
  };
}

export function grievancePayload(draft: GrievanceDraft) {
  return {
    kind: "grievance" as const,
    category: draft.category as GrievanceCategory,
    message: draft.message.trim(),
    reply_email: draft.email.trim().toLowerCase(),
  };
}
