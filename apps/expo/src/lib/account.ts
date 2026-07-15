export const CONSENT_FLAGS: Array<{ key: string; title: string; description: string }> = [
  {
    key: "data_processing",
    title: "Personalized styling",
    description:
      "Let GYF process your photos and preferences to deduce body type, skin tone, and the looks that suit you. Required for photo-based onboarding.",
  },
  {
    key: "behavioral_learning",
    title: "Learn from my activity",
    description:
      "Use your saves, skips, and views to sharpen recommendations over time. Turning this off keeps styling on your stated preferences only.",
  },
  {
    key: "marketing",
    title: "Product updates",
    description: "Occasional email about new features and styling drops. Never shared.",
  },
];

/** True when any known consent flag differs between the draft and the saved state. */
export function consentDirty(
  draft: Record<string, boolean>,
  saved: Record<string, boolean>,
): boolean {
  return CONSENT_FLAGS.some((flag) => Boolean(draft[flag.key]) !== Boolean(saved[flag.key]));
}

/** Normalize a draft down to exactly the known flags as booleans — never send stray keys. */
export function consentPayload(draft: Record<string, boolean>): Record<string, boolean> {
  return Object.fromEntries(CONSENT_FLAGS.map((flag) => [flag.key, Boolean(draft[flag.key])]));
}

/** Only the literal word DELETE (trimmed) authorizes account erasure. */
export function isDeleteConfirmed(input: string): boolean {
  return input.trim() === "DELETE";
}

export function exportFilename(isoDate: string): string {
  return `gyf-data-${isoDate.slice(0, 10)}.json`;
}
