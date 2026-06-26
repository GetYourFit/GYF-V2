"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, Compass, Bookmark, Users, User } from "lucide-react";

import { cn } from "@/lib/cn";

const TAB_ITEMS = [
  { href: "/", icon: Sparkles, label: "Stylist" },
  { href: "/explore", icon: Compass, label: "Explore" },
  { href: "/saved", icon: Bookmark, label: "Saved" },
  { href: "/social", icon: Users, label: "Social" },
  { href: "/profile", icon: User, label: "Profile" },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-[var(--rule)] bg-[var(--bg)]/95 backdrop-blur-xl"
    >
      {TAB_ITEMS.map(({ href, icon: Icon, label }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 transition-colors duration-150 active:opacity-70",
              active ? "text-[var(--text)]" : "text-[var(--text-faint)]",
            )}
          >
            {active && (
              <span
                className="absolute top-0 left-1/2 h-[1px] w-8 -translate-x-1/2 bg-[var(--accent)]"
                aria-hidden
              />
            )}
            <Icon className="h-[22px] w-[22px] shrink-0" aria-hidden />
            <span className="t-mono text-[9px] tracking-[0.12em]">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
