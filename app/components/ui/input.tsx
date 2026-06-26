import { forwardRef, type InputHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        "min-h-11 w-full border border-[var(--border-mid)] bg-[var(--surface)] px-4 py-2.5",
        "font-[family-name:var(--font-body)] text-sm text-[var(--text)] placeholder:text-[var(--text-faint)]",
        "transition-colors duration-[180ms]",
        "focus-visible:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]",
        "aria-[invalid=true]:border-[var(--error)] aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-[var(--error)]",
        "disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
});
