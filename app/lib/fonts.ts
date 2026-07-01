import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";

export const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-jakarta",
  display: "swap",
});

export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal"],
  variable: "--font-jetbrains",
  display: "swap",
});

// Legacy aliases so existing imports keep working without changes
export const inter = jakarta;
export const playfair = jakarta;
