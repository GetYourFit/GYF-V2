import type { Metadata } from "next";
import { GYFLogo } from "@/components/brand/GYFLogo";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export const metadata: Metadata = { title: "Your profile · GYF" };

export default function OnboardingPage() {
  return (
    <div style={{
      minHeight: "100dvh",
      background: "#faf8f5",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "0 0 calc(80px + env(safe-area-inset-bottom))",
    }}>
      {/* Brand header */}
      <div style={{
        width: "100%",
        maxWidth: "390px",
        padding: "1.5rem 1.5rem 1rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <GYFLogo width={80} style={{ filter: "brightness(0) invert(1)" }} />
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.55rem",
          color: "#5a5a65",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}>
          Profile setup
        </span>
      </div>

      {/* Wizard content */}
      <div style={{
        width: "100%",
        maxWidth: "390px",
        padding: "0 1.5rem",
        flex: 1,
      }}>
        <OnboardingWizard />
      </div>
    </div>
  );
}
