import type { Metadata } from "next";
import { SavedGrid } from "@/components/saved/saved-grid";

export const metadata: Metadata = { title: "Saved — GYF" };

export default function SavedPage() {
  return (
    <div
      style={{
        padding: "1.25rem 1rem 1rem",
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
      }}
    >
      <header style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.6rem",
            fontWeight: 500,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#d4607a",
          }}
        >
          Saved
        </span>
        <h1
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "clamp(1.625rem, 7vw, 2.25rem)",
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: "-0.03em",
            color: "#1c1a17",
            margin: 0,
          }}
        >
          Your curated{" "}
          <em style={{ fontStyle: "italic", fontWeight: 300, color: "#5c5650" }}>looks.</em>
        </h1>
      </header>
      <SavedGrid />
    </div>
  );
}
