// User avatar — image with a graceful initials fallback, one treatment of the
// circular identity mark used across social + profile, so each surface stops
// hand-rolling fallback logic and sizing.

"use client";

import { useState } from "react";

import { cn } from "@/lib/cn";

type Size = "sm" | "md" | "lg";

const SIZES: Record<Size, string> = {
  sm: "h-8 w-8 text-[10px]",
  md: "h-10 w-10 text-[11px]",
  lg: "h-14 w-14 text-[13px]",
};

interface AvatarProps {
  /** Display name — drives the accessible label and the initials fallback. */
  name: string;
  src?: string | null;
  size?: Size;
  className?: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function Avatar({ name, src, size = "md", className }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const showImage = src && !failed;

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-surface-2 text-text-mid",
        SIZES[size],
        className,
      )}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name}
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span aria-hidden className="font-[family-name:var(--font-body)] font-medium tracking-wide">
          {initials(name)}
        </span>
      )}
      {!showImage && <span className="sr-only">{name}</span>}
    </span>
  );
}
