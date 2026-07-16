import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { tierForWidth, type SizeTier } from "@/theme/tokens";

export interface Responsive {
  width: number;
  height: number;
  tier: SizeTier;
  insets: { top: number; bottom: number; left: number; right: number };
}

/** One hook for every width/safe-area decision — no per-component dimension math. */
export function useResponsive(): Responsive {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return { width, height, tier: tierForWidth(width), insets };
}
