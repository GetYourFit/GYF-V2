import { describe, expect, test } from "bun:test";

import { safePostImageUrl, savePostImage, sharePostImage } from "./social-media";

const IMAGE = "https://cdn.example.test/look.jpg";

describe("Social post media actions", () => {
  test("shares a valid image through the available platform surface", async () => {
    const shared: string[] = [];
    await expect(
      sharePostImage(IMAGE, { native: async (url) => void shared.push(url) }),
    ).resolves.toEqual({
      outcome: "success",
      message: "Share sheet opened.",
    });
    expect(shared).toEqual([IMAGE]);
  });

  test("rejects missing, executable, local, and credential-bearing image URLs", async () => {
    for (const url of [
      undefined,
      "javascript:alert(1)",
      "file:///private/look.jpg",
      "https://token@cdn.example.test/look.jpg",
    ]) {
      await expect(sharePostImage(url, { native: async () => undefined })).resolves.toMatchObject({
        outcome: "invalid",
      });
      await expect(
        savePostImage(url, { platform: "web", downloadWeb: async () => undefined }),
      ).resolves.toMatchObject({
        outcome: "invalid",
      });
    }
    expect(safePostImageUrl("https://cdn.example.test/look.jpg")).toBe(IMAGE);
  });

  test("saves after an on-demand photo permission grant and confirmed save", async () => {
    const calls: string[] = [];
    await expect(
      savePostImage(IMAGE, {
        platform: "native",
        requestPhotoPermission: async () => {
          calls.push("permission");
          return "granted";
        },
        saveNative: async (url) => void calls.push(url),
      }),
    ).resolves.toMatchObject({ outcome: "success" });
    expect(calls).toEqual(["permission", IMAGE]);
  });

  test("reports denied or unavailable photo capability without downloading", async () => {
    const saveNative = async () => {
      throw new Error("must not run");
    };
    await expect(
      savePostImage(IMAGE, {
        platform: "native",
        requestPhotoPermission: async () => "denied",
        saveNative,
      }),
    ).resolves.toMatchObject({ outcome: "denied" });
    await expect(savePostImage(IMAGE, { platform: "unsupported" })).resolves.toMatchObject({
      outcome: "unavailable",
    });
  });

  test("reports share, download, and browser-download failures honestly", async () => {
    await expect(
      sharePostImage(IMAGE, { native: async () => Promise.reject(new Error("no share")) }),
    ).resolves.toMatchObject({
      outcome: "failed",
    });
    await expect(
      savePostImage(IMAGE, {
        platform: "native",
        requestPhotoPermission: async () => "granted",
        saveNative: async () => Promise.reject(new Error("network")),
      }),
    ).resolves.toMatchObject({ outcome: "failed" });
    await expect(
      savePostImage(IMAGE, {
        platform: "web",
        downloadWeb: async () => Promise.reject(new Error("network")),
      }),
    ).resolves.toMatchObject({ outcome: "failed" });
  });
});
