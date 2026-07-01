"use client";

import { ArrowRight } from "lucide-react";
import { useState, type FormEvent } from "react";

import { OCCASIONS } from "@/lib/vocab";
import { cn } from "@/lib/cn";

export interface StylistQuery {
  goal: string;
  occasion: string;
}

export function StylistControls({
  value,
  busy,
  onApply,
}: {
  value: StylistQuery;
  busy: boolean;
  onApply: (q: StylistQuery) => void;
}) {
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
    <div className="flex flex-col gap-3">
      {/* Occasion chips — tap to restyle instantly */}
      <div
        className="no-scrollbar flex gap-2 overflow-x-auto pb-0.5"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        aria-label="Filter by occasion"
      >
        {OCCASIONS.map((occ) => {
          const active = occasion === occ.value;
          return (
            <button
              key={occ.value}
              type="button"
              aria-pressed={active}
              disabled={busy}
              onClick={() => tapOccasion(occ.value)}
              className={cn(
                "t-label shrink-0 rounded-full px-4 py-2 transition-all duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
                "disabled:pointer-events-none disabled:opacity-50",
                active
                  ? "bg-accent text-white shadow-sm"
                  : "border border-border bg-surface-2 text-text-faint hover:border-border-hi hover:text-text",
              )}
            >
              {occ.label}
            </button>
          );
        })}
      </div>

      {/* Goal — conversational input with inline send */}
      <form
        onSubmit={submit}
        className="relative flex items-center border border-border bg-surface-2 transition-colors duration-200 focus-within:border-accent"
      >
        <input
          id="goal"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          maxLength={200}
          placeholder="Tell your stylist anything…"
          disabled={busy}
          aria-label="Style goal"
          className="min-h-12 flex-1 bg-transparent px-4 font-[family-name:var(--font-body)] text-base italic text-text placeholder:text-text-faint placeholder:not-italic focus:outline-none disabled:opacity-50"
          style={{ fontSize: "16px" }}
        />
        <button
          type="submit"
          disabled={busy || !goal.trim()}
          aria-label="Apply goal"
          className="mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-white transition-all duration-200 hover:bg-accent-press disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      </form>
    </div>
  );
}
