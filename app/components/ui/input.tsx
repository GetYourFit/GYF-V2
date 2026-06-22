import { forwardRef, type InputHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

/** Text input in the brand language. Pair with <Field> for an associated label. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        "min-h-11 w-full border border-[var(--border-mid)] bg-[var(--surface)] px-3.5 py-2.5",
        "font-[family-name:var(--font-body)] text-sm text-[var(--text)] placeholder:text-[var(--faint)]",
        "transition-colors focus-visible:border-[var(--gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-light)]",
        "aria-[invalid=true]:border-[#8a2b22] aria-[invalid=true]:ring-[#8a2b22]/15",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});
