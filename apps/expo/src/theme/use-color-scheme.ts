import { createContext, useContext } from "react";
import { useColorScheme as useSystemColorScheme } from "react-native";

import { colors, type ThemeName } from "@/theme/tokens";

/** Set by the root layout once a stored manual override loads; null = follow OS. */
export const ThemeOverrideContext = createContext<ThemeName | null>(null);

export function useAppColorScheme(): ThemeName {
  const override = useContext(ThemeOverrideContext);
  const system = useSystemColorScheme();
  return override ?? (system === "light" ? "light" : "dark");
}

export function useThemeColors() {
  return colors[useAppColorScheme()];
}
