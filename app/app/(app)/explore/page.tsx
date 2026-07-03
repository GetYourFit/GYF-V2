import type { Metadata } from "next";
import { ExploreShell } from "@/components/explore/explore-shell";

export const metadata: Metadata = {
  title: "Explore — GYF",
  description: "Discover garments from the catalog, filtered by occasion, style and budget.",
};

export default function ExplorePage() {
  return <ExploreShell />;
}
