/**
 * Display vocabularies. The *values* mirror the controlled vocabularies in
 * `packages/contracts/gyf_contracts/usermodel.py` and `taxonomy.py` (the API's
 * source of truth, which coerces unknowns to sentinels rather than rejecting);
 * the *labels* are presentation the API does not carry.
 *
 * One copy per client. Onboarding, Stylist and Explore all read from here so a
 * contract change lands in one file instead of drifting across three screens.
 */

export interface VocabOption {
  value: string;
  label: string;
}

/** `usermodel.py::OCCASIONS`. */
export const OCCASIONS: VocabOption[] = [
  { value: "casual", label: "Casual" },
  { value: "business", label: "Business" },
  { value: "formal", label: "Formal" },
  { value: "wedding", label: "Wedding" },
  { value: "festive", label: "Festive" },
  { value: "party", label: "Party" },
  { value: "athleisure", label: "Athleisure" },
  { value: "vacation", label: "Vacation" },
];

/** `usermodel.py::STYLE_INTENTS`. */
export const STYLE_INTENTS: VocabOption[] = [
  { value: "minimalist", label: "Minimalist" },
  { value: "classic", label: "Classic" },
  { value: "streetwear", label: "Streetwear" },
  { value: "bohemian", label: "Bohemian" },
  { value: "preppy", label: "Preppy" },
  { value: "edgy", label: "Edgy" },
  { value: "romantic", label: "Romantic" },
  { value: "sporty", label: "Sporty" },
  { value: "business_casual", label: "Business casual" },
  { value: "glam", label: "Glam" },
];

/**
 * `taxonomy.py::SLOTS`, minus `unknown` (a sentinel, never a user choice).
 * These are the hard category filter — a slot chip narrows server-side, so
 * asking for Bottoms can never be crowded out by the embedding's bias.
 */
export const SLOT_FILTERS: VocabOption[] = [
  { value: "top", label: "Tops" },
  { value: "bottom", label: "Bottoms" },
  { value: "full_body", label: "Dresses & one-piece" },
  { value: "outerwear", label: "Outerwear" },
  { value: "footwear", label: "Footwear" },
  { value: "accessory", label: "Accessories" },
];

const LABELS = new Map(
  [...OCCASIONS, ...STYLE_INTENTS, ...SLOT_FILTERS].map((option) => [option.value, option.label]),
);

/** Human label for a controlled value; falls back to the raw value. */
export function vocabLabel(value: string): string {
  return LABELS.get(value) ?? value;
}
