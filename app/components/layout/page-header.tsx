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
    <header className={cn("mb-8 flex flex-col gap-2", className)}>
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          {eyebrow ? <p className="t-label text-[var(--text-faint)]">{eyebrow}</p> : null}
          <h1 className="t-headline text-[var(--text)]">{title}</h1>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {description ? (
        <p className="t-caption max-w-prose text-[var(--text-mid)]">{description}</p>
      ) : null}
    </header>
  );
}
