import { describe, expect, it } from "bun:test";

import { getSession } from "./auth";
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
