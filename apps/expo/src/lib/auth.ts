import {
  createClient,
  type AuthChangeEvent,
  type AuthResponse,
  type Session,
  type SupabaseClient,
  type UserResponse,
} from "@supabase/supabase-js";

import { clearAuthStorage, secureStorage, type AuthStorage, AUTH_STORAGE_KEY } from "./storage";
import { readSupabaseEnv, type SupabaseEnv } from "./auth-config";

export { readSupabaseEnv } from "./auth-config";
export type { SupabaseEnv } from "./auth-config";

let client: SupabaseClient | null = null;
let sessionRequest: Promise<Session | null> | null = null;

export function getSupabaseClient(storage: AuthStorage = secureStorage): SupabaseClient {
  if (client) return client;
  const { url, anonKey } = readSupabaseEnv();
  client = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: false,
      persistSession: true,
      storage,
      storageKey: AUTH_STORAGE_KEY,
    },
  });
  return client;
}

export function getSession(): Promise<Session | null> {
  if (sessionRequest) return sessionRequest;
  try {
    sessionRequest = getSupabaseClient()
      .auth.getSession()
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
  const { data, error } = await getSupabaseClient().auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUp(
  email: string,
  password: string,
  emailRedirectTo?: string,
): Promise<AuthResponse["data"]> {
  const { data, error } = await getSupabaseClient().auth.signUp({
    email,
    password,
    options: emailRedirectTo ? { emailRedirectTo } : undefined,
  });
  if (error) throw error;
  return data;
}

export async function sendPasswordRecovery(email: string, redirectTo?: string): Promise<void> {
  const { error } = await getSupabaseClient().auth.resetPasswordForEmail(email, {
    redirectTo,
  });
  if (error) throw error;
}

export async function updatePassword(password: string): Promise<UserResponse["data"]> {
  const { data, error } = await getSupabaseClient().auth.updateUser({ password });
  if (error) throw error;
  return data;
}

export async function signOut(): Promise<void> {
  try {
    const { error } = await getSupabaseClient().auth.signOut({ scope: "global" });
    if (error) throw error;
  } finally {
    sessionRequest = null;
    await clearAuthStorage();
  }
}

export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
): () => void {
  const { data } = getSupabaseClient().auth.onAuthStateChange(callback);
  return () => data.subscription.unsubscribe();
}
