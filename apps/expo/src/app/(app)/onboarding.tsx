import { useState } from "react";
import { router } from "expo-router";

import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { PersonalFitForm } from "@/components/onboarding/personal-fit-form";

type Step = "profile" | "personal-fit";

/**
 * The required post-signup flow: `OnboardingForm` collects who the user is shopping
 * for, then `PersonalFitForm` (mode="create") collects the confirmed skin tone, body
 * type, currency, and budget the Stylist needs before its first recommendation.
 */
export default function OnboardingRoute() {
  const [step, setStep] = useState<Step>("profile");

  if (step === "personal-fit") {
    return <PersonalFitForm mode="create" onSaved={() => router.replace("/")} />;
  }
  return <OnboardingForm onSaved={() => setStep("personal-fit")} />;
}
