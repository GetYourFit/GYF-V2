import { describe, expect, test } from "bun:test";

import { avatarImageUrl, formatMemberSince, initials, statCells } from "./profile-summary";

describe("Expo Profile summary model", () => {
  test("member-since formats UTC month/year, null when absent or bad", () => {
    expect(formatMemberSince("2026-01-15")).toBe("January 2026");
    expect(formatMemberSince(null)).toBeNull();
    expect(formatMemberSince("not-a-date")).toBeNull();
  });

  test("initials take up to two words, fall back to GYF", () => {
    expect(initials("Aria Vance")).toBe("AV");
    expect(initials("cher")).toBe("C");
    expect(initials("  ")).toBe("GYF");
  });

  test("avatar image url accepts only https, null otherwise", () => {
    expect(avatarImageUrl("https://cdn.gyf.app/u/1/avatar-a")).toBe(
      "https://cdn.gyf.app/u/1/avatar-a",
    );
    expect(avatarImageUrl("http://cdn.gyf.app/a")).toBeNull();
    expect(avatarImageUrl("javascript:alert(1)")).toBeNull();
    expect(avatarImageUrl(null)).toBeNull();
    expect(avatarImageUrl(undefined)).toBeNull();
    expect(avatarImageUrl("  ")).toBeNull();
  });

  test("stat cells map the summary counts in grid order", () => {
    const summary = {
      outfits_made: 3,
      items_saved: 7,
      wardrobe_size: 2,
      posts: 1,
      reactions_received: 9,
      badges: ["Trendsetter"],
    } as never;
    expect(statCells(summary).map((cell) => cell.value)).toEqual([3, 7, 2, 1, 9, 1]);
  });
});
