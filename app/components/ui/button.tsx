import {
  cloneElement,
  forwardRef,
  isValidElement,
  type ButtonHTMLAttributes,
  type ReactElement,
} from "react";

import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-bg hover:bg-accent-press focus-visible:ring-accent active:scale-[0.96]",
  secondary:
    "border border-border bg-surface-2 text-text hover:border-border-hi hover:bg-surface-3 focus-visible:ring-border-hi active:scale-[0.96]",
  ghost:
    "text-text-mid hover:text-text hover:bg-surface-3 focus-visible:ring-border active:scale-[0.96]",
  danger:
    "bg-error text-white hover:opacity-90 focus-visible:ring-error active:scale-[0.96]",
};

const SIZES: Record<Size, string> = {
  sm: "min-h-9 px-4 text-[10px] tracking-[0.2em]",
  md: "min-h-11 px-5 text-[11px] tracking-[0.18em]",
  lg: "min-h-13 px-7 text-[12px] tracking-[0.2em]",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant = "primary",
    size = "md",
    type = "button",
    asChild = false,
    children,
    ...props
  },
  ref,
) {
  const classes = cn(
    "inline-flex items-center justify-center gap-2 py-2.5",
    "font-[family-name:var(--font-body)] font-semibold uppercase",
    "transition-all duration-200 ease-lux focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
    "disabled:pointer-events-none disabled:opacity-40",
    "motion-reduce:active:scale-100",
    VARIANTS[variant],
    SIZES[size],
    className,
  );

  if (asChild && isValidElement(children)) {
    const child = children as ReactElement<{ className?: string }>;
    const { disabled, ...rest } = props;
    return cloneElement(child, {
      ...rest,
      ref,
      "aria-disabled": disabled || undefined,
      className: cn(classes, child.props.className),
    } as Partial<typeof child.props> & { ref: typeof ref });
  }

  return (
    <button ref={ref} type={type} className={classes} {...props}>
      {children}
    </button>
  );
});
