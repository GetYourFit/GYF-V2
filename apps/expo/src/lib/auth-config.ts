export type SupabaseEnv = { url: string; anonKey: string };

export function readSupabaseEnv(
  values: Record<string, string | undefined> = {
    // Keep direct EXPO_PUBLIC_* references: Expo statically inlines these at export time.
    // Passing the whole `process.env` object defeats that replacement in web bundles.
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
): SupabaseEnv {
  const url = values.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = values.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) {
    throw new Error(
      "Supabase auth is not configured: set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY",
    );
  }
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(anonKey)) {
    throw new Error(
      "Supabase auth requires a current publishable key; legacy API keys are rejected",
    );
  }
  try {
    const parsed = new URL(url);
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
    if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && loopback))
      throw new Error();
  } catch {
    throw new Error("EXPO_PUBLIC_SUPABASE_URL must be an http(s) URL");
  }
  return { url, anonKey };
}
