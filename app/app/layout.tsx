import type { Metadata } from "next";
import { playfair, inter, jetbrainsMono } from "@/lib/fonts";
import { AppIntro } from "@/components/intro/app-intro";
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
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <AppIntro />
        {children}
      </body>
    </html>
  );
}
