import Image from "next/image";
import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";

interface GYFLogoProps {
  /** Rendered width in px. 96 in top bar, 140 on login, 120 on splash. */
  width?: number;
  className?: string;
  style?: CSSProperties;
  /** White logo on the dark theme — pass false only on a light surface. */
  invert?: boolean;
}

export function GYFLogo({ width = 120, className, style, invert = true }: GYFLogoProps) {
  return (
    <Image
      src="/assets/logo.png"
      alt="GYF — Get Your Fit"
      width={139}
      height={125}
      priority
      className={cn("object-contain block", className)}
      style={{
        width,
        height: "auto",
        filter: invert ? "var(--logo-filter)" : undefined,
        ...style,
      }}
    />
  );
}
