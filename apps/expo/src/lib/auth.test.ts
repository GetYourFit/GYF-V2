import { describe, expect, it } from "bun:test";
import type { Session } from "@supabase/supabase-js";

import { getSession, resolveRecoverySession } from "./auth";
import { readSupabaseEnv } from "./auth-config";

const fakeSession = { access_token: "at", refresh_token: "rt" } as Session;

describe("readSupabaseEnv", () => {
  it("requires public Supabase configuration", () => {
    expect(() => readSupabaseEnv({})).toThrow(/EXPO_PUBLIC_SUPABASE_URL/);
  });

  it("accepts HTTPS Supabase projects", () => {
    expect(
      readSupabaseEnv({
        EXPO_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
        EXPO_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_test",
      }),
    ).toEqual({ url: "https://project.supabase.co", anonKey: "sb_publishable_test" });
  });

  it("rejects revoked legacy anon JWTs before they reach Supabase", () => {
    expect(() =>
      readSupabaseEnv({
        EXPO_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
        EXPO_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiJ9.legacy.signature",
      }),
    ).toThrow(/publishable key/);
    expect(() =>
      readSupabaseEnv({
        EXPO_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
        EXPO_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_",
      }),
    ).toThrow(/publishable key/);
  });

  it("rejects unsafe URLs", () => {
    expect(() =>
      readSupabaseEnv({
        EXPO_PUBLIC_SUPABASE_URL: "file:///secret",
        EXPO_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_test",
      }),
    ).toThrow(/http\(s\)/);
    expect(() =>
      readSupabaseEnv({
        EXPO_PUBLIC_SUPABASE_URL: "http://project.example.test",
        EXPO_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_test",
      }),
    ).toThrow(/http\(s\)/);
  });
});

describe("getSession", () => {
  it("returns a rejected promise when configuration is missing", async () => {
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    try {
      await expect(getSession()).rejects.toThrow(/Supabase auth is not configured/);
    } finally {
      if (url === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL;
      else process.env.EXPO_PUBLIC_SUPABASE_URL = url;
      if (key === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      else process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = key;
    }
  });
});

describe("resolveRecoverySession", () => {
  it("exchanges a recovery link's code for a session", async () => {
    const exchangeCodeForSession = async (code: string) => {
      expect(code).toBe("the-code");
      return { data: { session: fakeSession, user: fakeSession.user }, error: null } as never;
    };
    const session = await resolveRecoverySession(
      { code: "the-code" },
      { exchangeCodeForSession, getSession: async () => null },
    );
    expect(session).toBe(fakeSession);
  });

  it("takes the first code when expo-router surfaces a duplicated query param", async () => {
    const exchangeCodeForSession = async (code: string) => {
      expect(code).toBe("first-code");
      return { data: { session: fakeSession, user: fakeSession.user }, error: null } as never;
    };
    const session = await resolveRecoverySession(
      { code: ["first-code", "second-code"] },
      { exchangeCodeForSession, getSession: async () => null },
    );
    expect(session).toBe(fakeSession);
  });

  it("reports no session when the code exchange fails (expired/reused link)", async () => {
    const exchangeCodeForSession = async () =>
      ({ data: { session: null, user: null }, error: new Error("invalid grant") }) as never;
    const session = await resolveRecoverySession(
      { code: "stale-code" },
      { exchangeCodeForSession, getSession: async () => null },
    );
    expect(session).toBeNull();
  });

  it("reports no session when the code exchange throws", async () => {
    const exchangeCodeForSession = async (): Promise<never> => {
      throw new Error("network down");
    };
    const session = await resolveRecoverySession(
      { code: "stale-code" },
      { exchangeCodeForSession, getSession: async () => null },
    );
    expect(session).toBeNull();
  });

  it("reports no session when Supabase redirects an already-expired link with an error param", async () => {
    const exchangeCodeForSession = async (): Promise<never> => {
      throw new Error("must not be called");
    };
    const session = await resolveRecoverySession(
      { error: "access_denied", error_description: "Email link is invalid or has expired" },
      { exchangeCodeForSession, getSession: async () => null },
    );
    expect(session).toBeNull();
  });

  it("falls back to an existing session when the link carries no code or error", async () => {
    const exchangeCodeForSession = async (): Promise<never> => {
      throw new Error("must not be called");
    };
    const session = await resolveRecoverySession(
      {},
      { exchangeCodeForSession, getSession: async () => fakeSession },
    );
    expect(session).toBe(fakeSession);
  });
});
