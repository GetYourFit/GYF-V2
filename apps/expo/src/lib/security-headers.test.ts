import { describe, expect, test } from "bun:test";

import { SECURITY_HEADERS } from "./security-headers";

describe("Expo server security headers", () => {
  test("keeps every required header explicit at the middleware boundary", () => {
    expect(SECURITY_HEADERS).toEqual({
      "Content-Security-Policy": "frame-ancestors 'none'",
      "Cross-Origin-Opener-Policy": "same-origin",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    });
  });
});
