import { describe, expect, test } from "bun:test";

import {
  AVATAR_BUCKET,
  MAX_AVATAR_BYTES,
  avatarObjectPath,
  decodeBase64,
  inactiveAvatarPath,
  ownedAvatarPathFromUrl,
  replaceAvatar,
  validateAvatarAsset,
} from "./avatar-upload";

const USER_ID = "123e4567-e89b-42d3-a456-426614174000";
const CDN = `https://cdn.test/storage/v1/object/public/${AVATAR_BUCKET}`;
const asset = (overrides: Record<string, unknown> = {}) => ({
  base64: "aGVsbG8=",
  mimeType: "image/jpeg",
  uri: "file:///avatar.jpg",
  ...overrides,
});

function storageMock(options: { uploadError?: Error; removeError?: Error } = {}) {
  const uploads: unknown[][] = [];
  const removes: string[][] = [];
  return {
    removes,
    storage: {
      from(bucket: string) {
        expect(bucket).toBe(AVATAR_BUCKET);
        return {
          upload: async (...args: unknown[]) => {
            uploads.push(args);
            return { error: options.uploadError ?? null };
          },
          getPublicUrl: (path: string) => ({ data: { publicUrl: `${CDN}/${path}` } }),
          remove: async (paths: string[]) => {
            removes.push(paths);
            return { error: options.removeError ?? null };
          },
        };
      },
    },
    uploads,
  };
}

describe("avatar upload boundaries", () => {
  test("alternates only between exact owner slots, ignoring URL query", () => {
    const a = avatarObjectPath(USER_ID, "a");
    const b = avatarObjectPath(USER_ID, "b");
    expect(inactiveAvatarPath(USER_ID, null)).toBe(a);
    expect(inactiveAvatarPath(USER_ID, `${CDN}/${a}?old-cache-key=7`)).toBe(b);
    expect(inactiveAvatarPath(USER_ID, `${CDN}/${b}?download=1`)).toBe(a);
    expect(ownedAvatarPathFromUrl(USER_ID, `${CDN}/${a}?v=7`)).toBe(a);
    // Same key shape, different owner: only the uuid prefix separates it from a real slot.
    expect(inactiveAvatarPath(USER_ID, `${CDN}/other-user/avatar-a`)).toBe(a);
    expect(() => avatarObjectPath(USER_ID, "c" as never)).toThrow("invalid avatar slot");
  });

  test("rejects missing MIME, unsupported, unreadable, and oversized picker assets", () => {
    expect(validateAvatarAsset(asset({ mimeType: undefined }))).toContain("JPEG");
    expect(validateAvatarAsset(asset({ mimeType: "image/gif" }))).toContain("JPEG");
    expect(validateAvatarAsset(asset({ base64: null }))).toContain("read");
    expect(validateAvatarAsset(asset({ fileSize: MAX_AVATAR_BYTES + 1 }))).toContain("5 MB");
  });

  test("rejects encoded oversize before decoding and rejects invalid base64", async () => {
    const originalAtob = globalThis.atob;
    let decoded = false;
    globalThis.atob = () => {
      decoded = true;
      throw new Error("must not decode");
    };
    try {
      const oversized = "A".repeat(Math.ceil((MAX_AVATAR_BYTES + 1) / 3) * 4);
      const mock = storageMock();
      await expect(
        replaceAvatar(asset({ base64: oversized }), USER_ID, null, async () => {}, {
          storage: mock.storage,
        } as never),
      ).rejects.toThrow("5 MB");
      expect(decoded).toBe(false);
      expect(mock.uploads).toHaveLength(0);
    } finally {
      globalThis.atob = originalAtob;
    }
    expect(validateAvatarAsset(asset({ base64: "not base64" }))).toContain("read");
    expect(() => decodeBase64("%%%=")).toThrow("could not be read");
  });

  test("uploads the inactive slot, saves it, then removes the old slot", async () => {
    const oldPath = avatarObjectPath(USER_ID, "a");
    const nextPath = avatarObjectPath(USER_ID, "b");
    const mock = storageMock();
    const saved: string[] = [];
    const url = await replaceAvatar(
      asset(),
      USER_ID,
      `${CDN}/${oldPath}?v=old`,
      async (nextUrl) => saved.push(nextUrl),
      { storage: mock.storage } as never,
    );
    expect(url).toMatch(new RegExp(`${nextPath}\\?v=\\d+$`));
    expect(saved).toEqual([url]);
    expect(mock.uploads[0][0]).toBe(nextPath);
    expect((mock.uploads[0][1] as ArrayBuffer).byteLength).toBe(5);
    expect(mock.uploads[0][2]).toMatchObject({ contentType: "image/jpeg", upsert: true });
    expect(mock.removes).toEqual([[oldPath]]);
  });

  // Expo web hands back the picked file's real type, so storing every pick as image/jpeg would
  // serve PNG/WebP bytes under a lying Content-Type. The stored type must follow the real one.
  test("stores each allowed format under its own true Content-Type", async () => {
    for (const mimeType of ["image/png", "image/webp"] as const) {
      const mock = storageMock();
      await replaceAvatar(asset({ mimeType }), USER_ID, null, async () => {}, {
        storage: mock.storage,
      } as never);
      expect(mock.uploads[0][2]).toMatchObject({ contentType: mimeType });
    }
  });

  test("refuses a format the avatars bucket does not allow, even if the picker offers it", async () => {
    const mock = storageMock();
    await expect(
      replaceAvatar(asset({ mimeType: "image/svg+xml" }), USER_ID, null, async () => {}, {
        storage: mock.storage,
      } as never),
    ).rejects.toThrow("JPEG");
    expect(mock.uploads).toHaveLength(0);
  });

  test("deletes the new slot when profile persistence fails and keeps the old slot", async () => {
    const oldPath = avatarObjectPath(USER_ID, "a");
    const nextPath = avatarObjectPath(USER_ID, "b");
    const mock = storageMock();
    const failure = new Error("profile write failed");
    await expect(
      replaceAvatar(
        asset(),
        USER_ID,
        `${CDN}/${oldPath}`,
        async () => {
          throw failure;
        },
        { storage: mock.storage } as never,
      ),
    ).rejects.toBe(failure);
    expect(mock.removes).toEqual([[nextPath]]);
  });

  test("fails before storage for a forged user path", async () => {
    await expect(
      replaceAvatar(asset(), "../../other-user", null, async () => {}, { storage: {} } as never),
    ).rejects.toThrow("invalid authenticated user id");
  });
});
