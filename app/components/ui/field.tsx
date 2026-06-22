import { useId, type ReactNode } from "react";

import { cn } from "@/lib/cn";

export interface FieldProps {
  label: string;
  /** Render the control given the id/aria props to spread onto it. */
  children: (props: { id: string; "aria-invalid"?: boolean; "aria-describedby"?: string }) => ReactNode;
  error?: string;
  hint?: string;
  className?: string;
}

/** Label + control + error/hint wired together for accessibility: the label is
 *  associated by id, errors are announced (role=alert) and linked via
 *  aria-describedby, and aria-invalid is set when there's an error. */
export function Field({ label, children, error, hint, className }: FieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-neutral-800">
        {label}
      </label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {hint && !error && (
        <p id={hintId} className="text-xs text-neutral-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
