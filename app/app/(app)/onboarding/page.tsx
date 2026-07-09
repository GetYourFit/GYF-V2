import type { Metadata } from "next";
import { GYFLogo } from "@/components/brand/gyf-logo";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export const metadata: Metadata = { title: "Your profile · GYF" };

export default function OnboardingPage() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "var(--bg)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "0 0 calc(80px + env(safe-area-inset-bottom))",
      }}
    >
      {/* Brand header */}
      <div
        style={{
          width: "100%",
          maxWidth: "430px",
          padding: "1.5rem 1.5rem 1rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <GYFLogo width={120} />
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "0.75rem",
            fontWeight: 700,
            color: "var(--text-mid)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          Profile setup
        </span>
      </div>

      {/* Wizard content */}
      <div
        style={{
          width: "100%",
          maxWidth: "430px",
          padding: "0 1.5rem",
          flex: 1,
        }}
      >
        <OnboardingWizard />
      </div>
    </div>
  );
}
