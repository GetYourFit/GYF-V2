import Image from "next/image";
import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";

interface GYFLogoProps {
  /** Rendered width in px. Min 80 in headers, 160 on login, 200 on splash. */
  width?: number;
  className?: string;
  style?: CSSProperties;
}

export function GYFLogo({ width = 120, className, style }: GYFLogoProps) {
  return (
    <Image
      src="/assets/logo.png"
      alt="GYF — Get Your Fit"
      width={600}
      height={600}
      priority
      className={cn("object-contain block", className)}
      style={{ width, height: "auto", ...style }}
    />
  );
}
