// Display vocabularies for onboarding. The *values* mirror the controlled
// vocabularies in packages/contracts/gyf_contracts/usermodel.py (the API's source
// of truth, which coerces unknowns to sentinels rather than rejecting); the
// *labels* are presentation the API does not carry. Keep values in lockstep with
// usermodel.py. (A future GET /vocabularies endpoint could make this generated.)

export interface Option {
  value: string;
  label: string;
}

export const BODY_TYPES: Option[] = [
  { value: "rectangle", label: "Rectangle — balanced shoulders & hips" },
  { value: "triangle", label: "Triangle (pear) — hips wider than shoulders" },
  { value: "inverted_triangle", label: "Inverted triangle — shoulders wider than hips" },
  { value: "hourglass", label: "Hourglass — defined waist" },
  { value: "oval", label: "Oval (apple) — fuller midsection" },
];

// Styling gender — conditions which slice of the gendered catalog is shown.
// Mirrors GENDERS in packages/contracts/gyf_contracts/usermodel.py.
export const GENDERS: Option[] = [
  { value: "women", label: "Womenswear" },
  { value: "men", label: "Menswear" },
  { value: "unisex", label: "Unisex" },
  { value: "nonbinary", label: "Non-binary — show me everything" },
];

export const UNDERTONES: Option[] = [
  { value: "warm", label: "Warm" },
  { value: "cool", label: "Cool" },
  { value: "neutral", label: "Neutral" },
  { value: "olive", label: "Olive" },
];

// Monk Skin Tone scale, lightest (1) → deepest (10).
export const SKIN_TONES: Option[] = Array.from({ length: 10 }, (_, i) => {
  const n = i + 1;
  const descriptor =
    n <= 2 ? "lightest" : n <= 4 ? "light" : n <= 6 ? "medium" : n <= 8 ? "deep" : "deepest";
  return { value: `mst${n}`, label: `MST ${n} — ${descriptor}` };
});

export const OCCASIONS: Option[] = [
  { value: "casual", label: "Casual" },
  { value: "business", label: "Business" },
  { value: "formal", label: "Formal" },
  { value: "wedding", label: "Wedding" },
  { value: "festive", label: "Festive" },
  { value: "party", label: "Party" },
  { value: "athleisure", label: "Athleisure" },
  { value: "vacation", label: "Vacation" },
];

export const STYLE_INTENTS: Option[] = [
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

export const CURRENCIES: Option[] = [
  { value: "USD", label: "USD ($)" },
  { value: "EUR", label: "EUR (€)" },
  { value: "GBP", label: "GBP (£)" },
  { value: "INR", label: "INR (₹)" },
];

// Consent keys mirror CONSENT_KEYS in services/api/app/profile/models.py.
export const CONSENT_OPTIONS: Array<Option & { required?: boolean; description: string }> = [
  {
    value: "data_processing",
    label: "Process my data to provide the service",
    description: "Required to use GYF — powers your recommendations.",
    required: true,
  },
  {
    value: "personalization",
    label: "Learn my taste from my behaviour",
    description: "Lets recommendations sharpen as you save, skip, and cart looks.",
  },
  {
    value: "photo_storage",
    label: "Store photos I upload",
    description: "For the photo body-type / skin-tone modules and try-on (coming soon).",
  },
  {
    value: "marketing",
    label: "Send me marketing communications",
    description: "Occasional product updates. Off by default.",
  },
];
