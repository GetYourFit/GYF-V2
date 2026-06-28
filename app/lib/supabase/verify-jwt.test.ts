import { describe, expect, it } from "vitest";

import type { JwkSet } from "./jwks";
import { verifyAccessToken } from "./verify-jwt";

// --- Test helpers: mint a real ES256-signed JWT so we exercise actual WebCrypto
// verification (no mocks), mirroring how Supabase signs access tokens. ---

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlJson(value: unknown): string {
  return b64url(enc.encode(JSON.stringify(value)));
}

async function makeKeyAndJwks(): Promise<{ key: CryptoKey; jwks: JwkSet; kid: string }> {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ]);
  const kid = "test-key-1";
  const publicJwk = (await crypto.subtle.exportKey("jwk", pair.publicKey)) as JsonWebKey & {
    kid?: string;
  };
  publicJwk.kid = kid;
  return { key: pair.privateKey, jwks: { keys: [publicJwk] }, kid };
}

async function signJwt(
  privateKey: CryptoKey,
  kid: string,
  payload: Record<string, unknown>,
  alg = "ES256",
): Promise<string> {
  const head = b64urlJson({ alg, typ: "JWT", kid });
  // Real Supabase user-session tokens carry aud "authenticated"; verifyAccessToken
  // requires it, so default it here (callers may override via payload).
  const body = b64urlJson({ aud: "authenticated", ...payload });
  const sig = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      privateKey,
      enc.encode(`${head}.${body}`),
    ),
  );
  return `${head}.${body}.${b64url(sig)}`;
}

const future = () => Math.floor(Date.now() / 1000) + 3600;
const past = () => Math.floor(Date.now() / 1000) - 10;

describe("verifyAccessToken", () => {
  it("accepts a valid, correctly-signed, unexpired token", async () => {
    const { key, jwks, kid } = await makeKeyAndJwks();
    const token = await signJwt(key, kid, { sub: "user-123", exp: future() });
    const claims = await verifyAccessToken(token, jwks);
    expect(claims?.sub).toBe("user-123");
  });

  it("rejects a token whose payload was tampered with after signing", async () => {
    const { key, jwks, kid } = await makeKeyAndJwks();
    const token = await signJwt(key, kid, { sub: "user-123", exp: future() });
    const [h, , s] = token.split(".");
    const forgedPayload = b64urlJson({ sub: "admin", exp: future() });
    expect(await verifyAccessToken(`${h}.${forgedPayload}.${s}`, jwks)).toBeNull();
  });

  it("rejects a token signed by a different key", async () => {
    const signer = await makeKeyAndJwks();
    const other = await makeKeyAndJwks();
    const token = await signJwt(signer.key, signer.kid, { sub: "user-123", exp: future() });
    expect(await verifyAccessToken(token, other.jwks)).toBeNull();
  });

  it("rejects an expired token", async () => {
    const { key, jwks, kid } = await makeKeyAndJwks();
    const token = await signJwt(key, kid, { sub: "user-123", exp: past() });
    expect(await verifyAccessToken(token, jwks)).toBeNull();
  });

  it("rejects a token with a non-ES256 alg (no algorithm confusion)", async () => {
    const { key, jwks, kid } = await makeKeyAndJwks();
    const token = await signJwt(key, kid, { sub: "user-123", exp: future() }, "HS256");
    expect(await verifyAccessToken(token, jwks)).toBeNull();
  });

  it("rejects malformed tokens", async () => {
    const { jwks } = await makeKeyAndJwks();
    expect(await verifyAccessToken("not-a-jwt", jwks)).toBeNull();
    expect(await verifyAccessToken("a.b", jwks)).toBeNull();
    expect(await verifyAccessToken("", jwks)).toBeNull();
  });
});
