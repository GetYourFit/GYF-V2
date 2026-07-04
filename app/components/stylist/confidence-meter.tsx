"use client";

import { motion, useReducedMotion } from "framer-motion";

interface ConfidenceMeterProps {
  value: number; // 0–1
}

export function ConfidenceMeter({ value }: ConfidenceMeterProps) {
  const reduce = useReducedMotion();
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}
      title={`Confidence: ${pct}%`}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.5rem",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-body, 'Plus Jakarta Sans', sans-serif)",
            fontSize: "0.65rem",
            fontWeight: 600,
            color: "var(--secondary)",
          }}
        >
          {pct >= 75 ? "Strong match" : pct >= 50 ? "Good match" : "Exploring"}
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
            fontSize: "0.6rem",
            fontWeight: 500,
            color: "var(--text-faint)",
          }}
        >
          {pct}%
        </span>
      </div>

      <div
        role="meter"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${pct}% confidence`}
        style={{
          height: "3px",
          width: "100%",
          background: "rgba(0,0,0,0.08)",
          overflow: "hidden",
          borderRadius: "999px",
        }}
      >
        <motion.div
          initial={{ width: "0%" }}
          animate={{ width: `${pct}%` }}
          transition={
            reduce ? { duration: 0 } : { duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.2 }
          }
          style={{ height: "100%", background: "var(--secondary)", borderRadius: "999px" }}
        />
      </div>
    </div>
  );
}
