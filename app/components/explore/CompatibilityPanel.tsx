"use client";

import { ConfidenceMeter } from "@/components/stylist/confidence-meter";
import type { SearchResult } from "@gyf/types";

interface Props { item: SearchResult; }

const MONO: React.CSSProperties = {
  fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
  fontSize: "0.6rem",
  fontWeight: 500,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};

const REASON: Record<string, string> = {
  high:   "This piece scores highly against your style profile — colour, silhouette, and occasion all align.",
  mid:    "A solid match for your wardrobe — pairs well with items you've already saved.",
  low:    "An exploratory pick — try it to help GYF learn more about your taste.",
};

export function CompatibilityPanel({ item }: Props) {
  const reason = item.score >= 0.75 ? REASON.high : item.score >= 0.5 ? REASON.mid : REASON.low;

  return (
    <div style={{
      background: "rgba(255,255,255,0.05)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: "16px",
      padding: "1rem",
      display: "flex",
      flexDirection: "column",
      gap: "0.875rem",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span style={{ display: "block", width: "16px", height: "1px", background: "#d4a96a" }} />
        <span style={{ ...MONO, color: "#d4a96a" }}>Why this works</span>
      </div>

      <ConfidenceMeter value={item.score} />

      <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
        {item.color && (
          <p style={{ ...MONO, color: "#8a8a95", fontSize: "0.55rem" }}>
            Colour: <span style={{ color: "#e8e4dc" }}>{item.color}</span>
          </p>
        )}
        <p style={{
          fontFamily: "var(--font-body, 'Plus Jakarta Sans', sans-serif)",
          fontSize: "0.8125rem",
          color: "#8a8a95",
          lineHeight: 1.55,
          marginTop: "0.25rem",
        }}>
          {reason}
        </p>
      </div>
    </div>
  );
}
