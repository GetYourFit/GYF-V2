import { describe, expect, it } from "bun:test";

import { readPublicEnv } from "./env";

describe("readPublicEnv", () => {
  it("uses a safe local API default", () => {
    expect(readPublicEnv({})).toEqual({ apiUrl: "http://localhost:8000", source: "local-default" });
  });

  it("normalizes a configured API URL", () => {
    expect(readPublicEnv({ EXPO_PUBLIC_API_URL: "https://api.example.test/" })).toEqual({
      apiUrl: "https://api.example.test",
      source: "configured",
    });
  });

  it("rejects malformed or unsafe URLs", () => {
    expect(() => readPublicEnv({ EXPO_PUBLIC_API_URL: "not-a-url" })).toThrow(/complete http/);
    expect(() => readPublicEnv({ EXPO_PUBLIC_API_URL: "file:///secret" })).toThrow(/https/);
    expect(() => readPublicEnv({ EXPO_PUBLIC_API_URL: "http://api.example.test" })).toThrow(
      /https/,
    );
    expect(readPublicEnv({ EXPO_PUBLIC_API_URL: "http://localhost:8000" }).apiUrl).toBe(
      "http://localhost:8000",
    );
  });
});
