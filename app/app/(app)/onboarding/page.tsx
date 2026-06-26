import type { Metadata } from "next";

import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export const metadata: Metadata = { title: "Your profile · GYF" };

export default function OnboardingPage() {
  return (
    <div className="mx-auto max-w-xl">
      <OnboardingWizard />
    </div>
  );
}
