import type * as SecureStore from "expo-secure-store";

declare const require: (moduleName: string) => typeof import("expo-secure-store");

/** One fixed key keeps logout deterministic without enumerating secure storage. */
export const AUTH_STORAGE_KEY = "gyf-auth-session";

export interface AuthStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

type StorageOptions = {
  platform?: "web" | "native";
  secure?: Pick<typeof SecureStore, "getItemAsync" | "setItemAsync" | "deleteItemAsync">;
  web?: Storage;
};

export function createAuthStorage(options: StorageOptions = {}): AuthStorage {
  const platform =
    options.platform ?? (process.env.EXPO_OS && process.env.EXPO_OS !== "web" ? "native" : "web");
  if (platform === "web") {
    const web = options.web ?? (typeof window === "undefined" ? undefined : window.sessionStorage);
    return {
      getItem: async (key) => web?.getItem(key) ?? null,
      setItem: async (key, value) => web?.setItem(key, value),
      removeItem: async (key) => web?.removeItem(key),
    };
  }
  const secure = options.secure ?? require("expo-secure-store");
  return {
    getItem: (key) => secure.getItemAsync(key),
    setItem: (key, value) => secure.setItemAsync(key, value),
    removeItem: (key) => secure.deleteItemAsync(key),
  };
}

export const secureStorage = createAuthStorage();

export function clearAuthStorage(storage: AuthStorage = secureStorage): Promise<void> {
  return storage.removeItem(AUTH_STORAGE_KEY);
}
