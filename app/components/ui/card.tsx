// Surface container — one editorial-gallery treatment of a bordered panel
// (hairline border, white surface, optional hover-lift for interactive cards),
// so feature pages stop hand-rolling `border border-border bg-surface …` blocks.

import { forwardRef, type HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Adds hover/focus-within affordance + shadow lift for clickable cards. */
  interactive?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, interactive = false, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        "border border-border bg-surface",
        interactive &&
          "transition-all duration-300 ease-lux hover:border-border-hi hover:shadow-card focus-within:border-border-hi",
        className,
      )}
      {...props}
    />
  );
});

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4 sm:p-5", className)} {...props} />;
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 border-b border-border p-4 sm:p-5",
        className,
      )}
      {...props}
    />
  );
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-center gap-3 border-t border-border p-4 sm:p-5", className)}
      {...props}
    />
  );
}
