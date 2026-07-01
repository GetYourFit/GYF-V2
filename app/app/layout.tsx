import type { Metadata, Viewport } from "next";
import { jakarta, jetbrainsMono } from "@/lib/fonts";
import { SplashScreen } from "@/components/brand/SplashScreen";
import "./globals.css";

export const metadata: Metadata = {
  title: "GYF — Get Your Fit | AI Personal Stylist",
  description:
    "An AI-native personal stylist that learns your taste and builds complete, coordinated outfits — free, instant, and personal to you.",
  openGraph: {
    title: "GYF — Get Your Fit",
    description: "Your personal AI stylist. Complete outfits, built for you.",
    images: [{ url: "/assets/logo-bg.jpeg", width: 1200, height: 630 }],
    url: "https://getyourfit.tech",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
  metadataBase: new URL("https://getyourfit.tech"),
  appleWebApp: { capable: true, title: "GYF", statusBarStyle: "black-translucent" },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${jakarta.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <SplashScreen />
        {children}
      </body>
    </html>
  );
}
