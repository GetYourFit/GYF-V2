// Loading placeholder — wraps the `.skeleton` shimmer utility (globals.css) so
// loading states stop hand-rolling `<div className="skeleton …" />`. Decorative
// by default (aria-hidden); give the container a role="status" + sr-only label.

import { cn } from "@/lib/cn";

interface SkeletonProps {
  className?: string;
  /** Tailwind aspect utility, e.g. "aspect-[3/4]" — convenience for image tiles. */
  aspect?: string;
}

export function Skeleton({ className, aspect }: SkeletonProps) {
  return <div aria-hidden className={cn("skeleton", aspect, className)} />;
}

/** A grid of image-tile skeletons — the common "results loading" shape. */
export function SkeletonGrid({
  count = 9,
  className,
  tileClassName = "aspect-[3/4]",
  label = "Loading…",
}: {
  count?: number;
  className?: string;
  tileClassName?: string;
  label?: string;
}) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn("grid grid-cols-3 gap-px bg-border", className)}
    >
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className={tileClassName} />
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}
