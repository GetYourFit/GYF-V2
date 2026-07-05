const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** Resolve a catalog image path (e.g. "/media/x.jpg") returned by the API into an
 *  absolute URL the browser can load. Passes through already-absolute URLs.
 *
 *  `width` is a rendering hint: Shopify-hosted images resize/re-encode on the
 *  CDN via query params (a raw product photo is 300–600 KB where a 400px grid
 *  thumbnail is ~30 KB), so grid call sites pass ~400 and detail views ~800. */
export function mediaUrl(path: string | null | undefined, width?: number): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) {
    if (width && path.includes("cdn.shopify.com")) {
      return `${path}${path.includes("?") ? "&" : "?"}width=${width}`;
    }
    return path;
  }
  return `${API_BASE}${path}`;
}
