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
    <header className={cn("mb-8 flex flex-col gap-2.5 sm:mb-10 sm:gap-3", className)}>
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2.5">
          {eyebrow ? (
            <div className="flex items-center gap-2.5">
              <span className="h-px w-8 bg-accent-warm" aria-hidden />
              <p className="t-label text-accent-warm">{eyebrow}</p>
            </div>
          ) : null}
          <h1 className="t-display text-text">{title}</h1>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {description ? (
        <p className="t-body max-w-prose text-text-mid">{description}</p>
      ) : null}
    </header>
  );
}
