import { describe, expect, it } from "bun:test";

import { readSupabaseEnv } from "./auth-config";

describe("readSupabaseEnv", () => {
  it("requires public Supabase configuration", () => {
    expect(() => readSupabaseEnv({})).toThrow(/EXPO_PUBLIC_SUPABASE_URL/);
  });

  it("accepts HTTPS Supabase projects", () => {
    expect(
      readSupabaseEnv({
        EXPO_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
        EXPO_PUBLIC_SUPABASE_ANON_KEY: "anon",
      }),
    ).toEqual({ url: "https://project.supabase.co", anonKey: "anon" });
  });

  it("rejects unsafe URLs", () => {
    expect(() =>
      readSupabaseEnv({
        EXPO_PUBLIC_SUPABASE_URL: "file:///secret",
        EXPO_PUBLIC_SUPABASE_ANON_KEY: "anon",
      }),
    ).toThrow(/http\(s\)/);
    expect(() =>
      readSupabaseEnv({
        EXPO_PUBLIC_SUPABASE_URL: "http://project.example.test",
        EXPO_PUBLIC_SUPABASE_ANON_KEY: "anon",
      }),
    ).toThrow(/http\(s\)/);
  });
});
