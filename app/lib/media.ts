const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** Resolve a catalog image path (e.g. "/media/x.jpg") returned by the API into an
 *  absolute URL the browser can load. Passes through already-absolute URLs. */
export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE}${path}`;
}
