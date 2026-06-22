"use client";

import { createApi, type GyfApi } from "./api";
import { createSupabaseBrowserClient } from "./supabase/client";

// Binds the typed API client (app/lib/api.ts) to the live Supabase session so every
// request carries the user's JWT — which the FastAPI `auth.py` verifier already
// understands. The client itself stays Supabase-agnostic (and unit-testable); this
// is the one place the two are wired together.

let cached: GyfApi | null = null;

export function browserApi(): GyfApi {
  if (cached) return cached;
  const supabase = createSupabaseBrowserClient();
  cached = createApi(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  });
  return cached;
}
