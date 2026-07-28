import { isRemoteImage } from "@/components/ui/catalog-image-url";

export type SocialMediaOutcome = "success" | "invalid" | "unavailable" | "denied" | "failed";

export type SocialMediaResult = {
  outcome: SocialMediaOutcome;
  message: string;
};

export type ShareSurface = {
  native?: (url: string) => Promise<void>;
  web?: (url: string) => Promise<void>;
};

export type SaveSurface = {
  platform: "native" | "web" | "unsupported";
  requestPhotoPermission?: () => Promise<"granted" | "denied" | "unavailable">;
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
    await share(safeUrl);
    return { outcome: "success", message: "Share sheet opened." };
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
      return { outcome: "success", message: "Image download started." };
    } catch {
      return { outcome: "failed", message: "GYF could not download this image. Try again." };
    }
  }

  if (!surface.requestPhotoPermission || !surface.saveNative) {
    return { outcome: "unavailable", message: "Saving images is unavailable on this device." };
  }
  let permission: "granted" | "denied" | "unavailable";
  try {
    permission = await surface.requestPhotoPermission();
  } catch {
    return { outcome: "unavailable", message: "Photos access is unavailable on this device." };
  }
  if (permission === "denied")
    return { outcome: "denied", message: "Photos permission was not granted." };
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
