import { forwardRef, type ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-[var(--accent)] text-[var(--bg)] hover:bg-[var(--text-mid)] focus-visible:ring-[var(--accent)]",
  secondary:
    "border border-[var(--border-mid)] bg-transparent text-[var(--text)] hover:border-[var(--border-hi)] hover:bg-[var(--surface-2)] focus-visible:ring-[var(--border-hi)]",
  ghost:
    "text-[var(--text-mid)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] focus-visible:ring-[var(--border-mid)]",
  danger:
    "bg-[var(--error)] text-white hover:opacity-90 focus-visible:ring-[var(--error)]",
};

const SIZES: Record<Size, string> = {
  sm: "min-h-8 px-4 text-[10px] tracking-[0.2em]",
  md: "min-h-11 px-5 text-[11px] tracking-[0.18em]",
  lg: "min-h-13 px-7 text-[12px] tracking-[0.2em]",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 py-2.5",
        "font-[family-name:var(--font-body)] font-medium uppercase",
        "transition-all duration-[180ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]",
        "disabled:pointer-events-none disabled:opacity-40",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
});
