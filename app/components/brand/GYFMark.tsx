import Image from "next/image";
import { cn } from "@/lib/cn";

interface GYFMarkProps {
  size?: number;
  className?: string;
  invert?: boolean;
}

export function GYFMark({ size = 40, className, invert = false }: GYFMarkProps) {
  return (
    <Image
      src="/assets/logo.png"
      alt="GYF"
      width={300}
      height={300}
      priority
      className={cn("object-contain block", className)}
      style={{
        width: size,
        height: size,
        filter: invert ? "brightness(0) invert(1)" : undefined,
      }}
    />
  );
}
