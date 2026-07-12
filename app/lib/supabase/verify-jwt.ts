import { createLocalJWKSet, jwtVerify, type JSONWebKeySet } from "jose";

import type { JwkSet } from "./jwks";

/** Verified JWT claims we rely on for the auth guard. */
export interface JwtClaims {
  sub: string;
  exp: number;
  [claim: string]: unknown;
}

/** Verify a Supabase access token locally and return its claims, or null if the
 *  token is malformed, signed with an unexpected algorithm/key, carries the wrong
 *  audience, or is expired.
 *
 *  Supabase signs access tokens with ES256 (asymmetric). We verify against the
 *  project's published JWKS with `jose` — a vetted, Edge-runtime-safe JOSE
 *  implementation — rather than supabase-js getClaims(), whose internal crypto
 *  path hangs in the Next.js Edge middleware runtime. jose is a pure local verify
 *  (no session/lock/network machinery), so it keeps that Edge fix while replacing
 *  the previous hand-rolled WebCrypto with a maintained library: it enforces the
 *  ES256 algorithm (no alg-confusion), selects the key by `kid`, and rejects
 *  expired/wrong-audience tokens. */
export async function verifyAccessToken(token: string, jwks: JwkSet): Promise<JwtClaims | null> {
  try {
    const keyset = createLocalJWKSet(jwks as unknown as JSONWebKeySet);
    const { payload } = await jwtVerify(token, keyset, {
      algorithms: ["ES256"],
      audience: "authenticated",
    });
    if (typeof payload.sub !== "string" || typeof payload.exp !== "number") return null;
    return payload as JwtClaims;
  } catch {
    return null;
  }
}
