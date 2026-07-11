import type { Metadata, Viewport } from "next";
import { jakarta, jetbrainsMono, cormorant } from "@/lib/fonts";
import { SplashScreen } from "@/components/brand/splash-screen";
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
  viewportFit: "cover",
  themeColor: "#000000",
};

// Runs before paint: applies the persisted theme so there is no flash of the
// wrong theme. No attribute = dark (the default Cosmos look).
const THEME_INIT = `try{var t=localStorage.getItem("gyf-theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

// Grid/Canvas fetch garment images and API responses from this origin on
// every page — a preconnect here overlaps the DNS/TLS/TCP handshake with
// the rest of first paint instead of paying it on the first image request.
const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${jakarta.variable} ${jetbrainsMono.variable} ${cormorant.variable}`}
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href={API_ORIGIN} />
        <link rel="dns-prefetch" href={API_ORIGIN} />
      </head>
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        <SplashScreen />
        {children}
      </body>
    </html>
  );
}
