// Empty / zero-data state — one editorial-gallery treatment of the "nothing here
// yet" moment (optional icon, title, supporting copy, optional CTA), so feature
// pages stop hand-rolling centered `flex-col` blocks with drifting spacing.

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

interface EmptyStateProps {
  /** Optional lucide icon rendered above the title in a faint hairline frame. */
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  /** A CTA (e.g. <Button>) rendered below the copy. */
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-16 text-center",
        className,
      )}
    >
      {Icon && (
        <span
          aria-hidden
          className="mb-1 flex h-12 w-12 items-center justify-center border border-border text-text-faint"
        >
          <Icon size={20} />
        </span>
      )}
      <p className="t-title text-text">{title}</p>
      {description && <p className="t-body max-w-sm text-text-mid">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
