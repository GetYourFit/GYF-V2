"use client";

import { ArrowRight } from "lucide-react";
import { useState, type FormEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { OCCASIONS } from "@/lib/vocab";
import { UI_COLORS } from "@/lib/ui-colors";

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
        style={
          {
            display: "flex",
            gap: "0.5rem",
            overflowX: "auto",
            paddingBottom: "2px",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          } as React.CSSProperties
        }
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
                fontFamily: "var(--font-body, 'Plus Jakarta Sans', sans-serif)",
                fontSize: "0.8125rem",
                fontWeight: 500,
                border: `1px solid ${active ? UI_COLORS.stylist : "rgba(0,0,0,0.12)"}`,
                background: active ? UI_COLORS.stylist : "#f4f1ec",
                color: active ? "#faf8f5" : "#5c5650",
                borderRadius: "999px",
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
          border: "1.5px solid rgba(0,0,0,0.15)",
          borderRadius: "999px",
          background: "#ffffff",
          transition: "border-color 0.2s, box-shadow 0.2s",
        }}
        onFocus={(e) => {
          (e.currentTarget as HTMLFormElement).style.borderColor = "var(--secondary)";
          (e.currentTarget as HTMLFormElement).style.boxShadow = "0 0 0 3px rgba(212,96,122,0.12)";
        }}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            (e.currentTarget as HTMLFormElement).style.borderColor = "rgba(0,0,0,0.15)";
            (e.currentTarget as HTMLFormElement).style.boxShadow = "none";
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
            padding: "0.75rem 3rem 0.75rem 1.25rem",
            fontFamily: "var(--font-body, 'Plus Jakarta Sans', sans-serif)",
            fontSize: "16px",
            fontStyle: "italic",
            color: "#1c1a17",
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
            background: goal.trim() && !busy ? "#1c1a17" : "rgba(0,0,0,0.08)",
            border: "none",
            borderRadius: "999px",
            color: goal.trim() && !busy ? "#faf8f5" : "var(--text-faint)",
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
