import type { Metadata } from "next";

import { StylistFeed } from "@/components/stylist/stylist-feed";

export const metadata: Metadata = { title: "Stylist · GYF" };

export default function StylistPage() {
  return <StylistFeed />;
}
