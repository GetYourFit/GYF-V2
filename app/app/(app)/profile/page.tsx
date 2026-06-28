import type { Metadata } from "next";

import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { ProfileView } from "@/components/profile/profile-view";

export const metadata: Metadata = { title: "Profile · GYF" };

export default function ProfilePage() {
  return (
    <PageContainer>
      <PageHeader eyebrow="You" title="Profile" />
      <ProfileView />
    </PageContainer>
  );
}
