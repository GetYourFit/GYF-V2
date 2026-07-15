import { describe, expect, test } from "bun:test";

import { normalizeEmail, validateEmail, validatePassword } from "./auth-validation";

describe("auth validation", () => {
  test("normalizes email before auth calls", () => {
    expect(normalizeEmail("  Person@Example.COM ")).toBe("person@example.com");
  });
  test("rejects empty and malformed emails", () => {
    expect(validateEmail("")).toBeString();
    expect(validateEmail("person")).toBeString();
    expect(validateEmail("person@example.com")).toBeNull();
  });
  test("requires a six-character password", () => {
    expect(validatePassword("12345")).toBeString();
    expect(validatePassword("123456")).toBeNull();
  });
});
