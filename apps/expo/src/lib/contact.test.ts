import { describe, expect, test } from "bun:test";

import { contactErrors, contactPayload } from "./contact";

describe("Expo Contact form model", () => {
  test("rejects blank identity, malformed email and blank message", () => {
    expect(contactErrors({ name: " ", email: "wrong", message: "" })).toEqual({
      name: "Tell us what to call you.",
      email: "Enter a valid reply email.",
      message: "Write a message before sending.",
    });
  });

  test("normalizes the operator-readable support payload", () => {
    expect(
      contactPayload({ name: "  Asha  ", email: " ASHA@EXAMPLE.COM ", message: "  Hello  " }),
    ).toEqual({
      kind: "contact",
      message: "From Asha: Hello",
      reply_email: "asha@example.com",
    });
  });

  test("accepts a complete form", () => {
    expect(contactErrors({ name: "Asha", email: "asha@example.com", message: "Hello" })).toEqual(
      {},
    );
  });
});
