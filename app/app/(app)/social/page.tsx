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
        maxWidth: "430px",
        margin: "0 auto",
        width: "100%",
      }}
    >
      {/* Page header */}
      <header style={{ padding: "1.25rem 1rem 0.5rem" }}>
        <span
          style={{
            display: "block",
            fontFamily: "var(--font-body)",
            fontSize: "0.8125rem",
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--text-mid)",
            marginBottom: "0.5rem",
          }}
        >
          Community
        </span>
        <h1
          style={{
            fontFamily: "var(--font-display, 'Cormorant Garamond', serif)",
            fontSize: "clamp(2.25rem, 9vw, 3rem)",
            fontWeight: 600,
            fontStyle: "italic",
            lineHeight: 1.05,
            letterSpacing: "-0.01em",
            color: "var(--text)",
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
