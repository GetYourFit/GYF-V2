import { forwardRef, type InputHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

/** Accessible text input. Pair with <Field> (or a <label htmlFor>) for a name. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        "min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900",
        "placeholder:text-neutral-400",
        "focus-visible:border-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/20",
        "aria-[invalid=true]:border-red-500 aria-[invalid=true]:ring-red-500/20",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});
