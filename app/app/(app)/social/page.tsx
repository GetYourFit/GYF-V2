import type { Metadata } from "next";

import { SocialFeed } from "@/components/social/social-feed";

export const metadata: Metadata = {
  title: "Social — GYF",
  description: "See how others are wearing GYF outfits and share your own looks.",
};

export default function SocialPage() {
  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg)]/95 px-4 py-4 backdrop-blur-xl">
        <h1 className="t-title text-[var(--text)]">Social</h1>
      </header>
      <SocialFeed />
    </div>
  );
}
