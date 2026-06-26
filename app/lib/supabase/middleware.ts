import { NextResponse, type NextRequest } from "next/server";

import { supabaseEnv } from "./env";
import { getJwks } from "./jwks";
import { authStorageKey, readAccessToken } from "./session-token";
import { verifyAccessToken } from "./verify-jwt";

/** Auth guard for the product surface. Sends anonymous callers — and anyone whose
 *  session token is invalid or expired — to /login, preserving where they were
 *  headed via ?next=.
 *
 *  The token is read straight from the request cookie and its ES256 signature is
 *  verified **locally** against the project's JWKS (see ./verify-jwt): trustworthy
 *  (a forged or tampered token fails verification) and network-free on the request
 *  path. This deliberately avoids supabase-js's getUser()/getClaims(): getUser()
 *  makes a per-request round-trip to the auth server (~1-2.5s on free-tier) behind
 *  a process-global lock, so guarded sub-requests serialize and an aborted request
 *  wedges the lock — the intermittent "stuck on login"; and getClaims()'s crypto
 *  path hangs outright in the Edge middleware runtime. A direct WebCrypto verify
 *  is a sub-millisecond, lock-free, allocation-light check. Token refresh remains
 *  the browser client's responsibility, so nothing is lost here. */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const { url } = supabaseEnv();
  const token = readAccessToken(request, authStorageKey(url));

  let authed = false;
  if (token) {
    const jwks = await getJwks();
    authed = (await verifyAccessToken(token, jwks)) !== null;
  }

  if (!authed) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next({ request });
}
