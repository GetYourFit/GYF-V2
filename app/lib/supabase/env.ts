// Supabase configuration, read at call time (never at module load) so the app
// builds/typechecks without secrets and fails fast with a clear message at runtime
// when they're missing.

export interface SupabaseEnv {
  url: string;
  anonKey: string;
}

export function supabaseEnv(): SupabaseEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY (see .env.example).",
    );
  }
  return { url, anonKey };
}
