import { useId, type ReactNode } from "react";

import { cn } from "@/lib/cn";

export interface FieldProps {
  label: string;
  children: (props: {
    id: string;
    "aria-invalid"?: boolean;
    "aria-describedby"?: string;
  }) => ReactNode;
  error?: string;
  hint?: string;
  className?: string;
}

export function Field({ label, children, error, hint, className }: FieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy =
    [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label
        htmlFor={id}
        className="t-label text-[var(--text-faint)]"
      >
        {label}
      </label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {hint && !error && (
        <p id={hintId} className="text-xs text-[var(--text-faint)]">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-[var(--error)]">
          {error}
        </p>
      )}
    </div>
  );
}
