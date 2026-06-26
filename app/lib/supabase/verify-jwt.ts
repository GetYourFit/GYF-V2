import type { JwkSet } from "./jwks";

/** Verified JWT claims we rely on for the auth guard. */
export interface JwtClaims {
  sub: string;
  exp: number;
  [claim: string]: unknown;
}

/** Decode a base64url segment to bytes (Edge-runtime safe — no Buffer). */
function base64UrlToBytes(segment: string): Uint8Array<ArrayBuffer> {
  let b64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4;
  if (pad) b64 += "=".repeat(4 - pad);
  const binary = atob(b64);
  // Build over an explicit ArrayBuffer (not Uint8Array.from, which infers
  // ArrayBufferLike) so the result satisfies WebCrypto's BufferSource.
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeJson(segment: string): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(segment)));
}

/** Verify a Supabase access token locally and return its claims, or null if the
 *  token is malformed, signed with an unexpected algorithm/key, has a bad
 *  signature, or is expired.
 *
 *  Supabase signs access tokens with ES256 (asymmetric). We verify the signature
 *  against the project's published JWKS using WebCrypto directly — not via
 *  supabase-js getClaims(), whose internal crypto path hangs in the Next.js Edge
 *  middleware runtime. A direct crypto.subtle import+verify is reliable there and
 *  keeps the guard free of any session/lock machinery. JWT ES256 signatures are
 *  raw r‖s (64 bytes), exactly the form WebCrypto's ECDSA verify expects. */
export async function verifyAccessToken(
  token: string,
  jwks: JwkSet,
): Promise<JwtClaims | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerSeg, payloadSeg, signatureSeg] = parts;

  let header: Record<string, unknown>;
  let payload: Record<string, unknown>;
  try {
    header = decodeJson(headerSeg);
    payload = decodeJson(payloadSeg);
  } catch {
    return null;
  }

  // Only asymmetric ES256 is verifiable locally; reject anything else rather than
  // trusting an unverifiable token.
  if (header.alg !== "ES256") return null;

  const jwk = jwks.keys.find((k) => k.kid === header.kid) ?? jwks.keys[0];
  if (!jwk) return null;

  let valid = false;
  try {
    const key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    const signed = new Uint8Array(new TextEncoder().encode(`${headerSeg}.${payloadSeg}`));
    valid = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      base64UrlToBytes(signatureSeg),
      signed,
    );
  } catch {
    return null;
  }
  if (!valid) return null;

  const { exp, sub, aud } = payload;
  if (typeof exp !== "number" || typeof sub !== "string") return null;
  // Only accept user-session tokens: reject service-role / other audiences that
  // share the project's signing key but must not grant a user session.
  if (aud !== "authenticated") return null;
  if (Date.now() >= exp * 1000) return null; // expired

  return payload as JwtClaims;
}
