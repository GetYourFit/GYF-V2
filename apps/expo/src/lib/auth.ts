import type {
  AuthChangeEvent,
  AuthResponse,
  AuthTokenResponse,
  Session,
  SupabaseClient,
  UserResponse,
} from "@supabase/supabase-js";

import { clearAuthStorage, secureStorage, type AuthStorage, AUTH_STORAGE_KEY } from "./storage";
import { readSupabaseEnv, type SupabaseEnv } from "./auth-config";

export { readSupabaseEnv } from "./auth-config";
export type { SupabaseEnv } from "./auth-config";

let client: SupabaseClient | null = null;
let clientRequest: Promise<SupabaseClient> | null = null;
let sessionRequest: Promise<Session | null> | null = null;

export function getSupabaseClient(storage: AuthStorage = secureStorage): Promise<SupabaseClient> {
  if (client) return Promise.resolve(client);
  if (clientRequest) return clientRequest;
  clientRequest = import("@supabase/supabase-js").then(({ createClient }) => {
    if (client) return client;
    const { url, anonKey } = readSupabaseEnv();
    client = createClient(url, anonKey, {
      auth: {
        autoRefreshToken: true,
        // PKCE (not implicit) so recovery links carry an opaque `?code=` query param
        // instead of tokens in the URL fragment. detectSessionInUrl stays false on
        // both native and web: RN has no window.location to parse, so the code is
        // pulled from expo-router's parsed params instead (see resolveRecoverySession).
        detectSessionInUrl: false,
        flowType: "pkce",
        persistSession: true,
        storage,
        storageKey: AUTH_STORAGE_KEY,
      },
    });
    return client;
  });
  return clientRequest;
}

export function getSession(): Promise<Session | null> {
  if (sessionRequest) return sessionRequest;
  try {
    sessionRequest = getSupabaseClient()
      .then((supabase) => supabase.auth.getSession())
      .then(({ data, error }) => {
        if (error) throw error;
        return data.session;
      })
      .finally(() => {
        sessionRequest = null;
      });
  } catch (error) {
    return Promise.reject(error);
  }
  return sessionRequest;
}

export async function getAccessToken(): Promise<string | null> {
  return (await getSession())?.access_token ?? null;
}

export async function signIn(email: string, password: string): Promise<AuthResponse["data"]> {
  const { data, error } = await (
    await getSupabaseClient()
  ).auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function signUp(
  email: string,
  password: string,
  emailRedirectTo?: string,
): Promise<AuthResponse["data"]> {
  const { data, error } = await (
    await getSupabaseClient()
  ).auth.signUp({
    email,
    password,
    options: emailRedirectTo ? { emailRedirectTo } : undefined,
  });
  if (error) throw error;
  return data;
}

export async function sendPasswordRecovery(email: string, redirectTo?: string): Promise<void> {
  const { error } = await (
    await getSupabaseClient()
  ).auth.resetPasswordForEmail(email, {
    redirectTo,
  });
  if (error) throw error;
}

export type RecoveryLinkParams = {
  code?: string | string[] | null;
  error?: string | string[] | null;
  error_description?: string | string[] | null;
};

function firstParam(value?: string | string[] | null): string | null {
  return (Array.isArray(value) ? value[0] : value) ?? null;
}

/**
 * Resolves the recovery session a `/reset-password` deep link should land with.
 * The link carries a PKCE `?code=` (exchanged for a session here) or an
 * `?error=` from Supabase when the link was already expired/invalid; either way
 * this never throws, so an honest "invalid or expired" screen is always possible
 * instead of a blank one.
 */
export async function resolveRecoverySession(
  params: RecoveryLinkParams,
  deps: {
    exchangeCodeForSession: (code: string) => Promise<AuthTokenResponse>;
    getSession: () => Promise<Session | null>;
  } = {
    exchangeCodeForSession: async (code) =>
      (await getSupabaseClient()).auth.exchangeCodeForSession(code),
    getSession,
  },
): Promise<Session | null> {
  if (firstParam(params.error) ?? firstParam(params.error_description)) return null;
  const code = firstParam(params.code);
  if (!code) return deps.getSession();
  try {
    const { data, error } = await deps.exchangeCodeForSession(code);
    if (error) return null;
    return data.session;
  } catch {
    return null;
  }
}

export async function updatePassword(password: string): Promise<UserResponse["data"]> {
  const { data, error } = await (await getSupabaseClient()).auth.updateUser({ password });
  if (error) throw error;
  return data;
}

export async function signOut(): Promise<void> {
  try {
    const { error } = await (await getSupabaseClient()).auth.signOut({ scope: "global" });
    if (error) throw error;
  } finally {
    sessionRequest = null;
    await clearAuthStorage();
  }
}

export async function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
): Promise<() => void> {
  const { data } = (await getSupabaseClient()).auth.onAuthStateChange(callback);
  return () => data.subscription.unsubscribe();
}
