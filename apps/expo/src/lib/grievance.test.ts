import { describe, expect, test } from "bun:test";

import { grievanceErrors, grievancePayload } from "./grievance";

describe("Expo Grievance form model", () => {
  test("rejects an unknown category, malformed email and blank report", () => {
    expect(grievanceErrors({ category: "", email: "wrong", message: " " })).toEqual({
      category: "Choose the area that best matches your concern.",
      email: "Enter a valid reply email.",
      message: "Describe what happened before submitting.",
    });
  });

  test("normalizes the stored grievance payload", () => {
    expect(
      grievancePayload({
        category: "Recommendation & AI",
        email: " ASHA@EXAMPLE.COM ",
        message: "  The explanation was unclear.  ",
      }),
    ).toEqual({
      kind: "grievance",
      category: "Recommendation & AI",
      message: "The explanation was unclear.",
      reply_email: "asha@example.com",
    });
  });

  test("accepts a complete grievance", () => {
    expect(
      grievanceErrors({
        category: "Privacy & safety",
        email: "asha@example.com",
        message: "Please review this data handling concern.",
      }),
    ).toEqual({});
  });
});
