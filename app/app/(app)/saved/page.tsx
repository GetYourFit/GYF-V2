import type { Metadata } from "next";

import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { SavedGrid } from "@/components/saved/saved-grid";

export const metadata: Metadata = { title: "Saved · GYF" };

export default function SavedPage() {
  return (
    <PageContainer>
      <PageHeader eyebrow="Collections" title="Saved looks" />
      <SavedGrid />
    </PageContainer>
  );
}
