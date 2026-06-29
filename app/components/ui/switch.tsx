"use client";

import { cn } from "@/lib/cn";

interface SwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Accessible name — required when no visible <label> is wired via `id`. */
  "aria-label"?: string;
  /** id of a visible label/description that names this control. */
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Accessible on/off toggle (`role="switch"`). Editorial Noir: an ivory track when
 * on (it reads as an affirmative CTA, consistent with the ivory primary button),
 * a hairline-framed dark track when off. Keyboard- and reduced-motion-safe; the
 * native button gives Space/Enter activation and focus-visible for free.
 */
export function Switch({ checked, onChange, disabled, className, ...aria }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center border transition-colors duration-200 ease-[var(--lux)] motion-reduce:transition-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        "disabled:cursor-not-allowed disabled:opacity-40",
        checked ? "border-accent bg-accent" : "border-border-hi bg-surface-2",
        className,
      )}
      {...aria}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none block h-4 w-4 transition-transform duration-200 ease-[var(--lux)] motion-reduce:transition-none",
          checked ? "translate-x-[22px] bg-bg" : "translate-x-1 bg-text",
        )}
      />
    </button>
  );
}
