import { createContext, useContext } from "react";
import { useColorScheme as useSystemColorScheme } from "react-native";

import type { ThemePreference } from "@/theme/theme-preference";
import { colors, type ThemeName } from "@/theme/tokens";

/** Set by the root layout once a stored manual override loads; null = follow OS. */
export const ThemeOverrideContext = createContext<ThemeName | null>(null);

/** Read + change the persisted preference (menu/settings consume this). */
export const ThemePreferenceContext = createContext<{
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}>({ preference: "system", setPreference: () => {} });

export function useThemePreference() {
  return useContext(ThemePreferenceContext);
}

export function useAppColorScheme(): ThemeName {
  const override = useContext(ThemeOverrideContext);
  const system = useSystemColorScheme();
  return override ?? (system === "light" ? "light" : "dark");
}

export function useThemeColors() {
  return colors[useAppColorScheme()];
}

/** Component theme resolution: explicit prop wins, else the app scheme. */
export function useTheme(override?: ThemeName): ThemeName {
  const scheme = useAppColorScheme();
  return override ?? scheme;
}
