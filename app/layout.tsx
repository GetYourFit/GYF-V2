import type { Metadata } from "next";
import { spaceGrotesk, inter, dmMono } from "@/lib/fonts";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SplashScreen from "@/components/SplashScreen";
import CustomCursor from "@/components/CustomCursor";
import "./globals.css";

export const metadata: Metadata = {
  title: "GYF — Get Your Fit | AI Personal Stylist",
  description: "An AI-native personal stylist that learns your taste and builds complete, coordinated outfits — free, instant, and personal to you.",
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
    <html lang="en" className={`${spaceGrotesk.variable} ${inter.variable} ${dmMono.variable}`}>
      <body className="min-h-screen flex flex-col bg-bg text-text-primary">
        <SplashScreen />
        <CustomCursor />
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
