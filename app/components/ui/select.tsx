import { forwardRef, type SelectHTMLAttributes } from "react";

import { cn } from "@/lib/cn";
import type { Option } from "@/lib/vocab";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: Option[];
  /** Label for the empty choice (kept selectable so a field can stay unset). */
  placeholder?: string;
}

/** Accessible native select — keyboard- and screen-reader-friendly by default. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, options, placeholder = "Prefer not to say", ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(
        "min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900",
        "focus-visible:border-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/20",
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
