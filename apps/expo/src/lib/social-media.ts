import { isRemoteImage } from "@/components/ui/catalog-image-url";

export type SocialMediaOutcome =
  | "success"
  | "requested"
  | "cancelled"
  | "invalid"
  | "unavailable"
  | "denied"
  | "failed";

export type SocialMediaResult = {
  outcome: SocialMediaOutcome;
  message: string;
};

export type ShareSurface = {
  native?: (url: string) => Promise<"shared" | "dismissed">;
  web?: (url: string) => Promise<"shared" | "dismissed">;
};

export type SaveSurface = {
  platform: "native" | "web" | "unsupported";
  requestPhotoPermission?: () => Promise<"granted" | "denied" | "blocked" | "unavailable">;
  /** Downloads, saves, and removes any temporary local file before it resolves. */
  saveNative?: (url: string) => Promise<void>;
  downloadWeb?: (url: string) => Promise<void>;
};

/** A post image is eligible only when it is a credential-free HTTPS URL. */
export function safePostImageUrl(url: string | null | undefined): string | null {
  return isRemoteImage(url) ? url : null;
}

export async function sharePostImage(
  url: string | null | undefined,
  surface: ShareSurface,
): Promise<SocialMediaResult> {
  const safeUrl = safePostImageUrl(url);
  if (!safeUrl) return { outcome: "invalid", message: "This post image is unavailable to share." };

  const share = surface.native ?? surface.web;
  if (!share) return { outcome: "unavailable", message: "Sharing is unavailable on this device." };
  try {
    const result = await share(safeUrl);
    return result === "dismissed"
      ? { outcome: "cancelled", message: "Sharing was dismissed before anything was sent." }
      : { outcome: "success", message: "Shared from your device." };
  } catch {
    return { outcome: "failed", message: "GYF could not open sharing. Try again." };
  }
}

export async function savePostImage(
  url: string | null | undefined,
  surface: SaveSurface,
): Promise<SocialMediaResult> {
  const safeUrl = safePostImageUrl(url);
  if (!safeUrl) return { outcome: "invalid", message: "This post image is unavailable to save." };

  if (surface.platform === "unsupported") {
    return { outcome: "unavailable", message: "Saving images is unavailable on this device." };
  }
  if (surface.platform === "web") {
    if (!surface.downloadWeb)
      return { outcome: "unavailable", message: "Downloading is unavailable in this browser." };
    try {
      await surface.downloadWeb(safeUrl);
      return {
        outcome: "requested",
        message: "GYF requested a browser download, but the browser did not confirm it saved.",
      };
    } catch {
      return { outcome: "failed", message: "GYF could not download this image. Try again." };
    }
  }

  if (!surface.requestPhotoPermission || !surface.saveNative) {
    return { outcome: "unavailable", message: "Saving images is unavailable on this device." };
  }
  let permission: "granted" | "denied" | "blocked" | "unavailable";
  try {
    permission = await surface.requestPhotoPermission();
  } catch {
    return { outcome: "unavailable", message: "Photos access is unavailable on this device." };
  }
  if (permission === "denied")
    return { outcome: "denied", message: "Photos permission was not granted." };
  if (permission === "blocked") {
    return {
      outcome: "denied",
      message: "Photos access is blocked. Allow it in settings to save this image.",
    };
  }
  if (permission === "unavailable") {
    return { outcome: "unavailable", message: "Photos access is unavailable on this device." };
  }
  try {
    await surface.saveNative(safeUrl);
    return { outcome: "success", message: "Image saved to your photos." };
  } catch {
    return {
      outcome: "failed",
      message: "GYF could not save this image. Check your connection and try again.",
    };
  }
}
