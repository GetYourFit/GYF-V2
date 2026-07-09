import type { Metadata } from "next";
import { ProfileView } from "@/components/profile/profile-view";

export const metadata: Metadata = { title: "Profile · GYF" };

export default function ProfilePage() {
  return (
    <div style={{ padding: "1.25rem 1rem 1rem" }}>
      <header style={{ marginBottom: "2rem" }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.6rem",
            fontWeight: 500,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--secondary)",
            display: "block",
            marginBottom: "0.5rem",
          }}
        >
          You
        </span>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(2.25rem,9vw,3rem)",
            fontWeight: 600,
            fontStyle: "italic",
            lineHeight: 1.05,
            letterSpacing: "-0.01em",
            color: "var(--text)",
            margin: 0,
          }}
        >
          Profile
        </h1>
      </header>
      <ProfileView />
    </div>
  );
}
