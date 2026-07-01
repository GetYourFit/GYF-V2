import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";

export const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-body",
  display: "swap",
});

// Also used as display font — same family, heavy weight
export const jakartaDisplay = jakarta;

export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal"],
  variable: "--font-mono",
  display: "swap",
});

// Legacy aliases kept so existing imports don't break
export const playfair = jakarta;
export const inter = jakarta;
export const fraunces = jakarta;
export const fragmentMono = jetbrainsMono;

// Alias used in layout
export { jakarta as display };
