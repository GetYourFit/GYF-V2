import { forwardRef, type SelectHTMLAttributes } from "react";

import { cn } from "@/lib/cn";
import type { Option } from "@/lib/vocab";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: Option[];
  /** Leading empty option label. Omitted entirely when `hidePlaceholder` is set. */
  placeholder?: string;
  /** Drop the leading empty option (for always-valued controls like sort). */
  hidePlaceholder?: boolean;
  /** Dense variant for filter rows; default is the form-field size. */
  compact?: boolean;
}

// Chevron tinted with --text-mid (#6B6B6B → %236B6B6B) to match the token system.
const CHEVRON =
  "bg-[image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236B6B6B' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")] bg-no-repeat";

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    className,
    options,
    placeholder = "Prefer not to say",
    hidePlaceholder = false,
    compact = false,
    ...props
  },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(
        "appearance-none border border-border-mid bg-surface text-text",
        "font-[family-name:var(--font-body)] transition-colors duration-[180ms]",
        "focus-visible:border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent",
        "disabled:cursor-not-allowed disabled:opacity-40",
        CHEVRON,
        compact
          ? "py-1.5 pl-3 pr-8 text-xs text-text-mid bg-[right_0.6rem_center]"
          : "min-h-11 w-full px-4 py-2.5 pr-10 text-sm bg-[right_1rem_center]",
        className,
      )}
      {...props}
    >
      {!hidePlaceholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
});
