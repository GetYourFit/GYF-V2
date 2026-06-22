import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, GyfApi } from "./api";

// A typed stand-in for the global fetch the client calls.
function mockFetch(response: { status: number; body?: unknown; text?: string }): typeof fetch {
  const text = response.text ?? (response.body !== undefined ? JSON.stringify(response.body) : "");
  // A 204/205 response must have a null body per the Fetch spec (the Response
  // constructor throws otherwise) — mirror real server behaviour.
  const body = text === "" ? null : text;
  return vi.fn(
    async () =>
      new Response(body, {
        status: response.status,
        headers: { "Content-Type": "application/json" },
      }),
  ) as unknown as typeof fetch;
}

afterEach(() => vi.restoreAllMocks());

describe("GyfApi", () => {
  it("attaches the bearer token when one is provided", async () => {
    const fetchSpy = mockFetch({ status: 200, body: { occasion: "casual", outfits: [] } });
    vi.stubGlobal("fetch", fetchSpy);
    const api = new GyfApi(() => "jwt-123", "http://api");

    await api.recommend({ occasion: "casual" });

    const [, init] = (fetchSpy as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBe("Bearer jwt-123");
  });

  it("omits the Authorization header when signed out", async () => {
    const fetchSpy = mockFetch({ status: 200, body: {} });
    vi.stubGlobal("fetch", fetchSpy);
    const api = new GyfApi(() => null, "http://api");

    await api.getProfile();

    const [, init] = (fetchSpy as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(new Headers(init.headers).has("Authorization")).toBe(false);
  });

  it("builds query params and drops empty/undefined values", async () => {
    const fetchSpy = mockFetch({ status: 200, body: { occasion: "casual", outfits: [] } });
    vi.stubGlobal("fetch", fetchSpy);
    const api = new GyfApi(() => null, "http://api");

    await api.recommend({ occasion: "casual", goal: "", k: 5 });

    const [url] = (fetchSpy as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("http://api/outfits/recommend?occasion=casual&k=5");
  });

  it("maps a 404 to an onboarding-aware ApiError", async () => {
    vi.stubGlobal("fetch", mockFetch({ status: 404, body: { detail: "No profile yet" } }));
    const api = new GyfApi(() => "jwt", "http://api");

    const err = await api.getProfile().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(404);
    expect((err as ApiError).isNotOnboarded).toBe(true);
    expect((err as ApiError).message).toBe("No profile yet");
  });

  it("flags 503 as unavailable", async () => {
    vi.stubGlobal("fetch", mockFetch({ status: 503, body: { detail: "text search unavailable" } }));
    const api = new GyfApi(() => null, "http://api");

    const err = await api.search("red dress").catch((e: unknown) => e);
    expect((err as ApiError).isUnavailable).toBe(true);
  });

  it("returns undefined for 204 responses (delete account)", async () => {
    vi.stubGlobal("fetch", mockFetch({ status: 204, text: "" }));
    const api = new GyfApi(() => "jwt", "http://api");

    await expect(api.deleteAccount()).resolves.toBeUndefined();
  });

  it("unwraps the results array for search", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({ status: 200, body: { results: [{ item_id: "a" }, { item_id: "b" }] } }),
    );
    const api = new GyfApi(() => null, "http://api");

    const results = await api.search("dress", { k: 2 });
    expect(results).toHaveLength(2);
  });
});
