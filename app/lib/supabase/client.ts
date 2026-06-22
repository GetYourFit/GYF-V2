"use client";

import { createBrowserClient } from "@supabase/ssr";

import { supabaseEnv } from "./env";

/** The browser-side Supabase client (cookie-backed session). */
export function createSupabaseBrowserClient() {
  const { url, anonKey } = supabaseEnv();
  return createBrowserClient(url, anonKey);
}
