import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

import { supabaseEnv } from "./env";

/** The server-side Supabase client (Server Components, Route Handlers, Actions).
 *
 *  Writes to the cookie store are wrapped in try/catch: when called from a Server
 *  Component the store is read-only, and the session is instead refreshed by the
 *  middleware on the next request — the documented @supabase/ssr pattern. */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = supabaseEnv();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component — middleware refreshes the session.
        }
      },
    },
  });
}
