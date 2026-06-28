import type { Metadata } from "next";

import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { WardrobeGrid } from "@/components/wardrobe/wardrobe-grid";

export const metadata: Metadata = {
  title: "Wardrobe — GYF",
  description: "Manage the clothes you own and let GYF style around your real wardrobe.",
};

export default function WardrobePage() {
  return (
    <PageContainer width="wide">
      <PageHeader
        eyebrow="Your closet"
        title="Wardrobe"
        description="Everything you own — GYF styles around it."
      />
      <WardrobeGrid />
    </PageContainer>
  );
}
