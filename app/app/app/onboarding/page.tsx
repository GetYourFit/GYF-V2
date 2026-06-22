import type { Metadata } from "next";

import { OnboardingForm } from "@/components/onboarding/onboarding-form";

export const metadata: Metadata = { title: "Your profile · GYF" };

export default function OnboardingPage() {
  return (
    <div className="mx-auto max-w-xl">
      <OnboardingForm />
    </div>
  );
}
