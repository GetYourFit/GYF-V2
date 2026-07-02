import type { Metadata } from "next";
import { SocialFeed } from "@/components/social/social-feed";

export const metadata: Metadata = {
  title: "Social — GYF",
  description: "See how others are wearing GYF outfits and share your own looks.",
};

export default function SocialPage() {
  return (
    <div
      style={{
        maxWidth: "390px",
        margin: "0 auto",
        width: "100%",
      }}
    >
      {/* Page header */}
      <header style={{ padding: "1.25rem 1rem 0.5rem" }}>
        <span
          style={{
            display: "block",
            fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
            fontSize: "0.6rem",
            fontWeight: 500,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#b87a30",
            marginBottom: "0.5rem",
          }}
        >
          Community
        </span>
        <h1
          style={{
            fontFamily: "var(--font-body, 'Plus Jakarta Sans', sans-serif)",
            fontSize: "clamp(1.625rem, 7vw, 2.25rem)",
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: "-0.03em",
            color: "#1c1a17",
            margin: 0,
          }}
        >
          Style the world.
        </h1>
      </header>
      <SocialFeed />
    </div>
  );
}
