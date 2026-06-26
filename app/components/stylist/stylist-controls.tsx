"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { OCCASIONS } from "@/lib/vocab";

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

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onApply({ goal: goal.trim(), occasion });
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-4 border border-[var(--border)] bg-[var(--surface)] p-5 sm:flex-row sm:items-end"
    >
      <div className="flex-1">
        <label
          htmlFor="goal"
          className="t-label mb-2 block text-[var(--text-faint)]"
        >
          Tell your stylist a goal
        </label>
        <input
          id="goal"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          maxLength={200}
          placeholder="I want to look taller and slimmer…"
          className="min-h-11 w-full border-b border-[var(--border-mid)] bg-transparent pb-2 font-[family-name:var(--font-display)] text-lg italic text-[var(--text)] placeholder:text-[var(--text-faint)] placeholder:not-italic focus:border-[var(--accent)] focus:outline-none transition-colors duration-[180ms]"
        />
      </div>
      <div className="sm:w-48">
        <label
          htmlFor="occasion"
          className="t-label mb-2 block text-[var(--text-faint)]"
        >
          Occasion
        </label>
        <Select
          id="occasion"
          options={OCCASIONS}
          placeholder="Any occasion"
          value={occasion}
          onChange={(e) => setOccasion(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={busy} aria-busy={busy}>
        {busy ? "Styling…" : "Restyle"}
      </Button>
    </form>
  );
}
