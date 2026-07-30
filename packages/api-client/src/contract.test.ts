import { afterEach, describe, expect, it, vi } from "vitest";

import { GyfApi } from "./api";

const emptyProfile = { gender: "women", occasion: "casual" } as never;
const emptyOutfit = { outfit_key: "look-1", item_ids: ["item-1"] } as never;

function responseBody(path: string, method: string): unknown {
  if (path === "/items/search" || path === "/items/browse" || path.endsWith("/similar")) {
    return { results: [] };
  }
  if (path === "/items/facets") {
    return {
      total: 0,
      priced: 0,
      price_min: null,
      price_max: null,
      catalogue_version: 1,
      facet_age_seconds: 0,
      freshness: "fresh",
    };
  }
  if (path === "/collections") return method === "GET" ? { items: [] } : {};
  if (path === "/collections/outfits") return method === "GET" ? { outfits: [] } : {};
  if (path === "/wardrobe/items") return method === "GET" ? { items: [] } : {};
  if (path === "/social/posts" && method === "GET") return { posts: [] };
  if (path === "/social/blocks") return { blocked: [] };
  if (path === "/social/follows") return { following: [] };
  if (path === "/tryon/jobs" && method === "GET") {
    return { jobs: [], quota: { used: 0, limit: 3 } };
  }
  if (path === "/feedback") return { status: "accepted", action: "save" };
  if (path === "/social/follows/user-1") return { user_id: "user-1", following: true, newly: true };
  if (path === "/social/posts/post-1/react") return { post_id: "post-1", reacted: true };
  if (path === "/support/messages") return { id: "support-1", status: "received" };
  if (path === "/me") return { user_id: "user-1", email: "user@example.com" };
  if (path === "/account/export") return { user_id: "user-1", data: {} };
  if (path === "/profile/photo") {
    return {
      source: "photo",
      photo_analysis: {
        state: "abstained",
        skin_tone: null,
        undertone: null,
        body_type: null,
        measurements: {},
        field_confidence: {},
        reason: "Use manual fields.",
      },
    };
  }
  return {};
}

const path = (input: RequestInfo | URL) => new URL(String(input)).pathname;

describe("generated-contract transport parity", () => {
  afterEach(() => vi.restoreAllMocks());

  it("covers every client endpoint while preserving auth, request IDs and body semantics", async () => {
    const calls: Array<{ path: string; method: string; init: RequestInit }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
        const requestPath = path(input);
        calls.push({ path: requestPath, method: init.method ?? "GET", init });
        const status =
          init.method === "DELETE" ||
          (requestPath === "/profile" && init.method === "DELETE") ||
          (requestPath.includes("/react") && init.method === "DELETE") ||
          requestPath.includes("/blocks/") ||
          (requestPath.includes("/follows/") && init.method === "DELETE") ||
          requestPath.includes("/report")
            ? 204
            : requestPath === "/feedback"
              ? 202
              : requestPath === "/collections" && init.method === "POST"
                ? 201
                : requestPath === "/collections/outfits" && init.method === "POST"
                  ? 201
                  : requestPath === "/wardrobe/items" && init.method === "POST"
                    ? 201
                    : requestPath === "/support/messages"
                      ? 201
                      : 200;
        const body =
          status === 204 ? null : JSON.stringify(responseBody(requestPath, init.method ?? "GET"));
        return new Response(body, { status, headers: { "Content-Type": "application/json" } });
      }),
    );

    const api = new GyfApi(() => "jwt-contract", "https://api.test");
    await api.getProfile();
    await api.putProfile(emptyProfile);
    await api.deleteProfile();
    await api.getProfileSummary();
    await api.uploadPhoto(new File(["photo"], "photo.jpg", { type: "image/jpeg" }));
    await api.getConsent();
    await api.putConsent({ flags: { behavioral_learning: false } });
    await api.deleteAccount();
    await api.exportAccount();
    await api.me();
    await api.recommend({ occasion: "casual" });
    await api.completeLook("item-1");
    await api.alternates("item-1");
    await api.feedback({
      event_id: "event-contract-1",
      target_type: "item",
      target_id: "item-1",
      action: "save",
    });
    await api.search("linen", { k: 2 });
    await api.browse({ slots: "top,bottom", seed: "session-1" });
    await api.facets("IN", "women");
    await api.similar("item-1", { k: 2 });
    await api.convertAffiliateLink("https://shop.test/item-1", "rec-1");
    await api.saveItem("item-1");
    await api.listSaved();
    await api.unsaveItem("item-1");
    await api.saveOutfit(emptyOutfit);
    await api.listSavedOutfits();
    await api.removeSavedOutfit("saved-1");
    await api.addWardrobeItem({ title: "linen shirt" });
    await api.listWardrobe();
    await api.updateWardrobeItem("wardrobe-1", "shirt");
    await api.removeWardrobeItem("wardrobe-1");
    await api.socialFeed({ scope: "following" });
    await api.createPost({ item_ids: ["item-1"] });
    await api.reactToPost("post-1");
    await api.unreactToPost("post-1");
    await api.recreatePost("post-1");
    await api.followUser("user-1");
    await api.unfollowUser("user-1");
    await api.listFollows();
    await api.reportPost("post-1", "spam");
    await api.blockUser("user-1");
    await api.unblockUser("user-1");
    await api.listBlocks();
    await api.submitSupportMessage({ kind: "contact", message: "Hello" });
    await api.systemStatus();
    await api.systemModels();
    await api.createTryOnJob(new File(["photo"], "photo.jpg", { type: "image/jpeg" }), ["item-1"]);
    await api.tryOnJob("job-1");
    await api.tryOnJobs();
    await api.cancelTryOnJob("job-1");

    expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual([
      "GET /profile",
      "PUT /profile",
      "DELETE /profile",
      "GET /profile/summary",
      "POST /profile/photo",
      "GET /consent",
      "PUT /consent",
      "DELETE /account",
      "GET /account/export",
      "GET /me",
      "GET /outfits/recommend",
      "GET /outfits/complete",
      "GET /outfits/alternates",
      "POST /feedback",
      "GET /items/search",
      "GET /items/browse",
      "GET /items/facets",
      "GET /items/item-1/similar",
      "POST /cuelinks/links/convert",
      "POST /collections",
      "GET /collections",
      "DELETE /collections/item-1",
      "POST /collections/outfits",
      "GET /collections/outfits",
      "DELETE /collections/outfits/saved-1",
      "POST /wardrobe/items",
      "GET /wardrobe/items",
      "PATCH /wardrobe/items/wardrobe-1",
      "DELETE /wardrobe/items/wardrobe-1",
      "GET /social/posts",
      "POST /social/posts",
      "POST /social/posts/post-1/react",
      "DELETE /social/posts/post-1/react",
      "POST /social/posts/post-1/recreate",
      "PUT /social/follows/user-1",
      "DELETE /social/follows/user-1",
      "GET /social/follows",
      "POST /social/posts/post-1/report",
      "PUT /social/blocks/user-1",
      "DELETE /social/blocks/user-1",
      "GET /social/blocks",
      "POST /support/messages",
      "GET /system/status",
      "GET /system/models",
      "POST /tryon",
      "GET /tryon/jobs/job-1",
      "GET /tryon/jobs",
      "DELETE /tryon/jobs/job-1",
    ]);

    for (const call of calls) {
      expect(new Headers(call.init.headers).get("Authorization")).toBe("Bearer jwt-contract");
      expect(new Headers(call.init.headers).get("X-Request-ID")).toMatch(/^[0-9a-f-]{36}$/);
    }
    const feedback = calls.find((call) => call.path === "/feedback");
    expect(new Headers(feedback?.init.headers).get("Idempotency-Key")).toBe("event-contract-1");
    expect(calls.find((call) => call.path === "/profile/photo")?.init.body).toBeInstanceOf(
      FormData,
    );
    expect(
      new Headers(calls.find((call) => call.path === "/profile/photo")?.init.headers).has(
        "Content-Type",
      ),
    ).toBe(false);
  });
});
