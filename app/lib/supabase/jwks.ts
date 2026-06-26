import { supabaseEnv } from "./env";

/** A JSON Web Key Set, the public keys that verify asymmetric (ES256) Supabase
 *  JWTs. Typed structurally so we don't depend on a non-root auth-js export. */
export type JwkSet = { keys: Array<JsonWebKey & { kid?: string }> };

// Supabase signs JWTs with an asymmetric key and publishes the public half at
// /.well-known/jwks.json. Verifying a token's signature against it is purely
// local (WebCrypto) — *if* the key set is already in hand. supabase-js caches it
// per client instance, but each guarded request builds a throwaway server client,
// so without this module-level cache every request re-fetches the JWKS over the
// network; under concurrency those fetches stack up and stall (the "stuck on
// login" hang). Caching the key set process-wide makes auth verification a
// sub-millisecond local operation with no per-request I/O.
const TTL_MS = 10 * 60_000; // re-fetch every 10 min to pick up key rotation
const FETCH_TIMEOUT_MS = 5_000;

let cache: { jwks: JwkSet; at: number } | null = null;
let inflight: Promise<JwkSet> | null = null;

async function fetchJwks(): Promise<JwkSet> {
  const { url, anonKey } = supabaseEnv();
  const res = await fetch(`${url}/auth/v1/.well-known/jwks.json`, {
    headers: { apikey: anonKey },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
  return (await res.json()) as JwkSet;
}

/** The Supabase JWKS, served from a process-wide cache. Refreshes after a TTL,
 *  de-duplicates concurrent refreshes (one fetch fans out to all callers), and
 *  falls back to a stale copy if a refresh fails — so a flaky discovery endpoint
 *  degrades gracefully instead of locking everyone out. */
export async function getJwks(): Promise<JwkSet> {
  const fresh = cache && Date.now() - cache.at < TTL_MS;
  if (fresh) return cache!.jwks;
  if (inflight) return inflight;

  inflight = fetchJwks()
    .then((jwks) => {
      cache = { jwks, at: Date.now() };
      return jwks;
    })
    .catch((err) => {
      if (cache) return cache.jwks; // serve stale rather than fail auth outright
      throw err;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}
