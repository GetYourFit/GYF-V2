import { describe, expect, test } from "bun:test";

import { downloadValidatedPostImage } from "./post-image-transfer";
import { primaryActionablePostImageUrl } from "./social-post-media";
import { safePostImageUrl, savePostImage, sharePostImage } from "./social-media";

const IMAGE = "https://cdn.example.test/look.jpg";
const JPEG_BYTES = Uint8Array.from([0xff, 0xd8, 0xff, 0xdb]);
const WEBP_BYTES = Uint8Array.from([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20,
]);

function mockFetch(responseFactory: () => Promise<Response> | Response): typeof fetch {
  return Object.assign(async () => responseFactory(), {
    preconnect: () => {},
  }) as typeof fetch;
}

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
      await expect(sharePostImage(url, { native: async () => "shared" })).resolves.toMatchObject({
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
    globalThis.fetch = mockFetch(
      () =>
        new Response(JPEG_BYTES, {
          status: 200,
          headers: {
            "content-type": "image/jpeg",
            "content-length": String(JPEG_BYTES.byteLength),
          },
        }),
    );
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
    globalThis.fetch = mockFetch(
      () =>
        new Response(Uint8Array.from([0x6e, 0x6f, 0x70, 0x65]), {
          status: 200,
          headers: {
            "content-type": "image/jpeg",
            "content-length": "4",
          },
        }),
    );
    try {
      await expect(downloadValidatedPostImage(IMAGE)).rejects.toThrow(
        "Image download was unavailable",
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("rejects non-image content types even when the body is otherwise small", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch(
      () =>
        new Response(JPEG_BYTES, {
          status: 200,
          headers: {
            "content-type": "text/html",
            "content-length": String(JPEG_BYTES.byteLength),
          },
        }),
    );
    try {
      await expect(downloadValidatedPostImage(IMAGE)).rejects.toThrow(
        "Image download was unavailable",
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("accepts only WebP payloads with a WEBP RIFF brand", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch(
      () =>
        new Response(WEBP_BYTES, {
          status: 200,
          headers: {
            "content-type": "image/webp",
            "content-length": String(WEBP_BYTES.byteLength),
          },
        }),
    );
    try {
      await expect(
        downloadValidatedPostImage("https://cdn.example.test/look.webp"),
      ).resolves.toEqual({
        bytes: WEBP_BYTES,
        contentType: "image/webp",
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("rejects non-WebP RIFF payloads and truncated WebP headers", async () => {
    const originalFetch = globalThis.fetch;
    const invalidBodies = [
      Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45]),
      Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00]),
    ];
    try {
      for (const body of invalidBodies) {
        globalThis.fetch = mockFetch(
          () =>
            new Response(body, {
              status: 200,
              headers: {
                "content-type": "image/webp",
                "content-length": String(body.byteLength),
              },
            }),
        );
        await expect(
          downloadValidatedPostImage("https://cdn.example.test/look.webp"),
        ).rejects.toThrow("Image download was unavailable");
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("rejects oversized downloads before reading the body", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch(
      () =>
        new Response(JPEG_BYTES, {
          status: 200,
          headers: {
            "content-type": "image/jpeg",
            "content-length": String(11 * 1024 * 1024),
          },
        }),
    );
    try {
      await expect(downloadValidatedPostImage(IMAGE)).rejects.toThrow(
        "Image download was unavailable",
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("rejects redirected responses", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch(async () => {
      const response = new Response(JPEG_BYTES, {
        status: 200,
        headers: {
          "content-type": "image/jpeg",
          "content-length": String(JPEG_BYTES.byteLength),
        },
      });
      Object.defineProperty(response, "redirected", { configurable: true, value: true });
      return response;
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

describe("Social post image actionability", () => {
  test("returns only credential-free HTTPS images for share and save actions", () => {
    expect(
      primaryActionablePostImageUrl([
        "https://token@cdn.example.test/look.jpg",
        "javascript:alert(1)",
        IMAGE,
      ]),
    ).toBe(IMAGE);
    expect(
      primaryActionablePostImageUrl([
        "https://token@cdn.example.test/look.jpg",
        "file:///private/look.jpg",
      ]),
    ).toBeNull();
  });
});
