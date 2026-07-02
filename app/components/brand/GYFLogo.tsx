import Image from "next/image";
import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";

interface GYFLogoProps {
  /** Rendered width in px. 96 in top bar, 140 on login, 120 on splash. */
  width?: number;
  className?: string;
  style?: CSSProperties;
  /** Pass true when rendering on a dark background — inverts to white */
  invert?: boolean;
}

export function GYFLogo({ width = 120, className, style, invert = false }: GYFLogoProps) {
  return (
    <Image
      src="/assets/logo.png"
      alt="GYF — Get Your Fit"
      width={600}
      height={600}
      priority
      className={cn("object-contain block", className)}
      style={{
        width,
        height: "auto",
        filter: invert ? "brightness(0) invert(1)" : undefined,
        ...style,
      }}
    />
  );
}
