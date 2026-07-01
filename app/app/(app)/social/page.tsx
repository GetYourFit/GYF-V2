import type { Metadata } from "next";

import { SocialFeed } from "@/components/social/social-feed";

export const metadata: Metadata = {
  title: "Social — GYF",
  description: "See how others are wearing GYF outfits and share your own looks.",
};

export default function SocialPage() {
  return <SocialFeed />;
}
