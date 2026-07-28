import { describe, expect, test } from "bun:test";

import { downloadValidatedPostImage } from "./post-image-transfer";
import { safePostImageUrl, savePostImage, sharePostImage } from "./social-media";

const IMAGE = "https://cdn.example.test/look.jpg";
const JPEG_BYTES = Uint8Array.from([0xff, 0xd8, 0xff, 0xdb]);

describe("Social post media actions", () => {
  test("shares a valid image through the available platform surface", async () => {
    const shared: string[] = [];
    await expect(
      sharePostImage(IMAGE, {
        native: async (url) => {
          shared.push(url);
          return "shared";
        },
      }),
    ).resolves.toEqual({
      outcome: "success",
      message: "Shared from your device.",
    });
    expect(shared).toEqual([IMAGE]);
  });

  test("treats a dismissed native share sheet as cancelled", async () => {
    await expect(
      sharePostImage(IMAGE, {
        native: async () => "dismissed",
      }),
    ).resolves.toEqual({
      outcome: "cancelled",
      message: "Sharing was dismissed before anything was sent.",
    });
  });

  test("rejects missing, executable, local, and credential-bearing image URLs", async () => {
    for (const url of [
      undefined,
      "javascript:alert(1)",
      "file:///private/look.jpg",
      "https://token@cdn.example.test/look.jpg",
    ]) {
      await expect(
        sharePostImage(url, { native: async () => "shared" }),
      ).resolves.toMatchObject({ outcome: "invalid" });
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
    await expect(
      savePostImage(IMAGE, {
        platform: "native",
        requestPhotoPermission: async () => "blocked",
        saveNative,
      }),
    ).resolves.toEqual({
      outcome: "denied",
      message: "Photos access is blocked. Allow it in settings to save this image.",
    });
    await expect(savePostImage(IMAGE, { platform: "unsupported" })).resolves.toMatchObject({
      outcome: "unavailable",
    });
  });

  test("reports share, native save, and browser-download failures honestly", async () => {
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

  test("reports browser downloads as requested rather than confirmed", async () => {
    await expect(
      savePostImage(IMAGE, {
        platform: "web",
        downloadWeb: async () => undefined,
      }),
    ).resolves.toEqual({
      outcome: "requested",
      message: "GYF requested a browser download, but the browser did not confirm it saved.",
    });
  });
});

describe("Validated post-image downloads", () => {
  test("accepts matching image bytes within the size limit", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(JPEG_BYTES, {
        status: 200,
        headers: {
          "content-type": "image/jpeg",
          "content-length": String(JPEG_BYTES.byteLength),
        },
      });
    try {
      await expect(downloadValidatedPostImage(IMAGE)).resolves.toEqual({
        bytes: JPEG_BYTES,
        contentType: "image/jpeg",
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("rejects spoofed image MIME with non-image bytes", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(Uint8Array.from([0x6e, 0x6f, 0x70, 0x65]), {
        status: 200,
        headers: {
          "content-type": "image/jpeg",
          "content-length": "4",
        },
      });
    try {
      await expect(downloadValidatedPostImage(IMAGE)).rejects.toThrow(
        "Image download was unavailable",
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("rejects oversized downloads before reading the body", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(JPEG_BYTES, {
        status: 200,
        headers: {
          "content-type": "image/jpeg",
          "content-length": String(11 * 1024 * 1024),
        },
      });
    try {
      await expect(downloadValidatedPostImage(IMAGE)).rejects.toThrow(
        "Image download was unavailable",
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
