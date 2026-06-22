import { forwardRef, type ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";

// Brand palette (globals.css): ink text on cream, gold accent on interaction.
const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-[var(--text)] text-[var(--bg)] hover:bg-[var(--gold)] focus-visible:ring-[var(--gold)]",
  secondary:
    "border border-[var(--border-mid)] bg-[var(--surface)] text-[var(--text)] hover:border-[var(--gold)] focus-visible:ring-[var(--gold)]",
  ghost:
    "text-[var(--mid)] hover:text-[var(--text)] hover:bg-[var(--gold-light)] focus-visible:ring-[var(--rule)]",
  danger: "bg-[#8a2b22] text-[var(--bg)] hover:bg-[#a23329] focus-visible:ring-[#8a2b22]",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

/** Accessible button in the editorial brand language: ink/cream/gold, visible
 *  focus ring, 44px tap target, uppercase tracked label. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 px-5 py-2.5",
        "font-[family-name:var(--font-body)] text-[11px] font-medium uppercase tracking-[0.18em]",
        "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]",
        "disabled:pointer-events-none disabled:opacity-50",
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
});
