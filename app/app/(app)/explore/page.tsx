import type { Metadata } from "next";
import { ExploreShell } from "@/components/explore/explore-shell";

export const metadata: Metadata = {
  title: "Explore — GYF",
  description: "Discover garments from the catalog, filtered by occasion, style and budget.",
};

export default function ExplorePage() {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <header style={{ padding: "1.25rem 1rem 0.75rem" }}>
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
          Explore
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
          The full{" "}
          <em style={{ fontStyle: "italic", fontWeight: 300, color: "#5c5650" }}>catalog.</em>
        </h1>
      </header>
      <ExploreShell />
    </div>
  );
}
