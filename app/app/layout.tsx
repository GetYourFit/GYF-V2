import type { ReactNode } from "react";

export const metadata = {
  title: "GYF — Get Your Fit",
  description: "AI-native personal stylist that learns what looks good on you.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
