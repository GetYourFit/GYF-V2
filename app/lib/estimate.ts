// Single source of truth for folding a photo estimate into the onboarding form.
//
// The photo endpoint may return a field the manual <Select> can't display (a value
// outside the vocab, e.g. an abstained/low-confidence result). If we both (a) apply
// it to the form and (b) tell the user we "estimated" it, the field silently shows
// the placeholder while the message claims success — exactly the confusing state we
// must avoid. So we validate every estimate against the dropdown options and only
// apply — and only report — values the form can actually show.

import type { Profile, ProfileInput } from "@gyf/types";

import { BODY_TYPES, SKIN_TONES, UNDERTONES } from "./vocab";

const VALID: Record<EstimatedField, ReadonlySet<string>> = {
  skin_tone: new Set(SKIN_TONES.map((o) => o.value)),
  undertone: new Set(UNDERTONES.map((o) => o.value)),
  body_type: new Set(BODY_TYPES.map((o) => o.value)),
};

export const FIELD_LABELS: Record<EstimatedField, string> = {
  skin_tone: "skin tone",
  undertone: "undertone",
  body_type: "body type",
};

export type EstimatedField = "skin_tone" | "undertone" | "body_type";
const FIELDS: EstimatedField[] = ["skin_tone", "undertone", "body_type"];

export interface EstimateMerge {
  /** Form patch — only the estimated fields the manual UI can actually display. */
  patch: Partial<ProfileInput>;
  /** Human labels of the fields that were applied (for the "Estimated …" message). */
  applied: string[];
  /**
   * Fields the photo module didn't produce a usable value for on this attempt —
   * e.g. body_type when the photo has no full body in frame. Distinct from fields
   * simply never attempted: only populated after an actual photo upload, so the
   * form can point at exactly which field needs manual input instead of leaving
   * a silently-empty Select next to a message that claims partial success.
   */
  missing: EstimatedField[];
}

/** Fold a photo-estimated profile into a form patch, keeping only vocab-valid values
 *  so the manual selects reflect exactly what we claim to have estimated. */
export function mergeEstimated(profile: Profile): EstimateMerge {
  const patch: Partial<ProfileInput> = {};
  const applied: string[] = [];
  const missing: EstimatedField[] = [];

  for (const field of FIELDS) {
    const value = profile[field];
    if (typeof value === "string" && VALID[field].has(value)) {
      patch[field] = value;
      applied.push(FIELD_LABELS[field]);
    } else {
      missing.push(field);
    }
  }

  // Measurements are not a dropdown — adopt them whenever the body module produced any.
  if (profile.measurements && Object.keys(profile.measurements).length > 0) {
    patch.measurements = profile.measurements;
  }

  return { patch, applied, missing };
}
