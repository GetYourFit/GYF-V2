import { describe, expect, test } from "bun:test";

import { consentDirty, consentPayload, exportFilename, isDeleteConfirmed } from "./account";

describe("Expo Account model", () => {
  test("dirty only when a known flag actually changed", () => {
    expect(consentDirty({ marketing: true }, {})).toBe(true);
    expect(consentDirty({ marketing: false }, {})).toBe(false); // false vs absent = same
    expect(consentDirty({ marketing: true }, { marketing: true })).toBe(false);
    expect(consentDirty({ unknown_flag: true }, {})).toBe(false); // stray key ignored
  });

  test("payload carries exactly the known flags as booleans", () => {
    expect(consentPayload({ marketing: true, unknown_flag: true })).toEqual({
      data_processing: false,
      behavioral_learning: false,
      marketing: true,
    });
  });

  test("only the exact word DELETE confirms erasure", () => {
    expect(isDeleteConfirmed(" DELETE ")).toBe(true);
    expect(isDeleteConfirmed("delete")).toBe(false);
    expect(isDeleteConfirmed("DELETE NOW")).toBe(false);
  });

  test("export filename is dated", () => {
    expect(exportFilename("2026-07-16T09:00:00Z")).toBe("gyf-data-2026-07-16.json");
  });
});
