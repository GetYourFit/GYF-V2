import { describe, expect, test } from "bun:test";
import type { ImagePickerAsset } from "expo-image-picker";

import { GyfApi, type components, type SystemStatus } from "./api";
import {
  MAX_PROFILE_PHOTO_BYTES,
  uploadProfilePhoto,
  validateProfilePhotoAsset,
} from "./profile-photo";

const BASE64 = "aGVsbG8=";
type ProfilePhotoResponse = components["schemas"]["ProfilePhotoResponse"];

const asset = (overrides: Partial<ImagePickerAsset> = {}): ImagePickerAsset => ({
  base64: BASE64,
  fileName: "me.jpg",
  fileSize: 5,
  height: 100,
  mimeType: "image/jpeg",
  type: "image",
  uri: "file:///me.jpg",
  width: 100,
  ...overrides,
});

const status = (body: string, skin: string): SystemStatus =>
  ({
    capabilities: {
      photo_body_type: { status: body },
      photo_skin_tone: { status: skin },
    },
  }) as unknown as SystemStatus;

function api(photoAnalysis: Partial<ProfilePhotoResponse["photo_analysis"]> = {}) {
  const uploads: unknown[] = [];
  return {
    uploads,
    systemStatus: async () => status("live", "beta"),
    uploadPhoto: async (photo: unknown) => {
      uploads.push(photo);
      return {
        source: "photo",
        skin_tone: "mst1",
        body_type: "oval",
        field_confidence: { skin_tone: 1, body_type: 1 },
        photo_analysis: {
          state: "abstained",
          skin_tone: null,
          undertone: null,
          body_type: null,
          measurements: {},
          field_confidence: {},
          reason: "Use the manual fields.",
          ...photoAnalysis,
        },
      } as ProfilePhotoResponse;
    },
  };
}

describe("profile photo boundary", () => {
  test("rejects unsupported MIME before transport", () => {
    expect(validateProfilePhotoAsset(asset({ mimeType: "image/gif" }))).toContain(
      "JPEG, PNG, or WebP",
    );
  });

  test("rejects picker assets without readable bytes", () => {
    expect(validateProfilePhotoAsset(asset({ base64: null, file: undefined }))).toContain("read");
  });

  test("rejects invalid base64 shape and padding before transport", () => {
    expect(validateProfilePhotoAsset(asset({ base64: "not base64" }))).toContain("read");
    expect(validateProfilePhotoAsset(asset({ base64: "A===" }))).toContain("read");
  });

  test("rejects declared and encoded payloads over 10 MiB", () => {
    expect(validateProfilePhotoAsset(asset({ fileSize: MAX_PROFILE_PHOTO_BYTES + 1 }))).toContain(
      "10 MB",
    );
    expect(
      validateProfilePhotoAsset(
        asset({
          fileSize: undefined,
          base64: "A".repeat(Math.ceil((MAX_PROFILE_PHOTO_BYTES + 1) / 3) * 4),
        }),
      ),
    ).toContain("10 MB");
  });

  test("requires both photo capabilities and never uploads on a closed or unreadable gate", async () => {
    for (const capabilities of [status("live", "shadow"), status("planned", "beta")]) {
      const client = api();
      client.systemStatus = async () => capabilities;
      await expect(uploadProfilePhoto(client, asset())).rejects.toThrow(
        "Photo analysis is unavailable",
      );
      expect(client.uploads).toHaveLength(0);
    }

    const client = api();
    client.systemStatus = async () => {
      throw new Error("status response leaked internal detail");
    };
    await expect(uploadProfilePhoto(client, asset())).rejects.toThrow(
      "Photo analysis is unavailable",
    );
    expect(client.uploads).toHaveLength(0);
  });

  test("preserves a body-only result as partial", async () => {
    const client = api({
      state: "partial",
      body_type: "hourglass",
      measurements: { waist: 0.24 },
      field_confidence: { body_type: 0.8, measurements: 0.8 },
      reason: "Review the estimate and complete the missing field manually.",
    });
    await expect(uploadProfilePhoto(client, asset())).resolves.toEqual({
      state: "partial",
      skin_tone: null,
      undertone: null,
      body_type: "hourglass",
      measurements: { waist: 0.24 },
      field_confidence: { body_type: 0.8, measurements: 0.8 },
      reason: "Review the estimate and complete the missing field manually.",
    });
    expect(client.uploads).toEqual([{ uri: "file:///me.jpg", name: "me.jpg", type: "image/jpeg" }]);
  });

  test("preserves a skin-only result as partial", async () => {
    const client = api({
      state: "partial",
      skin_tone: "mst7",
      undertone: "warm",
      field_confidence: { skin_tone: 0.7, undertone: 0.7 },
      reason: "Review the estimate and complete the missing field manually.",
    });
    await expect(uploadProfilePhoto(client, asset())).resolves.toEqual({
      state: "partial",
      skin_tone: "mst7",
      undertone: "warm",
      body_type: null,
      measurements: {},
      field_confidence: { skin_tone: 0.7, undertone: 0.7 },
      reason: "Review the estimate and complete the missing field manually.",
    });
  });

  test("preserves an honest abstention without inventing an estimate", async () => {
    await expect(uploadProfilePhoto(api(), asset())).resolves.toEqual({
      state: "abstained",
      skin_tone: null,
      undertone: null,
      body_type: null,
      measurements: {},
      field_confidence: {},
      reason: "Use the manual fields.",
    });
  });

  test("replaces server details with a safe retry and manual-fallback error", async () => {
    const client = api();
    client.uploadPhoto = async () => {
      throw new Error("postgres host and private model name");
    };
    const error = await uploadProfilePhoto(client, asset()).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(
      "Photo analysis failed. Try again or continue with the manual fields.",
    );
    expect((error as Error).message).not.toContain("postgres");
  });

  test("returns a typed complete result through the authenticated shared multipart transport", async () => {
    const originalFetch = globalThis.fetch;
    const calls: Array<[string, RequestInit | undefined]> = [];
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      calls.push([String(input), init]);
      if (String(input).endsWith("/system/status")) {
        return Response.json(status("live", "beta"));
      }
      return Response.json({
        source: "photo",
        skin_tone: "mst1",
        body_type: "oval",
        field_confidence: { skin_tone: 1, body_type: 1 },
        photo_analysis: {
          state: "completed",
          skin_tone: "mst4",
          undertone: "neutral",
          body_type: "rectangle",
          measurements: { shoulders: 0.42 },
          field_confidence: {
            skin_tone: 0.75,
            undertone: 0.7,
            body_type: 0.85,
            measurements: 0.8,
          },
          reason: "Review both estimates before continuing.",
        },
      });
    }) as typeof fetch;

    try {
      const file = new File(["hello"], "me.jpg", { type: "image/jpeg" });
      const result = await uploadProfilePhoto(
        new GyfApi(() => "jwt-photo", "https://api.test"),
        asset({ file }),
      );

      expect(result).toEqual({
        state: "completed",
        skin_tone: "mst4",
        undertone: "neutral",
        body_type: "rectangle",
        measurements: { shoulders: 0.42 },
        field_confidence: {
          skin_tone: 0.75,
          undertone: 0.7,
          body_type: 0.85,
          measurements: 0.8,
        },
        reason: "Review both estimates before continuing.",
      });
      expect(calls.map(([url]) => url)).toEqual([
        "https://api.test/system/status",
        "https://api.test/profile/photo",
      ]);
      const headers = new Headers(calls[1][1]?.headers);
      expect(headers.get("Authorization")).toBe("Bearer jwt-photo");
      expect(headers.has("Content-Type")).toBe(false);
      expect(calls[1][1]?.body).toBeInstanceOf(FormData);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
