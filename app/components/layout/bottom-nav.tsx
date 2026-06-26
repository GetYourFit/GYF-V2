"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, Compass, Bookmark, Users, User } from "lucide-react";

import { cn } from "@/lib/cn";

const TAB_ITEMS = [
  { href: "/",        icon: Sparkles, label: "Stylist"  },
  { href: "/explore", icon: Compass,  label: "Explore"  },
  { href: "/saved",   icon: Bookmark, label: "Saved"    },
  { href: "/social",  icon: Users,    label: "Social"   },
  { href: "/profile", icon: User,     label: "Profile"  },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-[var(--rule)] bg-[var(--bg)]/90 backdrop-blur-xl lg:hidden"
    >
      {TAB_ITEMS.map(({ href, icon: Icon, label }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-3 transition-colors duration-[180ms]",
              active ? "text-[var(--text)]" : "text-[var(--text-faint)]",
            )}
          >
            <Icon className="h-5 w-5 shrink-0" aria-hidden />
            <span className="t-mono text-[9px] tracking-[0.12em]">{label}</span>
            {active && (
              <span className="absolute top-0 h-[1px] w-8 bg-[var(--accent)]" aria-hidden />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
