import { describe, expect, test } from "bun:test";

import { appendUniquePosts, applyReaction, postCoverImages, toggleId } from "./social-feed";

const post = (over: Record<string, unknown> = {}) =>
  ({ id: "p1", user_id: "u1", reaction_count: 2, reacted: false, items: [], ...over }) as never;

describe("Expo Social feed model", () => {
  test("reaction is a single, clamped, idempotent step", () => {
    expect(applyReaction(post(), true)).toMatchObject({ reacted: true, reaction_count: 3 });
    expect(applyReaction(post({ reacted: true }), false)).toMatchObject({ reaction_count: 1 });
    // already in that state → unchanged (no double-count)
    expect(applyReaction(post({ reacted: true, reaction_count: 3 }), true).reaction_count).toBe(3);
    // never below zero
    expect(applyReaction(post({ reacted: true, reaction_count: 0 }), false).reaction_count).toBe(0);
  });

  test("follow set toggles immutably", () => {
    const start = new Set(["a"]);
    expect([...toggleId(start, "b", true)]).toEqual(["a", "b"]);
    expect([...toggleId(start, "a", false)]).toEqual([]);
    expect(start.has("b")).toBe(false); // original untouched
  });

  test("cover strip takes only remote images, capped", () => {
    const items = [
      { image_url: "https://x/1.jpg" },
      { image_url: null },
      { image_url: "data:foo" },
      { image_url: "https://x/2.jpg" },
    ] as never;
    expect(postCoverImages(items, 1)).toEqual(["https://x/1.jpg"]);
    expect(postCoverImages(items)).toEqual(["https://x/1.jpg", "https://x/2.jpg"]);
  });

  test("pagination drops a repeated post at the boundary", () => {
    expect(
      appendUniquePosts([post({ id: "a" })], [post({ id: "a" }), post({ id: "b" })]),
    ).toHaveLength(2);
  });
});
