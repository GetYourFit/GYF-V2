// Inline status / meta label — one editorial-gallery treatment of the small
// caps-tracked tags scattered across surfaces (categories, "estimated", counts,
// and the gold confidence callout), so they stop being hand-rolled per feature.

import { forwardRef, type HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

type Variant = "default" | "outline" | "confidence";

const VARIANTS: Record<Variant, string> = {
  default: "border border-transparent bg-surface-2 text-text-mid",
  outline: "border border-border-mid bg-transparent text-text-mid",
  // Gold — reserved for confidence / editorial callouts (design token discipline).
  confidence: "border border-accent/30 bg-transparent text-accent",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { className, variant = "default", ...props },
  ref,
) {
  return (
    <span
      ref={ref}
      className={cn(
        "t-label inline-flex items-center gap-1.5 px-2 py-1 leading-none",
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
});
