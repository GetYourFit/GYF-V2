import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function PageHeader({ eyebrow, title, description, action, className }: PageHeaderProps) {
  return (
    <header className={cn("mb-6 flex flex-col gap-2 sm:mb-8 sm:gap-2.5", className)}>
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          {eyebrow ? (
            <p className="t-label text-accent">{eyebrow}</p>
          ) : null}
          <h1 className="t-display text-text" style={{ fontSize: "clamp(1.4rem, 4vw, 2.5rem)" }}>
            {title}
          </h1>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {description ? (
        <p className="t-body max-w-prose text-text-mid">{description}</p>
      ) : null}
    </header>
  );
}
