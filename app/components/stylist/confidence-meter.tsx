"use client";

import { motion, useReducedMotion } from "framer-motion";

interface ConfidenceMeterProps {
  value: number; // 0–1
}

export function ConfidenceMeter({ value }: ConfidenceMeterProps) {
  const reduce = useReducedMotion();
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const high     = pct >= 75;
  const moderate = pct >= 50 && !high;

  const fillColor = high ? "#10B981" : moderate ? "#f0bd8f" : "#5a5a65";
  const label     = high ? "Strong match" : moderate ? "Good match" : "Exploring";

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}
      title={`Confidence: ${pct}%`}
    >
      {/* Label */}
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
            fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
            fontSize: "0.6rem",
            fontWeight: 500,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: fillColor,
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
            fontSize: "0.6rem",
            fontWeight: 500,
            letterSpacing: "0.05em",
            color: "#5a5a65",
          }}
        >
          {pct}%
        </span>
      </div>

      {/* Track */}
      <div
        role="meter"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}, ${pct}%`}
        style={{
          height: "2px",
          width: "100%",
          background: "#1e2025",
          overflow: "hidden",
          borderRadius: 0,
        }}
      >
        <motion.div
          initial={{ width: "0%" }}
          animate={{ width: `${pct}%` }}
          transition={
            reduce
              ? { duration: 0 }
              : { duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.2 }
          }
          style={{ height: "100%", background: fillColor }}
        />
      </div>
    </div>
  );
}
