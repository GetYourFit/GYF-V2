import { createAuthStorage, type AuthStorage } from "@/lib/storage";
import type { ThemeName } from "@/theme/tokens";

/** "system" = no override; the app follows the OS appearance. */
export type ThemePreference = ThemeName | "system";

export const THEME_STORAGE_KEY = "gyf-theme-preference";

/**
 * Theme is not a secret, but the existing storage factory is the one
 * cross-platform key-value boundary in the app — reuse it. localStorage (not
 * the auth default sessionStorage) so the choice survives web restarts.
 */
export const themeStorage: AuthStorage = createAuthStorage({
  web: typeof window === "undefined" ? undefined : window.localStorage,
});

export function parseThemePreference(value: string | null): ThemePreference {
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

export async function loadThemePreference(
  storage: AuthStorage = themeStorage,
): Promise<ThemePreference> {
  try {
    return parseThemePreference(await storage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system"; // unreadable storage must never block first paint
  }
}

export async function saveThemePreference(
  preference: ThemePreference,
  storage: AuthStorage = themeStorage,
): Promise<void> {
  try {
    if (preference === "system") await storage.removeItem(THEME_STORAGE_KEY);
    else await storage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Persistence is best-effort; the in-memory choice still applies this session.
  }
}
