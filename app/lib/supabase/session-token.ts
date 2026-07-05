import type { NextRequest } from "next/server";

const BASE64_PREFIX = "base64-";

/** UTF-8-correct base64url decode that works in the Edge runtime (no Buffer). */
function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Read the Supabase access token directly out of the request cookies.
 *
 *  @supabase/ssr persists the session as `<storageKey>` — or, when it exceeds the
 *  per-cookie size limit, split across `<storageKey>.0`, `.1`, … — with the value
 *  encoded as `base64-<base64url(JSON session)>`. We reassemble and decode that
 *  here so the auth guard can verify the JWT *without* constructing a stateful
 *  GoTrueClient session (whose getSession()/lock machinery hangs in the Edge
 *  middleware runtime). Returns null when no well-formed session cookie is present
 *  — the caller then treats the request as anonymous. */
export function readAccessToken(request: NextRequest, storageKey: string): string | null {
  return accessTokenFromCookies((name) => request.cookies.get(name)?.value, storageKey);
}

/** Core of {@link readAccessToken}, generic over the cookie jar so the browser
 *  (document.cookie) and the Edge middleware (NextRequest) share one parser. */
export function accessTokenFromCookies(
  getCookie: (name: string) => string | undefined,
  storageKey: string,
): string | null {
  let encoded = getCookie(storageKey);
  if (encoded === undefined) {
    const chunks: string[] = [];
    for (let i = 0; ; i += 1) {
      const chunk = getCookie(`${storageKey}.${i}`);
      if (chunk === undefined) break;
      chunks.push(chunk);
    }
    if (chunks.length === 0) return null;
    encoded = chunks.join("");
  }
  if (!encoded) return null;

  try {
    const json = encoded.startsWith(BASE64_PREFIX)
      ? decodeBase64Url(encoded.slice(BASE64_PREFIX.length))
      : encoded;
    const session = JSON.parse(json) as { access_token?: unknown };
    return typeof session.access_token === "string" ? session.access_token : null;
  } catch {
    return null;
  }
}

/** The cookie name @supabase/ssr stores the session under: `sb-<project-ref>-auth-token`,
 *  where the ref is the subdomain of the project URL. */
export function authStorageKey(supabaseUrl: string): string {
  const ref = new URL(supabaseUrl).hostname.split(".")[0];
  return `sb-${ref}-auth-token`;
}
