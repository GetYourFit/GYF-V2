import type { Metadata } from "next";
import { WelcomeScreen } from "@/components/onboarding/welcome-screen";

export const metadata: Metadata = {
  title: "Welcome — GYF",
  description: "Your AI stylist. Discover, save, and get dressed.",
};

export default function WelcomePage() {
  return <WelcomeScreen />;
}
