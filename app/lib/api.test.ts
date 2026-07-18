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

  it("encodes a request-scoped style for recommend and complete-look requests", async () => {
    const fetchSpy = mockFetch({ status: 200, body: { occasion: "casual", outfits: [] } });
    vi.stubGlobal("fetch", fetchSpy);
    const api = new GyfApi(() => null, "http://api");

    await api.recommend({ style: "streetwear" });
    await api.completeLook("item-1", { style: "streetwear" });

    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      "http://api/outfits/recommend?style=streetwear",
      expect.anything(),
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      "http://api/outfits/complete?item_id=item-1&style=streetwear",
      expect.anything(),
    );
  });

  it("maps a 404 to an onboarding-aware ApiError", async () => {
    const fetchSpy = mockFetch({ status: 404, body: { detail: "No profile yet" } });
    vi.stubGlobal("fetch", fetchSpy);
    const api = new GyfApi(() => "jwt", "http://api");

    const err = await api.getProfile().catch((e: unknown) => e);
    expect(fetchSpy).toHaveBeenCalledOnce();
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

  it("reuses one generated event id when feedback retries", async () => {
    vi.spyOn(globalThis, "setTimeout").mockImplementation(((callback: () => void) => {
      callback();
      return 0;
    }) as typeof setTimeout);
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "accepted", action: "save" }), { status: 202 }),
      );
    vi.stubGlobal("fetch", fetchSpy);

    await new GyfApi(() => "jwt", "http://api").feedback({
      target_type: "item",
      target_id: "i1",
      action: "save",
    });

    const bodies = fetchSpy.mock.calls.map(([, init]) => JSON.parse(String(init?.body)));
    expect(bodies).toHaveLength(2);
    expect(bodies[0].event_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(bodies[1].event_id).toBe(bodies[0].event_id);
  });

  it("does not retry recommendation GETs that already logged a slate", async () => {
    const fetchSpy = mockFetch({ status: 503, body: { detail: "cold start" } });
    vi.stubGlobal("fetch", fetchSpy);

    const err = await new GyfApi(() => "jwt", "http://api").recommend().catch((e: unknown) => e);

    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(503);
  });

  it("aborts a stalled request at the client timeout", async () => {
    const fetchSpy = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("timed out", "AbortError")),
          );
        }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const err = await new GyfApi(() => null, "http://api", 1).recommend().catch((e: unknown) => e);

    expect(fetchSpy).toHaveBeenCalledOnce();
    expect((err as DOMException).name).toBe("AbortError");
  });

  it("does not retry alternates after its client timeout", async () => {
    const fetchSpy = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("timed out", "AbortError")),
          );
        }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const err = await new GyfApi(() => null, "http://api", 1)
      .alternates("item-1")
      .catch((e: unknown) => e);

    expect(fetchSpy).toHaveBeenCalledOnce();
    expect((err as DOMException).name).toBe("AbortError");
  });

  it("still retries a safe GET after a gateway failure", async () => {
    vi.spyOn(globalThis, "setTimeout").mockImplementation(((callback: () => void) => {
      callback();
      return 0;
    }) as typeof setTimeout);
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ occasion: "casual" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);

    await expect(new GyfApi(() => null, "http://api").getProfile()).resolves.toMatchObject({
      occasion: "casual",
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("still retries a safe GET after a network drop", async () => {
    vi.spyOn(globalThis, "setTimeout").mockImplementation(((callback: () => void) => {
      callback();
      return 0;
    }) as typeof setTimeout);
    const fetchSpy = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("network unavailable"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ occasion: "casual" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);

    await expect(new GyfApi(() => null, "http://api").getProfile()).resolves.toMatchObject({
      occasion: "casual",
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
