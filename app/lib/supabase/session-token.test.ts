import type { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { authStorageKey, readAccessToken } from "./session-token";

/** Minimal NextRequest stand-in exposing only the cookie API readAccessToken uses. */
function requestWithCookies(cookies: Record<string, string>): NextRequest {
  return {
    cookies: {
      get: (name: string) => (name in cookies ? { name, value: cookies[name] } : undefined),
    },
  } as unknown as NextRequest;
}

/** Encode a session the way @supabase/ssr does: `base64-<base64url(JSON)>`. */
function encodeSession(session: unknown): string {
  const json = JSON.stringify(session);
  const b64url = btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `base64-${b64url}`;
}

const KEY = "sb-ref-auth-token";

describe("authStorageKey", () => {
  it("derives the storage key from the project ref subdomain", () => {
    expect(authStorageKey("https://abcdefg.supabase.co")).toBe("sb-abcdefg-auth-token");
  });
});

describe("readAccessToken", () => {
  it("reads the token from a single base64 cookie", () => {
    const req = requestWithCookies({ [KEY]: encodeSession({ access_token: "tok-123" }) });
    expect(readAccessToken(req, KEY)).toBe("tok-123");
  });

  it("reassembles a token split across chunk cookies", () => {
    const encoded = encodeSession({ access_token: "tok-chunked", extra: "x".repeat(40) });
    const mid = Math.floor(encoded.length / 2);
    const req = requestWithCookies({
      [`${KEY}.0`]: encoded.slice(0, mid),
      [`${KEY}.1`]: encoded.slice(mid),
    });
    expect(readAccessToken(req, KEY)).toBe("tok-chunked");
  });

  it("returns null when no session cookie is present", () => {
    expect(readAccessToken(requestWithCookies({}), KEY)).toBeNull();
  });

  it("returns null for a malformed cookie value", () => {
    expect(readAccessToken(requestWithCookies({ [KEY]: "base64-@@@notbase64@@@" }), KEY)).toBeNull();
    expect(readAccessToken(requestWithCookies({ [KEY]: "base64-" }), KEY)).toBeNull();
  });

  it("returns null when the decoded session has no access_token", () => {
    const req = requestWithCookies({ [KEY]: encodeSession({ user: { id: "u1" } }) });
    expect(readAccessToken(req, KEY)).toBeNull();
  });
});
