import type { Metadata } from "next";

import { AccountManager } from "@/components/account/account-manager";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Account · GYF" };

export default function AccountPage() {
  return (
    <PageContainer width="narrow">
      <PageHeader
        eyebrow="Privacy & data"
        title="Account"
        description="Control what GYF can use, take your data with you, or erase it entirely."
      />
      <AccountManager />
    </PageContainer>
  );
}
