import type { Metadata } from "next";

import { ExploreShell } from "@/components/explore/explore-shell";
import { PageContainer } from "@/components/layout/page-container";

export const metadata: Metadata = {
  title: "Explore — GYF",
  description: "Discover garments from the catalog, filtered by occasion, style and budget.",
};

export default function ExplorePage() {
  return (
    <PageContainer width="wide">
      <ExploreShell />
    </PageContainer>
  );
}
