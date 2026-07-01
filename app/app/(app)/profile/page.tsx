import type { Metadata } from "next";
import { ProfileView } from "@/components/profile/profile-view";

export const metadata: Metadata = { title: "Profile · GYF" };

export default function ProfilePage() {
  return (
    <div style={{ padding: "1.25rem 1rem 1rem" }}>
      <header style={{ marginBottom: "2rem" }}>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: "0.6rem", fontWeight: 500,
          letterSpacing: "0.1em", textTransform: "uppercase", color: "#f0bd8f",
          display: "block", marginBottom: "0.5rem",
        }}>
          You
        </span>
        <h1 style={{
          fontFamily: "var(--font-body)", fontSize: "clamp(1.625rem,7vw,2.25rem)",
          fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.03em",
          color: "#ffffff", margin: 0,
        }}>
          Profile
        </h1>
      </header>
      <ProfileView />
    </div>
  );
}
