"use client";

import { ArrowRight } from "lucide-react";
import { useState, type FormEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { OCCASIONS } from "@/lib/vocab";

export interface StylistQuery {
  goal: string;
  occasion: string;
}

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export function StylistControls({
  value,
  busy,
  onApply,
}: {
  value: StylistQuery;
  busy: boolean;
  onApply: (q: StylistQuery) => void;
}) {
  const reduce = useReducedMotion();
  const [goal, setGoal] = useState(value.goal);
  const [occasion, setOccasion] = useState(value.occasion);

  function tapOccasion(v: string) {
    const next = occasion === v ? "" : v;
    setOccasion(next);
    onApply({ goal: goal.trim(), occasion: next });
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onApply({ goal: goal.trim(), occasion });
  }

  return (
    <motion.div
      initial={reduce ? { opacity: 1 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE, delay: 0.08 }}
      style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
    >
      {/* Occasion chips */}
      <div
        aria-label="Filter by occasion"
        style={{
          display: "flex",
          gap: "0.5rem",
          overflowX: "auto",
          paddingBottom: "2px",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        } as React.CSSProperties}
      >
        {OCCASIONS.map((occ) => {
          const active = occasion === occ.value;
          return (
            <motion.button
              key={occ.value}
              type="button"
              aria-pressed={active}
              disabled={busy}
              onClick={() => tapOccasion(occ.value)}
              whileTap={reduce ? undefined : { scale: 0.94 }}
              transition={{ type: "spring", stiffness: 500, damping: 28 }}
              style={{
                flexShrink: 0,
                padding: "0.375rem 0.875rem",
                fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                fontSize: "0.6rem",
                fontWeight: 500,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                border: `1px solid ${active ? "#f0bd8f" : "rgba(255,255,255,0.12)"}`,
                background: active ? "rgba(240,189,143,0.1)" : "transparent",
                color: active ? "#f0bd8f" : "#8e9192",
                borderRadius: "2px",
                cursor: busy ? "not-allowed" : "pointer",
                opacity: busy ? 0.5 : 1,
                minHeight: "36px",
                transition: "all 0.18s",
              }}
            >
              {occ.label}
            </motion.button>
          );
        })}
      </div>

      {/* NL goal input */}
      <form
        onSubmit={submit}
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          borderBottom: "1px solid rgba(255,255,255,0.15)",
          transition: "border-color 0.2s",
        }}
        onFocus={(e) => {
          (e.currentTarget as HTMLFormElement).style.borderBottomColor = "rgba(255,255,255,0.6)";
        }}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            (e.currentTarget as HTMLFormElement).style.borderBottomColor = "rgba(255,255,255,0.15)";
          }
        }}
      >
        <input
          id="goal"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          maxLength={200}
          placeholder="Tell your stylist anything…"
          disabled={busy}
          aria-label="Style goal"
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            padding: "0.75rem 3rem 0.75rem 0",
            fontFamily: "var(--font-body, 'Plus Jakarta Sans', sans-serif)",
            fontSize: "16px",
            fontStyle: "italic",
            color: "#e2e2e9",
            minHeight: "48px",
            opacity: busy ? 0.5 : 1,
          }}
        />
        <button
          type="submit"
          disabled={busy || !goal.trim()}
          aria-label="Apply goal"
          style={{
            position: "absolute",
            right: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "36px",
            height: "36px",
            background: goal.trim() && !busy ? "#ffffff" : "rgba(255,255,255,0.08)",
            border: "none",
            borderRadius: "2px",
            color: goal.trim() && !busy ? "#000000" : "#5a5a65",
            cursor: busy || !goal.trim() ? "not-allowed" : "pointer",
            opacity: busy || !goal.trim() ? 0.4 : 1,
            transition: "all 0.2s",
          }}
        >
          <ArrowRight size={15} aria-hidden />
        </button>
      </form>
    </motion.div>
  );
}
