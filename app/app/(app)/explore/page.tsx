import type { Metadata } from "next";

import { ExploreShell } from "@/components/explore/explore-shell";

export const metadata: Metadata = {
  title: "Explore — GYF",
  description: "Discover garments from the catalog, filtered by occasion, style and budget.",
};

export default function ExplorePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-8">
        <h1 className="t-display text-[var(--text)]">Explore</h1>
        <p className="t-caption mt-2 text-[var(--text-faint)]">
          Discover garments beyond your recommendations.
        </p>
      </header>
      <ExploreShell />
    </div>
  );
}
