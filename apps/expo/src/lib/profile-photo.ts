import type { ImagePickerAsset } from "expo-image-picker";

import type { GyfApi, UploadProgress } from "./api";
import { capabilityUsable } from "./system-status";

export const MAX_PROFILE_PHOTO_BYTES = 10 * 1024 * 1024;
export const MAX_PROFILE_PHOTO_PIXELS = 40_000_000;
const MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type ProfilePhotoEstimate = Readonly<{
  state: "completed" | "partial" | "abstained";
  skin_tone: string | null;
  undertone: string | null;
  body_type: string | null;
  measurements: Readonly<Record<string, number>>;
  field_confidence: Readonly<Record<string, number>>;
  reason: string;
}>;

function decodedBase64Length(value: string): number | null {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) return null;
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  return (value.length / 4) * 3 - padding;
}

export function validateProfilePhotoAsset(asset: ImagePickerAsset): string | null {
  const mimeType = MIME_TYPES.find((type) => type === asset.mimeType?.toLowerCase());
  if (!mimeType) return "Choose a JPEG, PNG, or WebP image.";
  if (
    !Number.isFinite(asset.width) ||
    !Number.isFinite(asset.height) ||
    asset.width <= 0 ||
    asset.height <= 0
  )
    return "The selected image has no readable dimensions. Try another image.";
  if (asset.width * asset.height > MAX_PROFILE_PHOTO_PIXELS)
    return "Choose an image with fewer than 40 megapixels.";
  if (asset.fileSize != null && asset.fileSize > MAX_PROFILE_PHOTO_BYTES)
    return "Choose an image smaller than 10 MB.";
  if (asset.fileSize === 0) return "The selected image could not be read. Try again.";

  if (asset.file) {
    if (!asset.file.size || asset.file.type.toLowerCase() !== mimeType)
      return "The selected image could not be read. Try again.";
    if (asset.file.size > MAX_PROFILE_PHOTO_BYTES) return "Choose an image smaller than 10 MB.";
  }

  if (asset.base64 != null) {
    if (asset.base64.length % 4 === 0) {
      const padding = asset.base64.endsWith("==") ? 2 : asset.base64.endsWith("=") ? 1 : 0;
      if ((asset.base64.length / 4) * 3 - padding > MAX_PROFILE_PHOTO_BYTES)
        return "Choose an image smaller than 10 MB.";
    }
    const length = decodedBase64Length(asset.base64);
    if (!length) return "The selected image could not be read. Try again.";
    if (length > MAX_PROFILE_PHOTO_BYTES) return "Choose an image smaller than 10 MB.";
    try {
      if (globalThis.atob(asset.base64).length !== length)
        return "The selected image could not be read. Try again.";
    } catch {
      return "The selected image could not be read. Try again.";
    }
  } else if (!asset.uri) {
    return "The selected image could not be read. Try again.";
  }
  return null;
}

export async function uploadProfilePhoto(
  api: Pick<GyfApi, "systemStatus" | "uploadPhoto">,
  asset: ImagePickerAsset,
  signal?: AbortSignal,
  onProgress?: UploadProgress,
): Promise<ProfilePhotoEstimate> {
  const validationError = validateProfilePhotoAsset(asset);
  if (validationError) throw new Error(validationError);

  let status;
  try {
    status = await api.systemStatus();
  } catch {
    throw new Error("Photo analysis is unavailable. Continue with the manual fields.");
  }
  // The modules are independent. A live body lane may return a body-only
  // partial result while tone abstains (and vice versa); the manual field for
  // the missing signal remains required and editable.
  if (
    !capabilityUsable(status, "photo_body_type") &&
    !capabilityUsable(status, "photo_skin_tone")
  ) {
    throw new Error("Photo analysis is unavailable. Continue with the manual fields.");
  }

  const mimeType = MIME_TYPES.find((type) => type === asset.mimeType?.toLowerCase())!;
  const photo =
    asset.file ??
    ({
      uri: asset.uri,
      name: asset.fileName || `profile-photo.${mimeType.split("/")[1]}`,
      type: mimeType,
    } as const);
  try {
    const { photo_analysis: analysis } = await api.uploadPhoto(photo, signal, onProgress);
    return {
      state: analysis.state,
      skin_tone: analysis.skin_tone ?? null,
      undertone: analysis.undertone ?? null,
      body_type: analysis.body_type ?? null,
      measurements: { ...analysis.measurements },
      field_confidence: { ...analysis.field_confidence },
      reason: analysis.reason,
    };
  } catch (cause) {
    if ((cause as { name?: string } | null)?.name === "AbortError") throw cause;
    throw new Error("Photo analysis failed. Try again or continue with the manual fields.");
  }
}
