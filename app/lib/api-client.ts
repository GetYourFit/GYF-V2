"use client";

import { createApi, type GyfApi } from "./api";
import { clearViewCaches } from "./session-cache";
import { createSupabaseBrowserClient } from "./supabase/client";
import { supabaseEnv } from "./supabase/env";
import { accessTokenFromCookies, authStorageKey } from "./supabase/session-token";

// Binds the typed API client (app/lib/api.ts) to the live Supabase session so every
// request carries the user's JWT — which the FastAPI `auth.py` verifier already
// understands. The client itself stays Supabase-agnostic (and unit-testable); this
// is the one place the two are wired together.
//
// Token strategy: read the access token straight from the @supabase/ssr session
// cookie. supabase-js `getSession()` acquires a navigator.locks/process lock that
// has been observed to hang for 20s+ in production (same failure the Edge
// middleware hit — see ./supabase/session-token.ts), and with getToken() at the
// front of EVERY api call that stall made the whole app look dead. getSession()
// is kept only as a time-boxed fallback for the expired-token case, because it is
// what triggers the refresh-token exchange.

let cached: GyfApi | null = null;

function cookieJar(): (name: string) => string | undefined {
  const jar = new Map<string, string>();
  for (const part of document.cookie.split("; ")) {
    const eq = part.indexOf("=");
    if (eq > 0) jar.set(part.slice(0, eq), decodeURIComponent(part.slice(eq + 1)));
  }
  return (name) => jar.get(name);
}

/** JWT `exp` (seconds since epoch), or null if the token is unparseable. */
function tokenExp(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const exp = (JSON.parse(json) as { exp?: unknown }).exp;
    return typeof exp === "number" ? exp : null;
  } catch {
    return null;
  }
}

export function browserApi(): GyfApi {
  if (cached) return cached;
  const supabase = createSupabaseBrowserClient();
  const storageKey = authStorageKey(supabaseEnv().url);

  const getSessionToken = async (): Promise<string | null> => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  };

  const api = createApi(async () => {
    const token = accessTokenFromCookies(cookieJar(), storageKey);
    const exp = token ? tokenExp(token) : null;
    // Fresh (>60s of life left): use it without touching supabase-js at all.
    if (token && exp !== null && exp * 1000 > Date.now() + 60_000) return token;
    // Missing or near expiry: let supabase-js refresh, but never let its lock
    // hang the request — after 3s, fall back to the cookie token (a slightly
    // stale token that 401s beats an app that never fetches).
    return Promise.race([
      getSessionToken(),
      new Promise<string | null>((resolve) => setTimeout(() => resolve(token), 3_000)),
    ]).catch(() => token);
  });

  // Profile mutations invalidate every cached view — a feed/grid cached for the
  // old profile (gender, region, body, tone) must not repaint on back-nav.
  const putProfile = api.putProfile.bind(api);
  api.putProfile = async (input) => {
    const profile = await putProfile(input);
    clearViewCaches();
    return profile;
  };
  const uploadPhoto = api.uploadPhoto.bind(api);
  api.uploadPhoto = async (file) => {
    const profile = await uploadPhoto(file);
    clearViewCaches();
    return profile;
  };

  cached = api;
  return cached;
}
