import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseClient } from "./auth";

export const AVATAR_BUCKET = "avatars";
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
export const AVATAR_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

type AvatarSlot = "a" | "b";

export type AvatarAsset = {
  base64?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  uri: string;
};

function validUserId(userId: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId);
}

// The key carries no extension on purpose. Native re-encodes every pick to JPEG, but Expo web
// hands back the file's real type untouched, so a fixed `.jpg` key would name PNG/WebP bytes as
// JPEG. Content-Type is the one honest carrier of the format; a slot is just a slot.
export function avatarObjectPath(userId: string, slot: AvatarSlot): string {
  if (!validUserId(userId)) throw new Error("invalid authenticated user id");
  if (slot !== "a" && slot !== "b") throw new Error("invalid avatar slot");
  return `${userId}/avatar-${slot}`;
}

export function ownedAvatarPathFromUrl(
  userId: string,
  url: string | null | undefined,
): string | null {
  if (!url || !validUserId(userId)) return null;
  try {
    const pathname = new URL(url).pathname;
    for (const slot of ["a", "b"] as const) {
      const path = avatarObjectPath(userId, slot);
      if (pathname.endsWith(`/${path}`)) return path;
    }
  } catch {
    return null;
  }
  return null;
}

export function inactiveAvatarPath(userId: string, previousUrl: string | null | undefined): string {
  return ownedAvatarPathFromUrl(userId, previousUrl) === avatarObjectPath(userId, "a")
    ? avatarObjectPath(userId, "b")
    : avatarObjectPath(userId, "a");
}

function decodedBase64Length(value: string): number | null {
  if (value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) return null;
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  return (value.length / 4) * 3 - padding;
}

export function validateAvatarAsset(asset: AvatarAsset): string | null {
  if (!asset.base64) return "The selected image could not be read. Try again.";
  if (
    !asset.mimeType ||
    !AVATAR_MIME_TYPES.includes(asset.mimeType as (typeof AVATAR_MIME_TYPES)[number])
  ) {
    return "Choose a JPEG, PNG, or WebP image.";
  }
  if (asset.fileSize != null && asset.fileSize > MAX_AVATAR_BYTES) {
    return "Choose an image smaller than 5 MB.";
  }
  const decodedLength = decodedBase64Length(asset.base64);
  if (decodedLength == null) return "The selected image could not be read. Try again.";
  if (decodedLength > MAX_AVATAR_BYTES) return "Choose an image smaller than 5 MB.";
  return null;
}

export function decodeBase64(value: string): ArrayBuffer {
  try {
    const binary = globalThis.atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes.buffer;
  } catch {
    throw new Error("The selected image could not be read. Try again.");
  }
}

async function removeAvatar(path: string, supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.storage.from(AVATAR_BUCKET).remove([path]);
  if (error) throw error;
}

export async function replaceAvatar(
  asset: AvatarAsset,
  userId: string,
  previousUrl: string | null | undefined,
  saveUrl: (url: string) => Promise<unknown>,
  supabase: SupabaseClient = getSupabaseClient(),
): Promise<string> {
  const validationError = validateAvatarAsset(asset);
  if (validationError) throw new Error(validationError);

  // Re-derived rather than reused from the check above so the type sent to Storage can only ever
  // be one this bucket allows — the picker is a trust boundary, not a source of truth.
  const contentType = AVATAR_MIME_TYPES.find((allowed) => allowed === asset.mimeType);
  if (!contentType) throw new Error("Choose a JPEG, PNG, or WebP image.");

  const targetPath = inactiveAvatarPath(userId, previousUrl);
  const previousPath = ownedAvatarPathFromUrl(userId, previousUrl);
  const bytes = decodeBase64(asset.base64!);
  if (bytes.byteLength > MAX_AVATAR_BYTES) throw new Error("Choose an image smaller than 5 MB.");

  const bucket = supabase.storage.from(AVATAR_BUCKET);
  const { error } = await bucket.upload(targetPath, bytes, {
    cacheControl: "3600",
    contentType,
    upsert: true,
  });
  if (error) throw error;
  const publicUrl = bucket.getPublicUrl(targetPath).data.publicUrl;
  const url = `${publicUrl}${publicUrl.includes("?") ? "&" : "?"}v=${Date.now()}`;

  try {
    await saveUrl(url);
  } catch (error) {
    await removeAvatar(targetPath, supabase).catch(() => undefined);
    throw error;
  }
  if (previousPath) await removeAvatar(previousPath, supabase).catch(() => undefined);
  return url;
}
