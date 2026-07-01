import { Fraunces, Plus_Jakarta_Sans, Fragment_Mono } from "next/font/google";

export const fraunces = Fraunces({
  subsets: ["latin"],
  axes: ["SOFT", "WONK"],
  variable: "--font-display",
  display: "swap",
});

export const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-body",
  display: "swap",
});

export const fragmentMono = Fragment_Mono({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal"],
  variable: "--font-mono",
  display: "swap",
});

// Legacy aliases
export const inter = jakarta;
export const playfair = fraunces;
export const jetbrainsMono = fragmentMono;
