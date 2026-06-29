import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

interface PageHeaderProps {
  /** Small uppercase eyebrow above the title (e.g. "Collections"). */
  eyebrow?: string;
  title: string;
  description?: string;
  /** Optional trailing control (e.g. a button), right-aligned on the title row. */
  action?: ReactNode;
  className?: string;
}

/**
 * The standard page masthead: an optional eyebrow, the title, and an optional
 * description — one type hierarchy across every primary page (the five nav tabs
 * use this), replacing the ad-hoc mix of `t-display`/`t-headline`/`t-title`.
 */
export function PageHeader({ eyebrow, title, description, action, className }: PageHeaderProps) {
  return (
    <header className={cn("mb-10 flex flex-col gap-3", className)}>
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-3">
          {eyebrow ? (
            <div className="flex items-center gap-3">
              <span className="h-px w-10 bg-accent-warm" aria-hidden />
              <p className="t-label text-accent-warm">{eyebrow}</p>
            </div>
          ) : null}
          <h1 className="t-display text-text">{title}</h1>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {description ? <p className="t-body max-w-prose text-text-mid">{description}</p> : null}
    </header>
  );
}
