import type { Metadata } from "next";

import { ExploreShell } from "@/components/explore/explore-shell";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = {
  title: "Explore — GYF",
  description: "Discover garments from the catalog, filtered by occasion, style and budget.",
};

export default function ExplorePage() {
  return (
    <PageContainer width="wide">
      <PageHeader
        eyebrow="Catalog"
        title="Explore"
        description="Discover garments beyond your recommendations."
      />
      <ExploreShell />
    </PageContainer>
  );
}
