import { describe, expect, test } from "bun:test";

import type { AuthStorage } from "@/lib/storage";
import {
  loadThemePreference,
  parseThemePreference,
  saveThemePreference,
  THEME_STORAGE_KEY,
} from "@/theme/theme-preference";

function memoryStorage(store = new Map<string, string>()): AuthStorage & {
  store: Map<string, string>;
} {
  return {
    store,
    getItem: async (key) => store.get(key) ?? null,
    setItem: async (key, value) => void store.set(key, value),
    removeItem: async (key) => void store.delete(key),
  };
}

describe("parseThemePreference", () => {
  test("accepts the three valid values", () => {
    expect(parseThemePreference("light")).toBe("light");
    expect(parseThemePreference("dark")).toBe("dark");
    expect(parseThemePreference("system")).toBe("system");
  });

  test("falls back to system on null or garbage", () => {
    expect(parseThemePreference(null)).toBe("system");
    expect(parseThemePreference("solarized")).toBe("system");
    expect(parseThemePreference("")).toBe("system");
  });
});

describe("load/save round trip", () => {
  test("persists a manual choice and reads it back", async () => {
    const storage = memoryStorage();
    await saveThemePreference("light", storage);
    expect(await loadThemePreference(storage)).toBe("light");
    expect(storage.store.get(THEME_STORAGE_KEY)).toBe("light");
  });

  test("system clears the stored key so the OS choice rules again", async () => {
    const storage = memoryStorage();
    await saveThemePreference("dark", storage);
    await saveThemePreference("system", storage);
    expect(storage.store.has(THEME_STORAGE_KEY)).toBe(false);
    expect(await loadThemePreference(storage)).toBe("system");
  });

  test("unreadable storage yields system instead of throwing", async () => {
    const broken: AuthStorage = {
      getItem: async () => {
        throw new Error("secure store unavailable");
      },
      setItem: async () => {
        throw new Error("secure store unavailable");
      },
      removeItem: async () => {
        throw new Error("secure store unavailable");
      },
    };
    expect(await loadThemePreference(broken)).toBe("system");
    await expect(saveThemePreference("dark", broken)).resolves.toBeUndefined();
  });
});
