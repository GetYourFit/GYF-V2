const MAX_POST_IMAGE_BYTES = 10 * 1024 * 1024;

const IMAGE_SIGNATURES = {
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png": [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  "image/webp": [[0x52, 0x49, 0x46, 0x46, -1, -1, -1, -1, 0x57, 0x45, 0x42, 0x50]],
  "image/gif": [
    [0x47, 0x49, 0x46, 0x38, 0x37, 0x61],
    [0x47, 0x49, 0x46, 0x38, 0x39, 0x61],
  ],
} as const satisfies Record<string, readonly number[][]>;

export type DownloadedPostImage = {
  bytes: Uint8Array;
  contentType: keyof typeof IMAGE_SIGNATURES;
};

function normalizeImageContentType(
  contentType: string | null,
): keyof typeof IMAGE_SIGNATURES | null {
  const normalized = contentType?.toLowerCase().split(";")[0]?.trim() ?? "";
  return normalized in IMAGE_SIGNATURES ? (normalized as keyof typeof IMAGE_SIGNATURES) : null;
}

function hasSignature(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((value, index) => value === -1 || bytes[index] === value);
}

export function isSupportedPostImageBytes(
  contentType: string | null,
  bytes: Uint8Array,
): contentType is keyof typeof IMAGE_SIGNATURES {
  const normalized = normalizeImageContentType(contentType);
  if (!normalized) return false;
  return IMAGE_SIGNATURES[normalized].some((signature) => hasSignature(bytes, signature));
}

export async function downloadValidatedPostImage(url: string): Promise<DownloadedPostImage> {
  const response = await fetch(url, { redirect: "error" });
  const contentType = normalizeImageContentType(response.headers.get("content-type"));
  const contentLength = Number(response.headers.get("content-length"));
  if (
    !response.ok ||
    response.redirected ||
    !contentType ||
    (Number.isFinite(contentLength) && contentLength > MAX_POST_IMAGE_BYTES)
  ) {
    throw new Error("Image download was unavailable");
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_POST_IMAGE_BYTES) {
    throw new Error("Image download was unavailable");
  }
  if (!isSupportedPostImageBytes(contentType, bytes)) {
    throw new Error("Image download was unavailable");
  }

  return { bytes, contentType };
}

export function imageExtension(url: string, contentType: string): string {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  if (contentType === "image/gif") return "gif";
  return /\.jpe?g(?:$|[?#])/i.test(url) ? "jpg" : "jpeg";
}
