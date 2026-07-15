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
    // Chevron is a real inline SVG (stroke="currentColor") rather than a data-URI
    // background, so its tint follows the --text-mid token and inverts with the
    // light/dark theme — a data URI is an isolated document and cannot inherit it.
    <span className={cn("relative inline-flex", compact ? "" : "w-full")}>
      <select
        ref={ref}
        className={cn(
          "appearance-none border border-border-mid bg-surface text-text",
          "font-[family-name:var(--font-body)] transition-colors duration-[180ms]",
          "focus-visible:border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent",
          "disabled:cursor-not-allowed disabled:opacity-40",
          compact
            ? "py-1.5 pl-3 pr-8 text-xs text-text-mid"
            : "min-h-11 w-full px-4 py-2.5 pr-10 text-base",
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
      <svg
        aria-hidden="true"
        viewBox="0 0 12 8"
        className={cn(
          "pointer-events-none absolute top-1/2 -translate-y-1/2 text-text-mid",
          compact ? "right-3 h-2 w-3" : "right-4 h-2 w-3",
        )}
        fill="none"
      >
        <path
          d="M1 1l5 5 5-5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
});
