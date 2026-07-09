import type { Metadata } from "next";
import { WardrobeGrid } from "@/components/wardrobe/wardrobe-grid";

export const metadata: Metadata = {
  title: "Wardrobe — GYF",
  description: "Manage the clothes you own and let GYF style around your real wardrobe.",
};

export default function WardrobePage() {
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
            fontFamily: "var(--font-body)",
            fontSize: "0.8125rem",
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--text-mid)",
          }}
        >
          Wardrobe
        </span>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(2.25rem, 9vw, 3rem)",
            fontWeight: 600,
            fontStyle: "italic",
            lineHeight: 1.05,
            letterSpacing: "-0.01em",
            color: "var(--text)",
            margin: 0,
          }}
        >
          Your closet,{" "}
          <em style={{ fontStyle: "italic", fontWeight: 400, color: "var(--text-mid)" }}>
            digitised.
          </em>
        </h1>
      </header>
      <WardrobeGrid />
    </div>
  );
}
