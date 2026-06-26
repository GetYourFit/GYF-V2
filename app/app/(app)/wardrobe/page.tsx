import type { Metadata } from "next";

import { WardrobeGrid } from "@/components/wardrobe/wardrobe-grid";

export const metadata: Metadata = {
  title: "Wardrobe — GYF",
  description: "Manage the clothes you own and let GYF style around your real wardrobe.",
};

export default function WardrobePage() {
  return (
    <div className="mx-auto w-full px-4 py-6">
      <header className="mb-8">
        <h1 className="t-display text-[var(--text)]">Wardrobe</h1>
        <p className="t-caption mt-2 text-[var(--text-faint)]">
          Everything you own — GYF styles around it.
        </p>
      </header>
      <WardrobeGrid />
    </div>
  );
}
