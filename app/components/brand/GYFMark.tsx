import Image from "next/image";
import { cn } from "@/lib/cn";

interface GYFMarkProps {
  size?: number;
  className?: string;
}

export function GYFMark({ size = 40, className }: GYFMarkProps) {
  return (
    <Image
      src="/assets/logo.png"
      alt="GYF"
      width={300}
      height={300}
      className={cn("object-contain block", className)}
      style={{ width: size, height: size }}
    />
  );
}
