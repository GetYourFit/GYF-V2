import { forwardRef, type SelectHTMLAttributes } from "react";

import { cn } from "@/lib/cn";
import type { Option } from "@/lib/vocab";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: Option[];
  /** Label for the empty choice (kept selectable so a field can stay unset). */
  placeholder?: string;
}

/** Accessible native select in the brand language. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, options, placeholder = "Prefer not to say", ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(
        "min-h-11 w-full border border-[var(--border-mid)] bg-[var(--surface)] px-3.5 py-2.5",
        "font-[family-name:var(--font-body)] text-sm text-[var(--text)]",
        "transition-colors focus-visible:border-[var(--gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-light)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
});
